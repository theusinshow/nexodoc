/**
 * Teste das regras determinísticas da Montagem de LDs.
 *
 * Roda sem framework, direto no Node com type-stripping nativo:
 *   node scripts/test-ld-rules.ts
 * (também exposto como `npm run test:ld`)
 *
 * Objetivo: travar o comportamento de `lib/ld/ld-rules.ts` — validação das
 * linhas e divisão de tomos — porque a tabela de revisão da etapa 3 depende
 * inteiramente dele e não passa por IA.
 */
import assert from "node:assert/strict";

import {
  buildBalancedQuantities,
  buildBalancedTomos,
  compareBySheet,
  formatSheet,
  parseSheet,
  updateTomoQuantity,
  validateRows,
  type ReviewRow,
} from "../lib/ld/ld-rules.ts";

function makeRow(overrides: Partial<ReviewRow> & { id: number }): ReviewRow {
  return {
    sheet: "",
    file: "arquivo.dwg",
    description: "DIAGRAMAS DE MONTAGEM",
    readDiscipline: "",
    lowConfidence: false,
    reviewedAlertKeys: [],
    ...overrides,
  };
}

const somaDosTomos = (tomos: { quantity: number }[]) =>
  tomos.reduce((sum, tomo) => sum + tomo.quantity, 0);

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("regras da LD\n");

// --- 1. Leitura do número da folha -------------------------------------------
check("lê folha no formato NN/TT", () => {
  assert.deepEqual(parseSheet("01/59"), { number: 1, total: 59 });
});

check("tolera espaços em volta da barra", () => {
  assert.deepEqual(parseSheet(" 7 / 12 "), { number: 7, total: 12 });
});

check("devolve null quando não há folha reconhecível", () => {
  assert.equal(parseSheet("prancha única"), null);
  assert.equal(parseSheet(""), null);
});

check("formata com zeros à esquerda conforme a largura do total", () => {
  assert.equal(formatSheet(1, 59), "01/59");
  assert.equal(formatSheet(7, 120), "007/120");
});

// --- 2. Ordenação -------------------------------------------------------------
check("ordena por número da folha, não alfabeticamente", () => {
  const rows = [
    makeRow({ id: 1, sheet: "10/59" }),
    makeRow({ id: 2, sheet: "02/59" }),
    makeRow({ id: 3, sheet: "01/59" }),
  ];
  const ordenadas = [...rows].sort(compareBySheet).map((row) => row.sheet);
  assert.deepEqual(ordenadas, ["01/59", "02/59", "10/59"]);
});

check("linhas sem folha reconhecível vão para o fim", () => {
  const rows = [
    makeRow({ id: 1, sheet: "sem folha" }),
    makeRow({ id: 2, sheet: "03/59" }),
  ];
  assert.deepEqual([...rows].sort(compareBySheet).map((row) => row.id), [2, 1]);
});

// --- 3. Bloqueios da tabela de revisão ---------------------------------------
check("ARQUIVOS vazio bloqueia", () => {
  const result = validateRows([makeRow({ id: 1, sheet: "01/01", file: "  " })], "est", null);
  assert.equal(result.rowIssues[1][0].severity, "blocker");
  assert.deepEqual(result.blockingIssues, ["Linha 1: ARQUIVOS vazio."]);
});

check("DESCRIÇÃO vazia bloqueia", () => {
  const result = validateRows([makeRow({ id: 1, sheet: "01/01", description: "" })], "est", null);
  assert.deepEqual(result.blockingIssues, ["Linha 1: DESCRIÇÃO vazia."]);
});

check("folha duplicada bloqueia as duas linhas", () => {
  const result = validateRows(
    [makeRow({ id: 1, sheet: "03/59" }), makeRow({ id: 2, sheet: "03/59" })],
    "est",
    null,
  );
  assert.equal(result.rowIssues[1].some((issue) => issue.key === "duplicate-3"), true);
  assert.equal(result.rowIssues[2].some((issue) => issue.key === "duplicate-3"), true);
  assert.deepEqual(result.blockingIssues, ["Folha 03/59 duplicada."]);
});

check("LD sem problema nenhum não gera bloqueio", () => {
  const result = validateRows(
    [makeRow({ id: 1, sheet: "01/02" }), makeRow({ id: 2, sheet: "02/02" })],
    "est",
    null,
  );
  assert.deepEqual(result.blockingIssues, []);
  assert.deepEqual(result.globalWarnings, []);
  assert.deepEqual(result.missingSheets, []);
});

