/**
 * Teste do DROP: onde a folha caiu → o que escrever em `ajustes`.
 *
 * Ordem esparsa é aritmética que erra em silêncio (folha que "volta" pro lugar,
 * duas folhas com a mesma ordem) e o defeito só apareceria no PDF montado.
 *
 *   node scripts/test-nexo-drop.ts   (== npm run test:nexo:drop)
 */
import assert from "node:assert/strict";

import { folhas, gruposDasFolhas, type Ajuste, type FolhaId } from "../modules/nexo/lib/folhas.ts";
import {
  ajusteDoDrop,
  alvoDoDrop,
  ordensEntre,
  type FileiraDoDrop,
} from "../modules/nexo/lib/drop-folhas.ts";
import { PASSO_X, PASSO_Y } from "../modules/nexo/lib/layout-canvas.ts";
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
  const alvo = alvoDoDrop({ x: 780 + PASSO_X, y: 10 }, FILEIRAS);
  assert.deepEqual(alvo, { tomo: 1, indice: 1 });
});

test("cair na folga entre a grade e o volume ainda é a fileira", () => {
  // Bem à direita da grade, mas dentro da faixa vertical do tomo 2.
  const alvo = alvoDoDrop({ x: 780 + 40 * PASSO_X, y: 400 }, FILEIRAS);
  assert.equal(alvo?.tomo, 2);
  // Clampado ao fim da fileira, não a um índice inventado.
  assert.equal(alvo?.indice, 3);
});

test("a segunda linha da grade continua a contagem", () => {
  const alvo = alvoDoDrop({ x: 780, y: PASSO_Y + 5 }, FILEIRAS);
  assert.deepEqual(alvo, { tomo: 1, indice: 3 });
});

test("fora de qualquer fileira devolve null", () => {
  assert.equal(alvoDoDrop({ x: 780, y: 5000 }, FILEIRAS), null);
});

// ---------------------------------------------------------------------------
// ajusteDoDrop — e o que a montagem faz com ele
// ---------------------------------------------------------------------------

test("mover uma folha para o outro tomo escreve grupo E ordem", () => {
  const movida = PROJETADAS[0];
  const destino = PROJETADAS.slice(3);
  const patches = ajusteDoDrop([movida], { tomo: 2, indice: 1 }, destino, true);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, movida.id);
  assert.equal(patches[0].patch.grupo, 2);
  assert.ok(typeof patches[0].patch.ordem === "number");
});

test("com uma fileira só, reordena sem escrever grupo", () => {
  const patches = ajusteDoDrop([PROJETADAS[2]], { tomo: 1, indice: 0 }, PROJETADAS, false);
  assert.equal(patches[0].patch.grupo, undefined);
  assert.ok(typeof patches[0].patch.ordem === "number");
});

test("O TESTE QUE AMARRA: a montagem coloca a folha no tomo e na posição do drop", () => {
  const movida = PROJETADAS[0]; // 1ª folha, hoje no tomo 1
  const destino = PROJETADAS.slice(3); // tomo 2
  const patches = ajusteDoDrop([movida], { tomo: 2, indice: 1 }, destino, true);

  const ajustes: Record<FolhaId, Ajuste> = {};
  for (const p of patches) ajustes[p.id] = p.patch;

  const reprojetadas = folhas(SELOS, ajustes);
  const grupos = gruposDasFolhas(reprojetadas, 2, buildBalancedQuantities);
  // Saiu do tomo 1...
  assert.equal(grupos[0].includes(movida.id), false);
  // ...e entrou no tomo 2, na 2ª posição (índice 1) do destino.
  assert.equal(grupos[1][1], movida.id);
});

test("soltar exatamente onde já estava não escreve ajuste nenhum", () => {
  const movidas = PROJETADAS.slice(0, 2);
  const patches = ajusteDoDrop(movidas, { tomo: 1, indice: 0 }, PROJETADAS.slice(0, 3), true);
  assert.deepEqual(patches, []);
});

test("mas mover UMA casa dentro da mesma fileira escreve", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[0]],
    { tomo: 1, indice: 2 },
    PROJETADAS.slice(0, 3),
    true,
  );
  assert.equal(patches.length, 1);
});

console.log(`\n${passed} teste(s) do drop OK`);
