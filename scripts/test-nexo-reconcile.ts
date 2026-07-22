/**
 * Smoke-test da reconciliação de folhas por ORDEM DE PÁGINA (endurece a leitura
 * de selo em PDF combinado, onde o OCR devolve "16" repetido).
 *
 *   node scripts/test-nexo-reconcile.ts   (== npm run test:nexo:reconcile)
 *
 * Testa o núcleo PURO `reconcileByPageOrder` (sem imports), rodável com node cru.
 */
import assert from "node:assert/strict";

import { reconcileByPageOrder, type SheetItem } from "../server/nexo/reconcile-sheets.ts";

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

const items = (cands: (number | null)[]): SheetItem[] =>
  cands.map((candidate, i) => ({ pageNumber: i + 1, candidate }));

test("sem duplicatas -> mantém os candidatos", () => {
  const r = reconcileByPageOrder(items([1, 2, 3, 4, 5]));
  assert.deepEqual(r, [1, 2, 3, 4, 5]);
});

test("um item só -> mantém", () => {
  assert.deepEqual(reconcileByPageOrder(items([7])), [7]);
});

test("OCR devolve 16 repetido -> reatribui pela ordem de página (offset 0)", () => {
  // páginas 1..16, várias lidas como 16; âncoras únicas dão offset 0.
  const cands = [1, 2, 3, 4, 16, 6, 16, 8, 16, 10, 16, 12, 13, 16, 16, 16];
  const r = reconcileByPageOrder(items(cands));
  assert.deepEqual(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
});

test("capa/índice antes das pranchas -> folha <= 0 vira null (offset negativo)", () => {
  // páginas 1,2 = capa/índice; 3..7 = folhas 1..5 (offset -2). Alguns 5 duplicados.
  const its: SheetItem[] = [
    { pageNumber: 1, candidate: null }, // capa
    { pageNumber: 2, candidate: 5 }, // índice lê "5" (dup)
    { pageNumber: 3, candidate: 1 }, // folha 1 (âncora)
    { pageNumber: 4, candidate: 2 }, // folha 2 (âncora)
    { pageNumber: 5, candidate: 5 }, // folha 3, mas OCR leu 5 (dup)
    { pageNumber: 6, candidate: 4 }, // folha 4 (âncora)
    { pageNumber: 7, candidate: 5 }, // folha 5, OCR leu 5 (dup)
  ];
  const r = reconcileByPageOrder(its);
  // offset dominante = -2 (âncoras 1@p3,2@p4,4@p6). folha = página - 2.
  assert.deepEqual(r, [null, null, 1, 2, 3, 4, 5]);
});

test("sem âncora (tudo duplicado) -> rank puro por página", () => {
  const r = reconcileByPageOrder(items([9, 9, 9, 9]));
  assert.deepEqual(r, [1, 2, 3, 4]);
});

console.log(`\n${passed} teste(s) passaram.`);
