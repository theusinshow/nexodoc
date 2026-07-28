/**
 * Teste do DROP: onde a folha caiu → o que escrever em `ajustes`.
 *
 * Ordem esparsa é aritmética que erra em silêncio (folha que "volta" pro lugar,
 * duas folhas com a mesma ordem) e o defeito só apareceria no PDF montado.
 *
 *   node scripts/test-nexo-drop.ts   (== npm run test:nexo:drop)
 */
import assert from "node:assert/strict";

import {
  chaveDeOrdem,
  folhas,
  gruposDasFolhas,
  type Ajuste,
  type Folha,
  type FolhaId,
} from "../modules/nexo/lib/folhas.ts";
import {
  ajusteDoDrop,
  alvoDoDrop,
  ordensEntre,
  type FileiraDoDrop,
  type GradeDoDrop,
} from "../modules/nexo/lib/drop-folhas.ts";
import {
  COLUNAS_DA_GRADE,
  PASSO_X,
  PASSO_Y,
} from "../modules/nexo/lib/layout-canvas.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";
import { buildBalancedQuantities } from "../lib/ld/ld-rules.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

function selo(fileName: string, pageNumber: number): SeloForLd {
  return {
    fileName,
    pageNumber,
    disciplina: "ARQUITETURA",
    folha: pageNumber,
    total: 6,
    numeroFolha: String(pageNumber),
    arquivo: `${fileName}-${pageNumber}`,
    conteudo: `Prancha ${pageNumber}`,
    cliente: null,
    secretaria: null,
    obra: null,
    fase: null,
    tituloSecao: null,
  };
}

const SELOS: SeloForLd[] = [1, 2, 3, 4, 5, 6].map((n) => selo("a.pdf", n));
const PROJETADAS = folhas(SELOS, {});

// A grade e a chave chegam INJETADAS no módulo puro; o teste passa as de
// produção — um dublê aqui só provaria que o parâmetro é chamado.
const GRADE: GradeDoDrop = {
  colunas: COLUNAS_DA_GRADE,
  passoX: PASSO_X,
  passoY: PASSO_Y,
};

/** A divisão que estaria na tela: 3 folhas por tomo, como o automático faria. */
const DIVISAO: { tomo: number; folhas: readonly Folha[] }[] = [
  { tomo: 1, folhas: PROJETADAS.slice(0, 3) },
  { tomo: 2, folhas: PROJETADAS.slice(3) },
];

// Duas fileiras: tomo 1 com as 3 primeiras, tomo 2 com as 3 últimas.
const FILEIRAS: FileiraDoDrop[] = [
  {
    tomo: 1,
    topo: 0,
    altura: 330,
    gradeX: 780,
    gradeY: 0,
    folhas: PROJETADAS.slice(0, 3).map((f) => f.id),
  },
  {
    tomo: 2,
    topo: 330,
    altura: 330,
    gradeX: 780,
    gradeY: 330,
    folhas: PROJETADAS.slice(3).map((f) => f.id),
  },
];

// ---------------------------------------------------------------------------
// ordensEntre
// ---------------------------------------------------------------------------

test("intercala estritamente entre os dois vizinhos", () => {
  const [o] = ordensEntre(1, 2, 1);
  assert.ok(o > 1 && o < 2, `${o} não ficou entre 1 e 2`);
});

test("várias juntas mantêm a ordem entre si e cabem no intervalo", () => {
  const out = ordensEntre(1, 2, 3);
  assert.equal(out.length, 3);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out[0] > 1 && out[2] < 2, `${out.join(",")} saiu do intervalo`);
});

test("sem vizinho anterior, vem antes do próximo", () => {
  const out = ordensEntre(null, 3, 2);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out[out.length - 1] < 3, `${out.join(",")} não ficou antes de 3`);
});

test("sem próximo, vem depois do anterior", () => {
  const out = ordensEntre(5, null, 2);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out[0] > 5, `${out.join(",")} não ficou depois de 5`);
});

test("lista vazia não produz ordem nenhuma", () => {
  assert.deepEqual(ordensEntre(1, 2, 0), []);
});

// ---------------------------------------------------------------------------
// alvoDoDrop
// ---------------------------------------------------------------------------

test("acerta a fileira e a posição pela coordenada", () => {
  // Sobre a 2ª folha do tomo 1.
  const alvo = alvoDoDrop({ x: 780 + PASSO_X, y: 10 }, FILEIRAS, GRADE);
  assert.deepEqual(alvo, { tomo: 1, indice: 1 });
});

