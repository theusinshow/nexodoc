/**
 * Teste da PROJEÇÃO das folhas: `selos` (o que o PDF diz) + `ajustes` (o que o
 * usuário mudou) → `Folha[]` (o que a montagem lê).
 *
 * A primeira asserção é a que mais importa: sem ajuste nenhum, a projeção tem de
 * devolver exatamente os selos. É o que prova que a fundação entrou sem regredir
 * a montagem já validada à mão.
 *
 *   node scripts/test-nexo-folhas.ts   (== npm run test:nexo:folhas)
 */
import assert from "node:assert/strict";

import {
  aplicarAjuste,
  folhaId,
  folhas,
  gruposDasFolhas,
  type Ajuste,
  type FolhaId,
} from "../modules/nexo/lib/folhas.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";
// A divisão automática chega injetada. O teste passa a função REAL de produção —
// um dublê aqui só provaria que o parâmetro é chamado.
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

function selo(fileName: string, pageNumber: number, extra: Partial<SeloForLd> = {}): SeloForLd {
  return {
    fileName,
    pageNumber,
    disciplina: "ARQUITETURA",
    folha: pageNumber,
    total: 3,
    numeroFolha: String(pageNumber),
    arquivo: `${fileName}-${pageNumber}`,
    conteudo: `Prancha ${pageNumber}`,
    cliente: null,
    secretaria: null,
    obra: null,
    fase: null,
    tituloSecao: null,
    ...extra,
  };
}

const SELOS: SeloForLd[] = [
  selo("a.pdf", 1),
  selo("a.pdf", 2),
  selo("b.pdf", 1, { disciplina: "ESTRUTURAL" }),
];

// ---------------------------------------------------------------------------
// A garantia de não-regressão
// ---------------------------------------------------------------------------

test("sem ajustes, a projeção devolve os selos na ordem natural", () => {
  const out = folhas(SELOS, {});
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((f) => [f.fileName, f.pageNumber]),
    [
      ["a.pdf", 1],
      ["a.pdf", 2],
      ["b.pdf", 1],
    ],
  );
  // Todo campo do selo continua chegando intacto.
  assert.equal(out[2].disciplina, "ESTRUTURAL");
  assert.equal(out[0].conteudo, "Prancha 1");
  assert.equal(out.every((f) => f.editado === false), true);
});

test("folhaId é o par arquivo#página, estável entre leituras", () => {
  assert.equal(folhaId(SELOS[0]), "a.pdf#1");
  assert.equal(folhaId(SELOS[2]), "b.pdf#1");
  // Sem página (PDF de uma folha só) não pode colidir com a página 1.
  assert.notEqual(folhaId(selo("c.pdf", 1)), folhaId({ ...selo("c.pdf", 1), pageNumber: null }));
});

// ---------------------------------------------------------------------------
// Os quatro campos editáveis
// ---------------------------------------------------------------------------

test("ajuste de título troca só o título e marca `editado`", () => {
  const out = folhas(SELOS, { "a.pdf#1": { titulo: "PLANTA BAIXA REVISADA" } });
  assert.equal(out[0].conteudo, "PLANTA BAIXA REVISADA");
  assert.equal(out[0].editado, true);
  // Nada mais foi tocado.
  assert.equal(out[0].disciplina, "ARQUITETURA");
  assert.equal(out[0].arquivo, "a.pdf-1");
  assert.equal(out[1].editado, false);
});

test("ajuste de disciplina reclassifica a folha", () => {
  const out = folhas(SELOS, { "a.pdf#1": { disciplina: "HIDROSSANITARIO" } });
  assert.equal(out[0].disciplina, "HIDROSSANITARIO");
  assert.equal(out[0].editado, true);
});

test("string vazia é tratada como ausente (não deixa título em branco na LD)", () => {
  const out = folhas(SELOS, { "a.pdf#1": { titulo: "   ", disciplina: "" } });
  assert.equal(out[0].conteudo, "Prancha 1");
  assert.equal(out[0].disciplina, "ARQUITETURA");
  assert.equal(out[0].editado, false);
});

