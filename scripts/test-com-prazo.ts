/**
 * PROMESSA PENDENTE VIRA ERRO COM MOTIVO.
 *
 * 17/09/2026: a gravação do memorial de Urubici (26,8 MB) ficou pendente para
 * sempre. Sem rejeição, o `catch` de quem chamou nunca rodou e o usuário não
 * soube de nada — o cartão só pedia o PDF de novo.
 *
 *   node scripts/test-com-prazo.ts   (== npm run test:com-prazo)
 */
import assert from "node:assert/strict";

import { comPrazo } from "../modules/nexo/lib/com-prazo.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

await test("promessa que resolve a tempo passa direto", async () => {
  assert.equal(await comPrazo(Promise.resolve("ok"), 50, "o memorial"), "ok");
});

await test("REGRESSÃO Urubici: promessa pendente vira erro com o que e o prazo", async () => {
  const nunca = new Promise<void>(() => {});
  await assert.rejects(comPrazo(nunca, 30, "031_26_md_geral_a.pdf"), (err: Error) => {
    assert.match(err.message, /031_26_md_geral_a\.pdf/);
    assert.match(err.message, /não respondeu/);
    return true;
  });
});

await test("rejeição de verdade continua chegando como ela é", async () => {
  await assert.rejects(comPrazo(Promise.reject(new Error("QuotaExceeded")), 50, "x"), {
    message: "QuotaExceeded",
  });
});

await test("o relógio não segura o processo depois de resolver", async () => {
  const inicio = Date.now();
  await comPrazo(Promise.resolve(1), 5_000, "x");
  // Sem o clearTimeout, o node ficaria vivo 5s esperando o timer.
  assert.ok(Date.now() - inicio < 1_000);
});

console.log(`\n${passed} teste(s) de prazo OK`);
