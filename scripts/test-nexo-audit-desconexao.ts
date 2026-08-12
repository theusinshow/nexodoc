/**
 * FLUXO CORTADO ≠ AUDITORIA FALHADA.
 *
 * A auditoria roda de 3 a 15 minutos no servidor e chega por SSE. Quando o fio
 * cai no meio, o motor NÃO para: ele termina e grava o parecer. Quem chamou
 * precisa distinguir os dois fracassos, porque a consequência é oposta —
 * "falhou" fecha o ciclo, "caiu o fio" tem de GUARDAR o bilhete de retomada.
 *
 * Em 12/08/2026 os dois eram a mesma exceção: uma análise de 39 achados ficou
 * pronta no banco enquanto a tela dizia "network error", e o ponteiro para ela
 * já tinha sido apagado.
 *
 * `audit.ts` só tem import de TIPO, então roda no node cru com um `fetch` de
 * mentira.
 *
 *   node scripts/test-nexo-audit-desconexao.ts
 */
import assert from "node:assert/strict";

import {
  AuditoriaDesconectada,
  runMemorialAudit,
} from "../modules/nexo/lib/audit.ts";

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

const memorial = new File([new Uint8Array([1, 2, 3])], "memorial.pdf", {
  type: "application/pdf",
});

/** Resposta de mentira cujo corpo entrega os blocos SSE dados. */
function respostaComFluxo(blocos: string[]): Response {
  const corpo = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const b of blocos) controller.enqueue(enc.encode(b));
      controller.close();
    },
  });
  return new Response(corpo, { status: 200 });
}

function comFetch(fn: () => Promise<Response>) {
  globalThis.fetch = (async () => fn()) as typeof fetch;
}

const marcos: unknown[] = [];
const opcoes = { onMarco: (m: unknown) => marcos.push(m) } as never;

await test("fluxo que acaba sem done/error -> AuditoriaDesconectada", async () => {
  comFetch(async () =>
    respostaComFluxo([`event: marco\ndata: {"etapa":"lendo"}\n\n`]),
  );
  await assert.rejects(
    () => runMemorialAudit(memorial, {}, "deep", null, opcoes),
    AuditoriaDesconectada,
  );
});

await test("fetch que rejeita (rede) -> AuditoriaDesconectada", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("network error");
  }) as typeof fetch;
  await assert.rejects(
    () => runMemorialAudit(memorial, {}, "deep", null, opcoes),
    AuditoriaDesconectada,
  );
});

await test("erro DO MOTOR não vira desconexão (o ciclo fechou)", async () => {
  comFetch(async () =>
    respostaComFluxo([`event: error\ndata: {"error":"Falha no modelo."}\n\n`]),
  );
  await assert.rejects(
    () => runMemorialAudit(memorial, {}, "deep", null, opcoes),
    (err: unknown) =>
      err instanceof Error &&
      !(err instanceof AuditoriaDesconectada) &&
      /Falha no modelo/.test(err.message),
  );
});

await test("cancelamento do usuário continua sendo AbortError", async () => {
  globalThis.fetch = (async () => {
    throw new DOMException("The user aborted a request.", "AbortError");
  }) as typeof fetch;
  await assert.rejects(
    () => runMemorialAudit(memorial, {}, "deep", null, opcoes),
    (err: unknown) => err instanceof DOMException && err.name === "AbortError",
  );
});

await test("fluxo completo entrega o parecer", async () => {
  const report = { total_incongruencias: 2, incongruencias: [] };
  comFetch(async () =>
    respostaComFluxo([
      `event: marco\ndata: {"etapa":"lendo"}\n\n`,
      `event: done\ndata: ${JSON.stringify({ report, result: "texto", auditId: "abc" })}\n\n`,
    ]),
  );
  const r = await runMemorialAudit(memorial, {}, "deep", null, opcoes);
  assert.equal(r.auditId, "abc");
  assert.equal(r.texto, "texto");
  assert.equal(r.report.total_incongruencias, 2);
});

await test("evento partido em dois pedaços da rede não quebra", async () => {
  const report = { total_incongruencias: 1, incongruencias: [] };
  const inteiro = `event: done\ndata: ${JSON.stringify({ report, result: "t", auditId: "x" })}\n\n`;
  comFetch(async () =>
    respostaComFluxo([inteiro.slice(0, 20), inteiro.slice(20)]),
  );
  const r = await runMemorialAudit(memorial, {}, "deep", null, opcoes);
  assert.equal(r.auditId, "x");
});

console.log(`\n${passed} testes ok`);
