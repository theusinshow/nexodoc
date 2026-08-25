/**
 * O CONTRATO SSE DA ROTA.
 *
 * Sem servidor, sem banco e sem token: as duas funções puras que a rota usa.
 * O caso que justifica o teste é o do delta com quebra dupla — ele partiria o
 * evento em dois, e o cliente leria metade da frase como um evento sem `type`.
 *
 *   node scripts/test-chat-rota.ts  (== npm run test:chat:rota)
 */
import assert from "node:assert/strict";

import { linhaSse, respostaDoModelo } from "../app/api/audit/chat/serializacao.ts";

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

test("cada evento vira UMA linha data:, terminada em linha em branco", () => {
  const linha = linhaSse({ type: "delta", text: "ok" });
  assert.ok(linha.startsWith("data: "));
  assert.ok(linha.endsWith("\n\n"));
  assert.equal(linha.split("\n\n").length, 2);
});

test("quebra de linha no texto NAO parte o evento SSE", () => {
  const linha = linhaSse({ type: "delta", text: "primeira\n\nsegunda" });
  const corpo = linha.slice("data: ".length, -2);
  assert.deepEqual(JSON.parse(corpo).text, "primeira\n\nsegunda");
  assert.equal(linha.split("\n\n").length, 2);
});

test("respostaDoModelo colhe as function_call da saida da Responses API", () => {
  const r = respostaDoModelo({
    text: "",
    response: {
      output: [
        { type: "reasoning", id: "r1" },
        { type: "function_call", call_id: "c1", name: "ler_paginas", arguments: '{"de":1,"ate":2}' },
      ],
    },
  });
  assert.equal(r.output.length, 2);
  assert.equal(r.output.filter((i) => i.type === "function_call").length, 1);
  // Texto vazio numa volta de ferramenta NAO e erro.
  assert.equal(r.text, "");
});

test("respostaDoModelo cai no output_text quando o runner nao trouxe texto", () => {
  const r = respostaDoModelo({
    text: "",
    response: { output_text: "resposta final", output: [] },
  });
  assert.equal(r.text, "resposta final");
});

console.log(`\n${passed} teste(s) da rota do chat OK`);