// ---------------------------------------------------------------------------
// Ordem esparsa
// ---------------------------------------------------------------------------

test("ordem manual move a folha sem renumerar as outras", () => {
  const out = folhas(SELOS, { "b.pdf#1": { ordem: 0 } });
  assert.deepEqual(out.map(folhaId), ["b.pdf#1", "a.pdf#1", "a.pdf#2"]);
  assert.equal(out[0].editado, true);
});

test("folhas sem ordem mantêm a ordem natural entre si", () => {
  const out = folhas(SELOS, { "a.pdf#2": { ordem: 99 } });
  assert.deepEqual(out.map(folhaId), ["a.pdf#1", "b.pdf#1", "a.pdf#2"]);
});

// ---------------------------------------------------------------------------
// Grupo: o manual manda
// ---------------------------------------------------------------------------

test("grupo manual vence a divisão automática", () => {
  const ajustes: Record<FolhaId, Ajuste> = {
    "a.pdf#1": { grupo: 2 },
    "a.pdf#2": { grupo: 1 },
    "b.pdf#1": { grupo: 2 },
  };
  assert.deepEqual(gruposDasFolhas(folhas(SELOS, ajustes), 2, buildBalancedQuantities), [
    ["a.pdf#2"],
    ["a.pdf#1", "b.pdf#1"],
  ]);
});

test("sem nenhum grupo manual, cai na divisão automática por quantidade", () => {
  assert.deepEqual(gruposDasFolhas(folhas(SELOS, {}), 2, buildBalancedQuantities), [
    ["a.pdf#1", "a.pdf#2"],
    ["b.pdf#1"],
  ]);
});

test("grupo em algumas folhas só: as sem grupo caem na divisão automática", () => {
  const out = folhas(SELOS, { "b.pdf#1": { grupo: 1 } });
  const grupos = gruposDasFolhas(out, 2, buildBalancedQuantities);
  // A folha com grupo manual está no tomo que ela mandou...
  assert.equal(grupos[0].includes("b.pdf#1"), true);
  // ...e nenhuma folha se perde.
  assert.equal(grupos.flat().length, 3);
  assert.equal(new Set(grupos.flat()).size, 3);
});

// ---------------------------------------------------------------------------
// Robustez
// ---------------------------------------------------------------------------

test("ajuste órfão (prancha removida) é ignorado, não quebra", () => {
  const out = folhas(SELOS, { "sumiu.pdf#7": { titulo: "fantasma" } });
  assert.equal(out.length, 3);
  assert.equal(out.every((f) => f.editado === false), true);
});

test("reanexar pranchas preserva os ajustes das folhas que continuam existindo", () => {
  const ajustes = { "a.pdf#1": { titulo: "MANTIDO" } };
  const relidos = [...SELOS, selo("c.pdf", 1)];
  const out = folhas(relidos, ajustes);
  assert.equal(out.length, 4);
  assert.equal(out[0].conteudo, "MANTIDO");
});

test("aplicarAjuste acumula campos em vez de substituir o ajuste inteiro", () => {
  const depois = aplicarAjuste({ "a.pdf#1": { titulo: "T" } }, "a.pdf#1", { grupo: 2 });
  assert.deepEqual(depois["a.pdf#1"], { titulo: "T", grupo: 2 });
});

test("aplicarAjuste não muta o objeto recebido", () => {
  const antes: Record<FolhaId, Ajuste> = { "a.pdf#1": { titulo: "T" } };
  aplicarAjuste(antes, "a.pdf#1", { titulo: "OUTRO" });
  assert.equal(antes["a.pdf#1"].titulo, "T");
});

test("aplicarAjuste com campo vazio LIMPA o campo (desfazer a edição)", () => {
  const depois = aplicarAjuste({ "a.pdf#1": { titulo: "T", grupo: 2 } }, "a.pdf#1", {
    titulo: undefined,
  });
  assert.equal("titulo" in depois["a.pdf#1"], false);
  assert.equal(depois["a.pdf#1"].grupo, 2);
});

console.log(`\n${passed} teste(s) OK`);