// --- 4. Alertas ---------------------------------------------------------------
check("disciplina lida diferente da LD vira alerta, não bloqueio", () => {
  const result = validateRows([makeRow({ id: 1, sheet: "01/01", readDiscipline: "arq" })], "est", null);
  const issue = result.rowIssues[1][0];
  assert.equal(issue.severity, "warning");
  assert.equal(result.blockingIssues.length, 0);
});

check("disciplina igual com acento/caixa diferente não alerta", () => {
  const result = validateRows([makeRow({ id: 1, sheet: "01/01", readDiscipline: "EST" })], "est", null);
  assert.deepEqual(result.rowIssues[1], []);
});

check("rótulo de selo mal lido ('folha', 'rev') não vira alerta de disciplina", () => {
  for (const lixo of ["folha", "rev", "escala", "data"]) {
    const result = validateRows([makeRow({ id: 1, sheet: "01/01", readDiscipline: lixo })], "est", null);
    assert.deepEqual(result.rowIssues[1], [], `"${lixo}" não deveria alertar`);
  }
});

check("baixa confiança vira alerta", () => {
  const result = validateRows([makeRow({ id: 1, sheet: "01/01", lowConfidence: true })], "est", null);
  assert.equal(result.rowIssues[1][0].key, "low-confidence");
  assert.equal(result.rowIssues[1][0].severity, "warning");
});

// --- 5. Folhas faltantes e total de referência --------------------------------
check("aponta o buraco quando falta uma folha no meio", () => {
  const result = validateRows(
    [makeRow({ id: 1, sheet: "01/03" }), makeRow({ id: 2, sheet: "03/03" })],
    "est",
    null,
  );
  assert.deepEqual(result.missingSheets, [2]);
  assert.equal(result.globalWarnings[0].key, "missing-sheets");
});

check("totais divergentes pedem total de referência", () => {
  const result = validateRows(
    [makeRow({ id: 1, sheet: "01/59" }), makeRow({ id: 2, sheet: "02/60" })],
    "est",
    null,
  );
  assert.deepEqual(result.totals, [59, 60]);
  assert.equal(result.globalWarnings[0].key, "total-reference");
});

check("total de referência definido alerta a linha fora do padrão", () => {
  const result = validateRows(
    [makeRow({ id: 1, sheet: "01/59" }), makeRow({ id: 2, sheet: "02/60" })],
    "est",
    59,
  );
  assert.equal(result.rowIssues[2].some((issue) => issue.key === "total-60"), true);
  assert.equal(result.rowIssues[1].length, 0);
});

// --- 6. Divisão de tomos ------------------------------------------------------
check("distribui as folhas e devolve o resto para os primeiros tomos", () => {
  assert.deepEqual(buildBalancedQuantities(59, 4), [15, 15, 15, 14]);
  assert.deepEqual(buildBalancedQuantities(10, 5), [2, 2, 2, 2, 2]);
});

check("intervalos dos tomos são contínuos e cobrem o total", () => {
  const tomos = buildBalancedTomos(59, 4);
  assert.equal(somaDosTomos(tomos), 59);
  assert.deepEqual(
    tomos.map((tomo) => [tomo.start, tomo.end]),
    [["01/59", "15/59"], ["16/59", "30/59"], ["31/59", "45/59"], ["46/59", "59/59"]],
  );
});

check("mais tomos que folhas não gera tomo vazio", () => {
  const tomos = buildBalancedTomos(3, 10);
  assert.equal(tomos.length, 3);
  assert.equal(tomos.every((tomo) => tomo.quantity > 0), true);
});

check("mudar a quantidade de um tomo rebalanceia os seguintes e preserva o total", () => {
  const tomos = updateTomoQuantity(buildBalancedTomos(59, 4), 59, 0, 20);
  assert.equal(tomos[0].quantity, 20);
  assert.equal(somaDosTomos(tomos), 59);
  assert.equal(tomos[0].end, "20/59");
  assert.equal(tomos[1].start, "21/59");
});

check("quantidade absurda é limitada para sobrar ao menos 1 folha por tomo seguinte", () => {
  const tomos = updateTomoQuantity(buildBalancedTomos(10, 3), 10, 0, 999);
  assert.equal(tomos[0].quantity, 8);
  assert.equal(somaDosTomos(tomos), 10);
  assert.equal(tomos.every((tomo) => tomo.quantity > 0), true);
});

check("quantidade zero ou negativa vira 1", () => {
  const tomos = updateTomoQuantity(buildBalancedTomos(10, 2), 10, 0, 0);
  assert.equal(tomos[0].quantity, 1);
  assert.equal(somaDosTomos(tomos), 10);
});

console.log(`\n${passed} teste(s) passaram.`);
