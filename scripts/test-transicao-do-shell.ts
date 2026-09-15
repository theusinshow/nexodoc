/**
 * A TRANSIÇÃO DO SHELL AVISA QUANDO A TROCA DE DOM ACONTECEU — 15/09/2026, a8.
 *
 * `document.startViewTransition(apply)` NÃO roda `apply` na hora: o navegador
 * tira o instantâneo da tela velha e só depois, quadros adiante, chama o
 * callback. `selectConv` limpava o memorial dentro desse callback e, na linha de
 * baixo, pedia o memorial retido ao IndexedDB — que voltava ANTES. Medido na
 * bateria (a8, aba 2 e F5): transição pedida em 931ms, memorial devolvido em
 * 997ms, callback zerando em 1018ms. O "Auditar" da conversa restaurada nascia
 * cinza e ficava assim.
 *
 * A regra: `runShellTransition` devolve uma promessa que só resolve DEPOIS de
 * `apply` ter rodado. Quem restaura algo por cima da limpeza espera por ela.
 *
 *   node scripts/test-transicao-do-shell.ts
 */
import assert from "node:assert/strict";

import { runShellTransition } from "../modules/nexo/lib/motion.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const g = globalThis as unknown as { document?: unknown };

/** Um navegador com view transitions que chama o callback `atrasoMs` depois. */
function navegadorComTransicao(atrasoMs: number) {
  g.document = {
    startViewTransition(callback: () => void) {
      const feito = new Promise<void>((resolve) =>
        setTimeout(() => {
          try {
            callback();
          } catch {
            // o navegador engole e rejeita `updateCallbackDone`; aqui só não derruba o node
          }
          resolve();
        }, atrasoMs),
      );
      return { ready: feito, finished: feito, updateCallbackDone: feito };
    },
  };
}

await test("com view transition, a restauração que espera a promessa vence a limpeza atrasada", async () => {
  navegadorComTransicao(30);
  let memorial: string | null = "memorial da conversa anterior";
  const limpou = runShellTransition(() => {
    memorial = null;
  });
  // O IndexedDB devolve o memorial retido antes do callback (o caso medido).
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(memorial, "memorial da conversa anterior", "o callback ainda não rodou: é esta a janela");
  await limpou;
  memorial = "memorial retido";
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(memorial, "memorial retido");
});

await test("a promessa não resolve antes de o callback rodar", async () => {
  navegadorComTransicao(30);
  let aplicou = false;
  let resolveuAntes = false;
  const p = runShellTransition(() => {
    aplicou = true;
  });
  void p.then(() => {
    resolveuAntes = !aplicou;
  });
  await p;
  assert.equal(aplicou, true);
  assert.equal(resolveuAntes, false);
});

await test("callback que explode ainda resolve: a restauração não fica pendurada", async () => {
  navegadorComTransicao(10);
  const p = runShellTransition(() => {
    throw new Error("flushSync derrubou");
  });
  const venceu = await Promise.race([p.then(() => "resolveu"), new Promise((r) => setTimeout(() => r("pendurou"), 200))]);
  assert.equal(venceu, "resolveu");
});

await test("sem view transitions, aplica na hora e a promessa já nasce cumprida depois do apply", async () => {
  g.document = {};
  let aplicou = false;
  const p = runShellTransition(() => {
    aplicou = true;
  });
  assert.equal(aplicou, true);
  await p;
});

delete g.document;
console.log(`\n${passed} testes passaram`);
