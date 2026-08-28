/**
 * O RECIBO DO DROP — sem navegador, sem token.
 *
 *   node scripts/test-recibo-do-drop.ts   (== npm run test:recibo)
 */
import assert from "node:assert/strict";

import { reciboDoDrop } from "../modules/nexo/lib/recibo-do-drop.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("o caso que motivou tudo: 200 entraram, 2 não deram para ler", () => {
  assert.equal(
    reciboDoDrop({ lidas: 198, falharam: 2, ignoradas: 0 }),
    "200 recebidas · 198 lidas · 2 falharam",
  );
});

test("o TOTAL é a soma — nunca um número à parte", () => {
  assert.equal(
    reciboDoDrop({ lidas: 10, falharam: 3, ignoradas: 7 }),
    "20 recebidas · 10 lidas · 3 falharam · 7 fora (não são prancha)",
  );
});

test("sem falha e sem descarte, a forma NÃO muda", () => {
  assert.equal(
    reciboDoDrop({ lidas: 24, falharam: 0, ignoradas: 0 }),
    "24 recebidas · 24 lidas",
  );
});

test("zero não vira parcela — 0 falharam gasta a atenção que a linha economiza", () => {
  assert.ok(
    !reciboDoDrop({ lidas: 5, falharam: 0, ignoradas: 2 }).includes(
      "0 falharam",
    ),
  );
});

test("uma folha só fala no singular", () => {
  assert.equal(
    reciboDoDrop({ lidas: 0, falharam: 1, ignoradas: 0 }),
    "1 recebida · 0 lidas · 1 falhou",
  );
});

console.log(`\n${passed} ok`);
