/**
 * Trava a leitura de falha de provedor.
 *
 * O caso que motivou o teste: auditoria PADRÃO de memorial (084_25_est_md.pdf,
 * 11/08/2026) morreu duas vezes com "O modelo configurado para OpenAI não está
 * disponível". O modelo estava lá; o que aconteceu foi um BLOCO estourando o
 * teto de saída. Um erro de truncagem NÃO pode ser anunciado como modelo
 * indisponível, e precisa ser reconhecido como degradável.
 *
 * Roda sem framework:
 *   node scripts/test-ai-failure-policy.ts
 * (também exposto como `npm run test:ai-failure`)
 */
import assert from "node:assert/strict";

import {
  classifyProviderErrorCategory,
  isInvalidProviderResponseError,
} from "../lib/ai-failure-policy.ts";

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

/** Cópia fiel do que `extractOutputText` joga quando a resposta trunca. */
function truncado() {
  const error = new Error(
    "incomplete_max_output_tokens: A resposta do modelo não foi concluída.",
  ) as Error & { code?: string; type?: string };
  error.code = "incomplete_max_output_tokens";
  error.type = "invalid_response";
  return error;
}

/** Cópia fiel de `createInvalidProviderResponseError` + mensagem da etapa. */
function jsonIlegivel() {
  const error = new Error("Resposta inválida do modelo na etapa audit-global.") as Error & {
    code?: string;
  };
  error.code = "invalid_response";
  return error;
}

test("truncagem de saída NÃO é modelo indisponível", () => {
  assert.equal(classifyProviderErrorCategory(truncado()), "invalid_response");
});

test("truncagem de saída é degradável (a etapa cai, a auditoria segue)", () => {
  assert.equal(isInvalidProviderResponseError(truncado()), true);
});

test("JSON ilegível continua sendo resposta inválida", () => {
  assert.equal(classifyProviderErrorCategory(jsonIlegivel()), "invalid_response");
  assert.equal(isInvalidProviderResponseError(jsonIlegivel()), true);
});

test("recusa do modelo é degradável", () => {
  const error = new Error("refusal: O modelo recusou a solicitação.") as Error & {
    code?: string;
    type?: string;
  };
  error.code = "refusal";
  error.type = "invalid_response";
  assert.equal(isInvalidProviderResponseError(error), true);
  assert.equal(classifyProviderErrorCategory(error), "invalid_response");
});

test("modelo inexistente continua caindo em model_unavailable", () => {
  const error = new Error("The model `gpt-inexistente` does not exist.") as Error & {
    status?: number;
    code?: string;
  };
  error.status = 404;
  error.code = "model_not_found";
  assert.equal(classifyProviderErrorCategory(error), "model_unavailable");
  assert.equal(isInvalidProviderResponseError(error), false);
});

test("credencial, quota, limite e tempo limite não mudaram", () => {
  const auth = Object.assign(new Error("Incorrect API key provided"), { status: 401 });
  assert.equal(classifyProviderErrorCategory(auth), "authentication");

  const quota = Object.assign(new Error("You exceeded your current quota"), {
    code: "insufficient_quota",
  });
  assert.equal(classifyProviderErrorCategory(quota), "quota_billing");

  const rate = Object.assign(new Error("Rate limit reached"), { status: 429 });
  assert.equal(classifyProviderErrorCategory(rate), "rate_limit");

  const abort = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  assert.equal(classifyProviderErrorCategory(abort), "timeout");
});

test("credencial vence truncagem quando as duas pistas aparecem", () => {
  // 401 não é degradável de jeito nenhum: a próxima etapa morreria igual.
  const error = truncado() as Error & { status?: number };
  error.status = 401;
  assert.equal(classifyProviderErrorCategory(error), "authentication");
});

test("erro sem pista nenhuma continua desconhecido", () => {
  assert.equal(classifyProviderErrorCategory(new Error("boom")), "unknown");
});

console.log(`\n${passed} teste(s) de política de falha de IA passaram.`);
