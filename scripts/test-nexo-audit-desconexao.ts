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
  AcessoNegadoNaAuditoria,
  AuditoriaDesconectada,
  SessaoExpiradaNaAuditoria,
  consultarAuditoria,
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

/*
 * 401 NÃO É DESCONEXÃO NEM BANCO FORA DO AR — 15/09/2026, jornada x1. Com a
 * sessão caída, a largada virava `AuditoriaDesconectada` (bilhete guardado,
 * reconexão eterna) e a reconexão virava "rodando" para sempre, sem a faixa de
 * sessão expirada que o produto já tinha.
 */
await test("401 na largada é sessão expirada, e não desconexão", async () => {
  comFetch(
    async () =>
      new Response(JSON.stringify({ error: "Entre para continuar." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
  );
  await assert.rejects(
    runMemorialAudit(memorial, {}, "deep", null, opcoes),
    (e: Error) =>
      e instanceof SessaoExpiradaNaAuditoria &&
      !(e instanceof AuditoriaDesconectada),
  );
});

await test("reconexão com 401 devolve sem-sessao, e não rodando", async () => {
  comFetch(
    async () =>
      new Response(JSON.stringify({ error: "Entre para continuar." }), {
        status: 401,
      }),
  );
  assert.deepEqual(await consultarAuditoria("abc12345"), {
    situacao: "sem-sessao",
  });
});

await test("reconexão com 503 continua rodando: banco fora do ar é passageiro", async () => {
  comFetch(
    async () =>
      new Response(JSON.stringify({ error: "Banco não respondeu." }), {
        status: 503,
      }),
  );
  assert.deepEqual(await consultarAuditoria("abc12345"), {
    situacao: "rodando",
  });
});

/*
 * 403 NÃO É "RODANDO" NEM DESCONEXÃO — 15/09/2026, revisão final da segunda
 * rodada (R21). Membro desativado ou removido do escritório leva 403: na
 * reconexão caía no "banco fora do ar, continue tentando" e perguntava para
 * sempre; na largada virava "a conexão caiu" e guardava o bilhete de uma
 * análise que o servidor recusou antes de criar.
 */
function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

await test("reconexão com 403 devolve sem-acesso com a frase do servidor", async () => {
  comFetch(async () => json(403, { error: "Sua conta foi desativada neste escritório." }));
  assert.deepEqual(await consultarAuditoria("abc12345"), {
    situacao: "sem-acesso",
    motivo: "Sua conta foi desativada neste escritório.",
  });
});

await test("reconexão com 403 sem corpo diz que o acesso foi suspenso", async () => {
  comFetch(async () => new Response("", { status: 403 }));
  assert.deepEqual(await consultarAuditoria("abc12345"), {
    situacao: "sem-acesso",
    motivo: "Seu acesso a este escritório foi suspenso",
  });
});

await test("reconexão com 400 é irrecuperável, e não rodando", async () => {
  comFetch(async () => json(400, { error: "Id inválido." }));
  const r = await consultarAuditoria("abc12345");
  assert.equal(r.situacao, "irrecuperavel");
});

await test("403 na largada é acesso negado, e não desconexão", async () => {
  comFetch(async () => json(403, { error: "Sua conta foi desativada neste escritório." }));
  await assert.rejects(
    runMemorialAudit(memorial, {}, "deep", null, opcoes),
    (e: Error) =>
      e instanceof AcessoNegadoNaAuditoria &&
      !(e instanceof AuditoriaDesconectada) &&
      /desativada/.test(e.message),
  );
});

for (const status of [400, 404, 413, 422]) {
  await test(`${status} na largada fecha o ciclo: nunca AuditoriaDesconectada`, async () => {
    comFetch(async () => new Response("não é fluxo", { status }));
    await assert.rejects(
      runMemorialAudit(memorial, {}, "deep", null, opcoes),
      (e: Error) => !(e instanceof AuditoriaDesconectada),
    );
  });
}

/*
 * NO MODO DE FLUXO o status HTTP é sempre 200: a recusa do portão chega como
 * `event: error`. O servidor passa a mandar o status junto, e o cliente separa
 * sessão caída e acesso negado de falha do motor.
 */
await test("fluxo com error de status 403 é acesso negado", async () => {
  comFetch(async () =>
    respostaComFluxo([
      `event: error\ndata: {"error":"Sua conta foi desativada.","status":403}\n\n`,
    ]),
  );
  await assert.rejects(
    runMemorialAudit(memorial, {}, "deep", null, opcoes),
    (e: Error) => e instanceof AcessoNegadoNaAuditoria && /desativada/.test(e.message),
  );
});

await test("fluxo com error de status 401 é sessão expirada", async () => {
  comFetch(async () =>
    respostaComFluxo([`event: error\ndata: {"error":"Entre para continuar.","status":401}\n\n`]),
  );
  await assert.rejects(
    runMemorialAudit(memorial, {}, "deep", null, opcoes),
    SessaoExpiradaNaAuditoria,
  );
});

console.log(`\n${passed} testes ok`);
