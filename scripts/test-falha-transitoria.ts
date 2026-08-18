/**
 * RETENTAR O QUE PASSA, NÃO O QUE FICA.
 *
 * O caso que originou o módulo: 18/08/2026, leitura global do 117_25 morta aos
 * 310s com "503 Our servers are currently overloaded", e a corrida idêntica
 * seguinte entregando 58 achados.
 *
 *   node scripts/test-falha-transitoria.ts   (== npm run test:falha-transitoria)
 */
import assert from "node:assert/strict";

import {
  comRetentativa,
  ehFalhaTransitoria,
  esperaDaTentativa,
  mensagemDoErro,
  TENTATIVAS_PADRAO,
} from "../lib/falha-transitoria.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

test("o caso real: 503 com o código só na mensagem", () => {
  // Foi exatamente assim que ele chegou — sem `status`, o código no texto.
  const erro = new Error("503 Our servers are currently overloaded. Please try again later.");
  assert.equal(ehFalhaTransitoria(erro), true);
});

test("429 e 500 estruturados também passam", () => {
  assert.equal(ehFalhaTransitoria({ status: 429, message: "rate limited" }), true);
  assert.equal(ehFalhaTransitoria({ statusCode: 500, message: "internal" }), true);
});

test("queda de conexão é transitória", () => {
  assert.equal(ehFalhaTransitoria(new Error("ECONNRESET")), true);
  assert.equal(ehFalhaTransitoria(new Error("fetch failed")), true);
});

test("truncagem NÃO é retentável — repetir só cobra de novo", () => {
  /*
   * É a falha mais cara que existe: queima o teto inteiro em raciocínio e
   * devolve zero achado. Medido em 17/08 — 20 blocos truncados somaram 120.000
   * tokens de saída e US$ 4,32. Retentar multiplicaria a perda.
   */
  assert.equal(ehFalhaTransitoria(new Error("incomplete_max_output_tokens")), false);
  assert.equal(ehFalhaTransitoria(new Error("resposta invalida do modelo")), false);
});

test("erro de credencial ou de pedido NÃO é retentável", () => {
  assert.equal(ehFalhaTransitoria({ status: 401, message: "unauthorized" }), false);
  assert.equal(ehFalhaTransitoria({ status: 400, message: "invalid_request" }), false);
});

test("marca definitiva vence marca transitória na mesma mensagem", () => {
  /*
   * O provedor costuma anexar "please try again" a mensagens de erro de pedido.
   * Sem a precedência, a dica dele nos faria repetir uma falha determinística.
   */
  const erro = new Error("invalid_request: context_length exceeded. Please try again.");
  assert.equal(ehFalhaTransitoria(erro), false);
});

test("erro desconhecido não é retentado", () => {
  // O padrão é não gastar de novo: só repete o que se reconhece como passageiro.
  assert.equal(ehFalhaTransitoria(new Error("algo estranho aconteceu")), false);
  assert.equal(ehFalhaTransitoria(null), false);
});

test("a espera recua e tem teto", () => {
  assert.equal(esperaDaTentativa(1), 2_000);
  assert.equal(esperaDaTentativa(2), 4_000);
  assert.equal(esperaDaTentativa(3), 8_000);
  assert.equal(esperaDaTentativa(9), 8_000, "não pode comer o orçamento da chamada");
});

test("a mensagem é extraída de string, Error e objeto solto", () => {
  assert.equal(mensagemDoErro("texto"), "texto");
  assert.equal(mensagemDoErro(new Error("boom")), "boom");
  assert.equal(mensagemDoErro({ message: "obj" }), "obj");
});

/** Igual ao `test`, para o que precisa de await. */
async function testAsync(name: string, fn: () => Promise<void>) {
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

/** Não dorme de verdade: teste que espera 2s+4s não é teste, é atraso. */
const semDormir = async () => {};

await testAsync("o caso de 18/08: 503 na primeira, sucesso na segunda", async () => {
  let n = 0;
  const r = await comRetentativa(
    async () => {
      n++;
      if (n === 1) {
        throw new Error("503 Our servers are currently overloaded. Please try again later.");
      }
      return "58 achados";
    },
    { dormir: semDormir },
  );
  assert.equal(r, "58 achados");
  assert.equal(n, 2, "tentou exatamente duas vezes");
});

await testAsync("sucesso de primeira não repete nada", async () => {
  let n = 0;
  await comRetentativa(
    async () => {
      n++;
      return "ok";
    },
    { dormir: semDormir },
  );
  assert.equal(n, 1);
});

await testAsync("falha definitiva não é repetida — e o erro sobe", async () => {
  let n = 0;
  await assert.rejects(
    () =>
      comRetentativa(
        async () => {
          n++;
          throw new Error("incomplete_max_output_tokens");
        },
        { dormir: semDormir },
      ),
    /max_output_tokens/,
  );
  assert.equal(n, 1, "truncagem não pode ser repetida: repetir só cobra de novo");
});

await testAsync("503 sem parar: desiste no teto e propaga o último erro", async () => {
  let n = 0;
  await assert.rejects(
    () =>
      comRetentativa(
        async () => {
          n++;
          throw new Error("503 overloaded");
        },
        { dormir: semDormir },
      ),
    /503/,
  );
  assert.equal(n, TENTATIVAS_PADRAO, "não tenta para sempre");
});

await testAsync("cada repetição é anunciada, com espera crescente", async () => {
  const avisos: number[] = [];
  await assert.rejects(() =>
    comRetentativa(
      async () => {
        throw new Error("503 overloaded");
      },
      { dormir: semDormir, aoRepetir: (_e, _n, espera) => avisos.push(espera) },
    ),
  );
  // Duas repetições para três tentativas, e o recuo aparece.
  assert.deepEqual(avisos, [2_000, 4_000]);
});

console.log(`\n${passed} teste(s) de falha transitória OK`);
