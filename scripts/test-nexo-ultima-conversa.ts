/**
 * QUANDO REABRIR A ÚLTIMA CONVERSA — e quando NÃO.
 *
 * O F5 virava conversa nova, e o trabalho seguinte virava outra linha na barra:
 * quatro "MET" na mesma pasta, do mesmo volume. Ver `ultima-conversa.ts`.
 *
 * Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-ultima-conversa.ts   (== npm run test:nexo:ultima)
 */
import assert from "node:assert/strict";

import { deveRestaurar } from "../modules/nexo/lib/ultima-conversa.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

test("abertura normal restaura", () => {
  assert.equal(deveRestaurar(""), true);
  assert.equal(deveRestaurar("?"), true);
});

test("link de parecer MANDA — não se restaura por cima dele", () => {
  /*
   * Quem abre `/nexo?auditoria=<id>` pediu um parecer específico. Reabrir o
   * último trabalho por cima jogaria fora o link que a pessoa acabou de clicar
   * — o mesmo defeito que o `?auditoria=` já teve uma vez.
   */
  assert.equal(deveRestaurar("?auditoria=abc-123"), false);
});

test("intenção declarada também manda: veio começar, não continuar", () => {
  assert.equal(deveRestaurar("?intencao=auditar"), false);
});

test("outros parâmetros não impedem a restauração", () => {
  assert.equal(deveRestaurar("?utm_source=email&ref=x"), true);
});

test("parâmetro presente e VAZIO não conta como pedido", () => {
  // `/nexo?auditoria=` não nomeia parecer nenhum: restaurar é o certo.
  assert.equal(deveRestaurar("?auditoria="), true);
});

console.log(`\n${passed} teste(s) ok`);
