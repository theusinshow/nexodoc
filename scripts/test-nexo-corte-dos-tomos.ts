/**
 * O CORTE DOS TOMOS (16/10/2026): a régua converte a divisão em cortes e de
 * volta. O caso que trouxe isto: 5 pranchas de uma disciplina e 20 de outra,
 * que o automático divide parelho e o engenheiro quer 15 + 10.
 *
 *   node scripts/test-nexo-corte-dos-tomos.ts
 */
import assert from "node:assert/strict";

import {
  criarCorte, cortesDasFaixas, faixasDosCortes, moverCorte, patchesDosCortes, pesoDasFaixas, removerCorte,
} from "../modules/nexo/lib/corte-dos-tomos.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FALHOU  ${name}`); console.error(err instanceof Error ? err.message : err); process.exitCode = 1; }
}

const ids = (pref: string, n: number) => Array.from({ length: n }, (_, i) => `${pref}${i + 1}`);
const fnd = ids("fnd", 5);
const est = ids("est", 20);

test("ida e volta: faixas → cortes → faixas", () => {
  const faixas = [[...fnd, ...est.slice(0, 7)], est.slice(7, 14), est.slice(14)];
  const { sequencia, cortes } = cortesDasFaixas(faixas);
  assert.deepEqual(cortes, [12, 19]);
  assert.deepEqual(faixasDosCortes(sequencia, cortes), faixas);
});

test("o caso do Matheus: 5 + 20 cortado em 15 dá [15, 10]", () => {
  const { sequencia } = cortesDasFaixas([[...fnd, ...est]]);
  const cortes = criarCorte([], 15, sequencia.length);
  assert.deepEqual(faixasDosCortes(sequencia, cortes).map((f) => f.length), [15, 10]);
});

test("mover não atravessa a vizinha", () => {
  assert.deepEqual(moverCorte([10, 20], 0, 25, 30), [20]); // encostou: juntou
  assert.deepEqual(moverCorte([10, 20], 0, 15, 30), [15, 20]);
  assert.deepEqual(moverCorte([10, 20], 1, 5, 30), [10]); // passou da vizinha: junta, não cruza
});

test("encostar na borda junta com o tomo de fora", () => {
  assert.deepEqual(moverCorte([10], 0, 0, 30), []);
  assert.deepEqual(moverCorte([10], 0, 30, 30), []);
});

test("criar no vão já cortado ou fora da faixa não faz nada", () => {
  assert.deepEqual(criarCorte([10], 10, 30), [10]);
  assert.deepEqual(criarCorte([10], 0, 30), [10]);
  assert.deepEqual(criarCorte([10], 30, 30), [10]);
  assert.deepEqual(criarCorte([10], 4, 30), [4, 10]);
});

test("remover corte junta os dois tomos", () => {
  assert.deepEqual(removerCorte([4, 10], 0), [10]);
});

test("patches: toda folha ganha o tomo (a divisão congela)", () => {
  const p = patchesDosCortes(["a", "b", "c", "d"], [1, 3]);
  assert.deepEqual(p, [
    { id: "a", patch: { grupo: 1 } },
    { id: "b", patch: { grupo: 2 } },
    { id: "c", patch: { grupo: 2 } },
    { id: "d", patch: { grupo: 3 } },
  ]);
});

test("nenhum tomo vazio sai dos cortes", () => {
  const faixas = faixasDosCortes(["a", "b", "c"], [1, 2]);
  assert.ok(faixas.every((f) => f.length > 0));
});

test("peso: soma por faixa, null quando falta o tamanho de alguma folha", () => {
  const bytes: Record<string, number> = { a: 10, b: 20, c: 5 };
  assert.deepEqual(pesoDasFaixas([["a", "b"], ["c", "x"]], (id) => bytes[id] ?? null), [30, null]);
});

console.log(`\n${passed} teste(s) ok.`);
