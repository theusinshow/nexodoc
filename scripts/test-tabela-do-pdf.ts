/**
 * A GRADE DA TABELA, reconstruída das coordenadas que o pdf.js já entrega.
 *
 * A camada determinística inteira da auditoria é ancorada em PROSA e os achados
 * numéricos do benchmark moram em TABELA. `ExtractedPdfPage` era `{ page, text }`
 * e o `transform[4]`/`[5]` de cada item ia para o lixo.
 *
 *   node scripts/test-tabela-do-pdf.ts   (== npm run test:tabela-do-pdf)
 */
import assert from "node:assert/strict";

import { linhasDaPagina } from "../lib/tabela-do-pdf.ts";
import type { ItemDeTexto } from "../lib/texto-do-pdf.ts";

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

/** Item com corpo de fonte 10, na posição (x, y) e com a largura medida. */
function item(str: string, x: number, y: number, largura = str.length * 5): ItemDeTexto {
  return { str, transform: [10, 0, 0, 10, x, y], width: largura, height: 10 };
}

test("itens no mesmo y viram uma linha só", () => {
  const linhas = linhasDaPagina([item("AMBIENTE", 50, 700), item("AREA", 300, 700)]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].itens.length, 2);
});

test("degrau no y abre linha nova", () => {
  const linhas = linhasDaPagina([
    item("AMBIENTE", 50, 700),
    item("Sala 1", 50, 680),
    item("Sala 2", 50, 660),
  ]);
  assert.equal(linhas.length, 3);
});

test("o marcador hasEOL do pdf.js também fecha a linha", () => {
  const linhas = linhasDaPagina([
    item("Sala 1", 50, 700),
    { str: "", transform: [10, 0, 0, 10, 0, 700], width: 0, height: 10, hasEOL: true },
    item("Sala 2", 50, 700),
  ]);
  assert.equal(linhas.length, 2);
});

test("item vazio sem hasEOL é descartado, não vira linha", () => {
  const linhas = linhasDaPagina([
    item("Sala 1", 50, 700),
    { str: "", transform: [10, 0, 0, 10, 0, 700], width: 0, height: 10 },
    item("Sala 2", 200, 700),
  ]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].itens.length, 2);
});

test("página vazia não quebra", () => {
  assert.deepEqual(linhasDaPagina([]), []);
});

console.log(`\n${passed} teste(s) de tabela do PDF OK`);
