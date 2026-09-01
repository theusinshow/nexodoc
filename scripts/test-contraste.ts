/**
 * A RAZÃO DE CONTRASTE, pela fórmula da WCAG. Puro → node cru.
 *
 *   node scripts/test-contraste.ts   (== npm run test:contraste)
 */
import assert from "node:assert/strict";

import { contraste, lerCor, luminancia } from "../lib/contraste.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

/** Duas casas bastam: a régua é 4,5 e ninguém decide nada no terceiro decimal. */
const perto = (a: number, b: number) => Math.abs(a - b) < 0.01;

console.log("contraste\n");

test("branco sobre preto é 21:1 — o teto da escala", () => {
  assert.ok(perto(contraste("#ffffff", "#000000"), 21));
});

test("a mesma cor contra ela mesma é 1:1", () => {
  assert.ok(perto(contraste("#121518", "#121518"), 1));
});

test("a ordem não muda o resultado", () => {
  const a = contraste("#e1e7ea", "#121518");
  const b = contraste("#121518", "#e1e7ea");
  assert.ok(perto(a, b), `${a} != ${b}`);
});

test("o texto do produto sobre o cartão passa de 4,5:1", () => {
  // --foreground #e1e7ea sobre --card #121518. É o par mais comum da tela, e se
  // ELE não passasse, a régua estaria errada e não o produto.
  assert.ok(contraste("#e1e7ea", "#121518") > 4.5);
});

test("lê hex de 3 e de 6 dígitos como a mesma cor", () => {
  assert.deepEqual(lerCor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(lerCor("#ffffff"), { r: 255, g: 255, b: 255 });
});

test("lê o que o navegador devolve: rgb() e rgba()", () => {
  /*
   * `getComputedStyle` nunca devolve hex — devolve `rgb(18, 21, 24)`. Uma régua
   * que só lesse hex passaria verde sem medir nada.
   */
  assert.deepEqual(lerCor("rgb(18, 21, 24)"), { r: 18, g: 21, b: 24 });
  assert.deepEqual(lerCor("rgba(18, 21, 24, 0.5)"), { r: 18, g: 21, b: 24 });
});

test("cor ilegível devolve ZERO, e zero reprova", () => {
  /*
   * Nunca 21. Um valor que a régua não entende tem de FALHAR a checagem, não
   * passar por ela — senão a prova fica verde exatamente onde ela deixou de
   * medir.
   */
  assert.equal(contraste("transparent", "#000000"), 0);
  assert.equal(contraste("var(--card)", "#000000"), 0);
  assert.equal(lerCor("transparent"), null);
});

test("a luminância do preto é 0 e a do branco é 1", () => {
  assert.ok(perto(luminancia({ r: 0, g: 0, b: 0 }), 0));
  assert.ok(perto(luminancia({ r: 255, g: 255, b: 255 }), 1));
});

console.log(`\n${passed} passaram`);
