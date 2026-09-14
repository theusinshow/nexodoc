/**
 * Teste da RESPOSTA EM SEGUNDO PLANO — a chamada longa que não depende de uma
 * conexão aberta.
 *
 * Em 14/09/2026 a leitura global do 117_25 ficou 900s pendurada em produção e
 * voltou com zero token. No banco de produção, das 77 leituras globais que
 * passaram nenhuma levou mais que 338s, e as 4 que cruzaram ~350s morreram
 * todas: uma requisição HTTP muda por minutos não sobrevive ao caminho até a
 * OpenAI. Em segundo plano a criação volta em segundos e cada consulta também —
 * nenhuma conexão fica calada tempo bastante para ser cortada.
 *
 * O que se prova aqui é o laço, com um cliente falso: termina no estado final,
 * aguenta consulta que falha, e cancela no provedor quando o prazo acaba — sem
 * isso o modelo seguiria gerando (e cobrando) uma resposta que ninguém lê.
 *
 *   node scripts/test-resposta-em-segundo-plano.ts
 */
import assert from "node:assert/strict";

import {
  type ClienteDeRespostas,
  respostaEmSegundoPlano,
} from "../lib/resposta-em-segundo-plano.ts";

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

type Resp = { id: string; status: string; output_text?: string; error?: { message?: string; code?: string } | null };

function clienteFalso(estados: Array<Resp | Error>) {
  const chamadas = { create: [] as unknown[], createOpts: [] as unknown[], retrieve: 0, cancel: [] as string[] };
  let i = 0;
  const cliente: ClienteDeRespostas = {
    async create(body, opts) {
      chamadas.create.push(body);
      chamadas.createOpts.push(opts);
      return { id: "resp_1", status: "queued" };
    },
    async retrieve() {
      chamadas.retrieve++;
      const proximo = estados[Math.min(i, estados.length - 1)];
      i++;
      if (proximo instanceof Error) throw proximo;
      return proximo;
    },
    async cancel(id) {
      chamadas.cancel.push(id);
      return {};
    },
  };
  return { cliente, chamadas };
}

const semEspera = async () => {};

await test("pede background e não deixa o SDK reenviar a criação sozinho", async () => {
  const { cliente, chamadas } = clienteFalso([{ id: "resp_1", status: "completed", output_text: "{}" }]);
  await respostaEmSegundoPlano({
    cliente,
    request: { model: "m", input: "x" },
    signal: new AbortController().signal,
    esperar: semEspera,
  });
  assert.equal((chamadas.create[0] as { background?: boolean }).background, true);
  // Reenvio silencioso cria DUAS respostas no provedor, e as duas cobram.
  assert.equal((chamadas.createOpts[0] as { maxRetries?: number }).maxRetries, 0);
});

await test("consulta até o estado final e devolve a resposta concluída", async () => {
  const { cliente, chamadas } = clienteFalso([
    { id: "resp_1", status: "in_progress" },
    { id: "resp_1", status: "in_progress" },
    { id: "resp_1", status: "completed", output_text: "ok" },
  ]);
  const r = await respostaEmSegundoPlano({
    cliente,
    request: {},
    signal: new AbortController().signal,
    esperar: semEspera,
  });
  assert.equal(r.status, "completed");
  assert.equal((r as Resp).output_text, "ok");
  assert.equal(chamadas.retrieve, 3);
});

await test("resposta incompleta volta como está: quem lê o texto decide", async () => {
  const { cliente } = clienteFalso([{ id: "resp_1", status: "incomplete" }]);
  const r = await respostaEmSegundoPlano({
    cliente,
    request: {},
    signal: new AbortController().signal,
    esperar: semEspera,
  });
  assert.equal(r.status, "incomplete");
});

await test("consulta que falha algumas vezes não derruba a análise", async () => {
  const { cliente } = clienteFalso([
    new Error("socket hang up"),
    new Error("ECONNRESET"),
    { id: "resp_1", status: "completed", output_text: "ok" },
  ]);
  const r = await respostaEmSegundoPlano({
    cliente,
    request: {},
    signal: new AbortController().signal,
    esperar: semEspera,
  });
  assert.equal(r.status, "completed");
});

await test("falhas seguidas demais desistem com o erro da consulta", async () => {
  const { cliente } = clienteFalso([new Error("fora do ar")]);
  await assert.rejects(
    respostaEmSegundoPlano({
      cliente,
      request: {},
      signal: new AbortController().signal,
      esperar: semEspera,
      falhasSeguidasToleradas: 3,
    }),
    /fora do ar/,
  );
});

await test("status failed vira erro com a mensagem do provedor", async () => {
  const { cliente } = clienteFalso([
    { id: "resp_1", status: "failed", error: { message: "server_error lá", code: "server_error" } },
  ]);
  await assert.rejects(
    respostaEmSegundoPlano({
      cliente,
      request: {},
      signal: new AbortController().signal,
      esperar: semEspera,
    }),
    /server_error lá/,
  );
});

await test("prazo esgotado CANCELA no provedor e acusa tempo esgotado", async () => {
  const { cliente, chamadas } = clienteFalso([{ id: "resp_1", status: "in_progress" }]);
  const controller = new AbortController();
  let voltas = 0;
  await assert.rejects(
    respostaEmSegundoPlano({
      cliente,
      request: {},
      signal: controller.signal,
      esperar: async () => {
        voltas++;
        if (voltas === 3) controller.abort();
      },
    }),
    (err: Error) => /tempo/i.test(err.message) && err.name === "AbortError",
  );
  assert.deepEqual(chamadas.cancel, ["resp_1"]);
});

console.log(`\n${passed} teste(s) passaram`);
