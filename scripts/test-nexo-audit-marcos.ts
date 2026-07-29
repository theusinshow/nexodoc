/**
 * Teste da redução dos MARCOS do motor à lista de etapas que a tela mostra.
 *
 * A regra de fundo é a mesma do resto da auditoria: só se afirma o que é fato
 * naquele instante. Aqui isso vira três garantias — passada que o motor não
 * anunciou não aparece (não prometer trabalho que talvez não aconteça), o
 * detalhe do fim substitui o do início (contagem real vale mais que orçamento),
 * e o começo de uma passada é o do PRIMEIRO marco dela (é contra ele que o
 * estouro de tempo é medido; contra o início da auditoria inteira, a tela
 * acusaria atraso em documento grande onde nada está atrasado).
 *
 *   node scripts/test-nexo-audit-marcos.ts   (== npm run test:nexo:audit-marcos)
 */
import assert from "node:assert/strict";

import { etapasDosMarcos } from "../modules/nexo/lib/etapas-da-auditoria.ts";

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

test("passada não anunciada não aparece na lista", () => {
  const etapas = etapasDosMarcos([
    { passada: "extracao", estado: "inicio", emMs: 1000 },
    { passada: "extracao", estado: "fim", detalhe: "132 páginas", emMs: 2000 },
  ]);
  assert.equal(etapas.length, 1);
  // No Profundo os blocos são cortados: prometê-los seria descrever trabalho
  // que não vai acontecer.
  assert.ok(!etapas.some((e) => e.passada === "blocos"));
});

test("a lista segue a ordem do motor, não a de chegada", () => {
  const etapas = etapasDosMarcos([
    { passada: "global", estado: "inicio", emMs: 3000 },
    { passada: "extracao", estado: "fim", emMs: 1000 },
  ]);
  assert.deepEqual(
    etapas.map((e) => e.passada),
    ["extracao", "global"],
  );
});

test("o detalhe do fim substitui o do início", () => {
  const etapas = etapasDosMarcos([
    { passada: "global", estado: "inicio", detalhe: "documento inteiro", emMs: 1000 },
    { passada: "global", estado: "fim", detalhe: "12 achado(s)", emMs: 9000 },
  ]);
  assert.equal(etapas[0].detalhe, "12 achado(s)");
  assert.equal(etapas[0].concluida, true);
});

test("o começo da passada é o do primeiro marco dela", () => {
  const etapas = etapasDosMarcos([
    { passada: "blocos", estado: "inicio", indice: 0, total: 8, emMs: 5000 },
    { passada: "blocos", estado: "inicio", indice: 3, total: 8, emMs: 7000 },
  ]);
  assert.equal(etapas[0].inicioMs, 5000, "o avanço não pode reiniciar o relógio da etapa");
  assert.equal(etapas[0].indice, 3);
  assert.equal(etapas[0].concluida, false);
});

test("o orçamento sobrevive ao avanço da passada", () => {
  const etapas = etapasDosMarcos([
    { passada: "validacao", estado: "inicio", orcamentoMs: 300000, emMs: 1000 },
    { passada: "validacao", estado: "inicio", detalhe: "revisando", emMs: 2000 },
  ]);
  // Sem isto a tela perderia o teto e nunca diria "passou do previsto".
  assert.equal(etapas[0].orcamentoMs, 300000);
});

console.log(`\n${passed} teste(s) de marcos OK`);
