/**
 * A LARGURA da coluna do copiloto. Núcleo puro → node cru.
 *
 *   node scripts/test-largura-do-copiloto.ts  (== npm run test:nexo:largura)
 */
import assert from "node:assert/strict";

import {
  MAX,
  MIN,
  PADRAO,
  larguraDeDocumento,
  limitar,
} from "../modules/nexo/lib/largura-do-copiloto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("largura do copiloto\n");

test("limitar prende entre MIN e MAX", () => {
  assert.equal(limitar(100), MIN);
  assert.equal(limitar(9999), MAX);
  assert.equal(limitar(520), 520);
});

test("limitar arredonda — a variável CSS não aceita fração de pixel", () => {
  assert.equal(limitar(520.4), 520);
  assert.equal(limitar(520.6), 521);
});

test("o padrão está dentro da faixa", () => {
  assert.equal(limitar(PADRAO), PADRAO);
});

test("a largura de DOCUMENTO é a maior que o shell permite", () => {
  /*
   * Não é número escolhido a dedo: é o teto do próprio shell. Acima de MAX o
   * canvas deixa de caber como área de trabalho, e uma folha mais larga que
   * isso não caberia na tela de qualquer jeito. Se o parágrafo mais largo do
   * modelo ainda quebrar em MAX, o limite é o shell — não esta escolha.
   */
  assert.equal(larguraDeDocumento(), MAX);
  assert.equal(limitar(larguraDeDocumento()), larguraDeDocumento());
});

test("a faixa faz sentido: MIN < PADRAO < MAX", () => {
  assert.ok(MIN < PADRAO, "o padrão não pode ser menor que o mínimo");
  assert.ok(PADRAO < MAX, "o padrão não pode ser maior que o máximo");
});

console.log(`\n${passed} teste(s) passaram.`);