test("cair na folga entre a grade e o volume ainda é a fileira", () => {
  // Bem à direita da grade, mas dentro da faixa vertical do tomo 2.
  const alvo = alvoDoDrop({ x: 780 + 40 * PASSO_X, y: 400 }, FILEIRAS, GRADE);
  assert.equal(alvo?.tomo, 2);
  // Clampado ao fim da fileira, não a um índice inventado.
  assert.equal(alvo?.indice, 3);
});

test("a segunda linha da grade continua a contagem", () => {
  const alvo = alvoDoDrop({ x: 780, y: PASSO_Y + 5 }, FILEIRAS, GRADE);
  assert.deepEqual(alvo, { tomo: 1, indice: 3 });
});

test("fora de qualquer fileira devolve null", () => {
  assert.equal(alvoDoDrop({ x: 780, y: 5000 }, FILEIRAS, GRADE), null);
});

// ---------------------------------------------------------------------------
// ajusteDoDrop — e o que a montagem faz com ele
// ---------------------------------------------------------------------------

test("mover uma folha para o outro tomo escreve grupo E ordem nela", () => {
  const movida = PROJETADAS[0];
  const patches = ajusteDoDrop(
    [movida],
    { tomo: 2, indice: 1 },
    PROJETADAS.slice(3),
    DIVISAO,
    chaveDeOrdem,
  );
  const daMovida = patches.find((p) => p.id === movida.id);
  assert.equal(daMovida?.patch.grupo, 2);
  assert.ok(typeof daMovida?.patch.ordem === "number");
});

test("congela o palpite: TODA folha sem grupo ganha o tomo em que já estava", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[0]],
    { tomo: 2, indice: 1 },
    PROJETADAS.slice(3),
    DIVISAO,
    chaveDeOrdem,
  );
  // As 6 folhas saem com grupo — a arrastada no destino, as outras onde estavam.
  assert.equal(patches.length, 6);
  const porId = new Map(patches.map((p) => [p.id, p.patch]));
  assert.equal(porId.get("a.pdf#2")?.grupo, 1);
  assert.equal(porId.get("a.pdf#3")?.grupo, 1);
  assert.equal(porId.get("a.pdf#4")?.grupo, 2);
  // Congelar não inventa ordem para quem não se moveu.
  assert.equal(porId.get("a.pdf#2")?.ordem, undefined);
});

test("sem divisão (uma fileira só), reordena sem escrever grupo nenhum", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[2]],
    { tomo: 1, indice: 0 },
    PROJETADAS,
    null,
    chaveDeOrdem,
  );
  assert.equal(patches.length, 1);
  assert.equal(patches[0].patch.grupo, undefined);
  assert.ok(typeof patches[0].patch.ordem === "number");
});

test("O TESTE QUE AMARRA: a folha vai para o tomo e a posição do drop, e NENHUMA outra se mexe", () => {
  const movida = PROJETADAS[0]; // 1ª folha, hoje no tomo 1
  const patches = ajusteDoDrop(
    [movida],
    { tomo: 2, indice: 1 }, // entre a 4 e a 5
    PROJETADAS.slice(3),
    DIVISAO,
    chaveDeOrdem,
  );

  const ajustes: Record<FolhaId, Ajuste> = {};
  for (const p of patches) ajustes[p.id] = p.patch;

  const grupos = gruposDasFolhas(folhas(SELOS, ajustes), 2, buildBalancedQuantities);
  // O tomo 1 perdeu SÓ a folha arrastada.
  assert.deepEqual(grupos[0], ["a.pdf#2", "a.pdf#3"]);
  // O tomo 2 recebeu ela entre a 4 e a 5, e não perdeu ninguém.
  assert.deepEqual(grupos[1], ["a.pdf#4", "a.pdf#1", "a.pdf#5", "a.pdf#6"]);
});

test("soltar exatamente onde já estava não escreve ajuste nenhum", () => {
  const movidas = PROJETADAS.slice(0, 2);
  const patches = ajusteDoDrop(
    movidas,
    { tomo: 1, indice: 0 },
    PROJETADAS.slice(0, 3),
    DIVISAO,
    chaveDeOrdem,
  );
  // Nem o congelamento: gesto sem efeito não escreve nada.
  assert.deepEqual(patches, []);
});

test("mas mover UMA casa dentro da mesma fileira escreve", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[0]],
    { tomo: 1, indice: 2 },
    PROJETADAS.slice(0, 3),
    DIVISAO,
    chaveDeOrdem,
  );
  const daMovida = patches.find((p) => p.id === "a.pdf#1");
  assert.ok(typeof daMovida?.patch.ordem === "number");
});

console.log(`\n${passed} teste(s) do drop OK`);
