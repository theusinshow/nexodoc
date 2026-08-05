/**
 * Teste dos núcleos puros da CONFERÊNCIA DO VOLUME MONTADO.
 *
 *   node scripts/test-nexo-volume-check.ts   (== npm run test:nexo:volume-check)
 */
import assert from "node:assert/strict";

import { paginasDaParte } from "../server/nexo/volume-plano.ts";

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

// ---------------------------------------------------------------------------
// Task 1 — quantas páginas cada parte contribui
// ---------------------------------------------------------------------------

test("sem faixa, a parte contribui o documento inteiro", () => {
  assert.equal(paginasDaParte(7), 7);
});

test("com faixa, conta só o intervalo (1-based e inclusivo)", () => {
  assert.equal(paginasDaParte(10, 4, 6), 3);
  assert.equal(paginasDaParte(10, 1, 1), 1);
});

test("faixa que estoura o fim do documento para na última página", () => {
  // O selo mentiu a página. `buildRowPdf` copia só o que existe, e a conta
  // aqui tem de bater com o que ele copiou.
  assert.equal(paginasDaParte(10, 4, 99), 7);
});

test("faixa que começa antes da primeira página começa em 1", () => {
  assert.equal(paginasDaParte(10, 0, 3), 3);
  assert.equal(paginasDaParte(10, -5, 2), 2);
});

test("faixa invertida não vira contagem negativa", () => {
  assert.equal(paginasDaParte(10, 8, 3), 0);
});

test("documento vazio ou inválido contribui zero", () => {
  assert.equal(paginasDaParte(0), 0);
  assert.equal(paginasDaParte(Number.NaN), 0);
});

console.log(`\n${passed} teste(s) ok`);
