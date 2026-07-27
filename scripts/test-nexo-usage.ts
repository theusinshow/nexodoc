/**
 * Smoke-test da agregação do consumo da conversa (por modelo e por tarefa).
 * Núcleo PURO (sem imports de runtime) → roda com node cru.
 *
 *   node scripts/test-nexo-usage.ts   (== npm run test:nexo:usage)
 */
import assert from "node:assert/strict";

import { aggregateUsage, flowLabel } from "../server/nexo/usage/aggregate.ts";

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

test("soma tokens por modelo, maior primeiro", () => {
  const r = aggregateUsage([
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 100, estimatedCostUsd: 0.01 },
    { flow: "ld-extraction", model: "gpt-5-mini", totalTokens: 300, estimatedCostUsd: 0.002 },
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 50, estimatedCostUsd: 0.005 },
  ]);
  assert.deepEqual(
    r.porModelo.map((m) => m.model),
    ["gpt-5-mini", "gpt-5.5"],
  );
  assert.equal(r.porModelo[0].totalTokens, 300);
  assert.equal(r.porModelo[1].totalTokens, 150);
  assert.equal(r.totalTokens, 450);
});

test("mesma tarefa com dois modelos vira DUAS linhas", () => {
  const r = aggregateUsage([
    { flow: "ld-extraction", model: "gpt-5-mini", totalTokens: 200, estimatedCostUsd: null },
    { flow: "ld-extraction", model: "mimo-vl", totalTokens: 80, estimatedCostUsd: null },
  ]);
  assert.equal(r.porTarefa.length, 2);
  assert.deepEqual(
    r.porTarefa.map((t) => t.model),
    ["gpt-5-mini", "mimo-vl"],
  );
  // O rótulo da tarefa se repete — é a troca de modelo que se quer ver.
  assert.equal(r.porTarefa[0].label, "Leitura de selos");
  assert.equal(r.porTarefa[1].label, "Leitura de selos");
});

test("custo: nenhum evento com preço -> total nulo (nao zero)", () => {
  const r = aggregateUsage([
    { flow: "audit", model: "mimo-vl", totalTokens: 10, estimatedCostUsd: null },
  ]);
  assert.equal(r.totalCostUsd, null);
  assert.equal(r.porModelo[0].costUsd, null);
});

test("custo parcial: soma so o que existe", () => {
  const r = aggregateUsage([
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 10, estimatedCostUsd: 0.02 },
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 10, estimatedCostUsd: null },
  ]);
  assert.equal(r.porModelo.length, 1);
  assert.equal(r.porModelo[0].costUsd, 0.02);
  assert.equal(r.totalCostUsd, 0.02);
});

test("lista vazia -> zeros, listas vazias e custo nulo", () => {
  const r = aggregateUsage([]);
  assert.deepEqual(r.porModelo, []);
  assert.deepEqual(r.porTarefa, []);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalCostUsd, null);
});

test("flowLabel: fluxo desconhecido devolve o proprio flow", () => {
  assert.equal(flowLabel("nexo-agent"), "Turnos da conversa");
  assert.equal(flowLabel("fluxo-novo-qualquer"), "fluxo-novo-qualquer");
  assert.equal(flowLabel(""), "");
});

console.log(`\n${passed} teste(s) da agregação de consumo OK.`);
