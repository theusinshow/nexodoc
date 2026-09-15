/**
 * A ABA TRAVADA NÃO GASTA — revisão final da segunda rodada, 15/09/2026.
 *
 * Com `conflitoDeVersao` (outra aba ou máquina gravou a conversa depois que esta
 * a abriu, jornada c3), a fila descarta toda gravação desta aba. Auditoria,
 * agente e LD continuavam ligados: a auditoria paga rodava e o parecer nunca era
 * registrado. A regra: aba travada não dispara nada que custa modelo, e diz por
 * quê com a frase da faixa.
 *
 *   node scripts/test-aba-travada.ts
 */
import assert from "node:assert/strict";

import { MOTIVO_ABA_TRAVADA, motivoParaNaoGastar, podeGastar } from "../modules/nexo/lib/aba-travada.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

test("aba sem conflito pode gastar, e não há motivo", () => {
  assert.equal(podeGastar({ conflitoDeVersao: false }), true);
  assert.equal(motivoParaNaoGastar({ conflitoDeVersao: false }), null);
});

test("aba travada pelo conflito de versão não gasta", () => {
  assert.equal(podeGastar({ conflitoDeVersao: true }), false);
});

test("a recusa usa a frase da faixa: a conversa mudou em outra aba", () => {
  assert.equal(motivoParaNaoGastar({ conflitoDeVersao: true }), MOTIVO_ABA_TRAVADA);
  assert.match(MOTIVO_ABA_TRAVADA, /Esta conversa mudou em outra aba/);
  assert.match(MOTIVO_ABA_TRAVADA, /[Rr]ecarregue/);
});

console.log(`\n${passed} teste(s) passaram`);
