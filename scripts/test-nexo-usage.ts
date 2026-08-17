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
    { flow: "ld-extraction", model: "modelo-sem-preco", totalTokens: 80, estimatedCostUsd: null },
  ]);
  assert.equal(r.porTarefa.length, 2);
  assert.deepEqual(
    r.porTarefa.map((t) => t.model),
    ["gpt-5-mini", "modelo-sem-preco"],
  );
  // O rótulo da tarefa se repete — é a troca de modelo que se quer ver.
  assert.equal(r.porTarefa[0].label, "Leitura de selos");
  assert.equal(r.porTarefa[1].label, "Leitura de selos");
});

test("custo: nenhum evento com preço -> total nulo (nao zero)", () => {
  const r = aggregateUsage([
    { flow: "audit", model: "modelo-sem-preco", totalTokens: 10, estimatedCostUsd: null },
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

test("achado de 0 tokens nao gera fatia nem linha (falha sem custo)", () => {
  const r = aggregateUsage([
    { flow: "audit", model: "gpt-5.5", totalTokens: 0, estimatedCostUsd: null },
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 120, estimatedCostUsd: 0.01 },
  ]);
  assert.equal(r.porModelo.length, 1);
  assert.equal(r.porModelo[0].totalTokens, 120);
  assert.equal(r.porTarefa.length, 1);
  assert.equal(r.porTarefa[0].flow, "nexo-agent");
  assert.equal(r.totalTokens, 120);
});

test("falha que QUEIMOU tokens continua aparecendo (gasto real)", () => {
  const r = aggregateUsage([
    { flow: "audit", model: "gpt-5.5", totalTokens: 340, estimatedCostUsd: 0.02 },
  ]);
  assert.equal(r.porModelo.length, 1);
  assert.equal(r.porModelo[0].totalTokens, 340);
});

test("flowLabel: fluxo desconhecido devolve o proprio flow", () => {
  assert.equal(flowLabel("nexo-agent"), "Turnos da conversa");
  assert.equal(flowLabel("fluxo-novo-qualquer"), "fluxo-novo-qualquer");
  assert.equal(flowLabel(""), "");
});

// ---------------------------------------------------------------------------
// POR OPERACAO, e nao so por fluxo (17/08/2026).
//
// A auditoria inteira virava UMA linha: "Auditoria do memorial · sol · 350k".
// Numa corrida real do 084_25 isso escondia que 71% do gasto foi em blocos que
// TRUNCARAM e devolveram zero. O painel existe para essa pergunta caber sem
// abrir o banco.
// ---------------------------------------------------------------------------

test("a auditoria se abre por operacao, nao vira uma linha so", () => {
  const r = aggregateUsage([
    { flow: "audit", operation: "audit-global", status: "success", model: "sol", totalTokens: 156661, estimatedCostUsd: 1.19 },
    { flow: "audit", operation: "audit-chunk", status: "success", model: "sol", totalTokens: 5473, estimatedCostUsd: 0.05 },
    { flow: "audit", operation: "audit-validation", status: "success", model: "sol", totalTokens: 27742, estimatedCostUsd: 0.34 },
  ]);
  assert.equal(r.porTarefa.length, 3, "tres operacoes, tres linhas");
  const rotulos = r.porTarefa.map((t) => t.label);
  assert.ok(rotulos.some((l) => /documento inteiro|leitura global/i.test(l)), rotulos.join(" | "));
  assert.ok(rotulos.some((l) => /bloco|cap[ií]tulo/i.test(l)), rotulos.join(" | "));
});

test("chamada que FALHOU aparece separada e conta como desperdicio", () => {
  const r = aggregateUsage([
    { flow: "audit", operation: "audit-chunk", status: "success", model: "sol", totalTokens: 5000, estimatedCostUsd: 0.20 },
    { flow: "audit", operation: "audit-chunk", status: "failed", model: "sol", totalTokens: 30000, estimatedCostUsd: 4.32 },
  ]);
  assert.equal(r.porTarefa.length, 2, "sucesso e falha da MESMA operacao sao linhas distintas");
  const falha = r.porTarefa.find((t) => t.falhou);
  assert.ok(falha, "a linha de falha precisa existir");
  assert.equal(falha?.costUsd, 4.32);
  assert.equal(r.desperdicioUsd, 4.32, "o que falhou e desperdicio puro: gastou e nao entregou");
});

test("sem falha, o desperdicio e zero e nao nulo", () => {
  // Zero aqui e uma AFIRMACAO ("nada foi perdido"), e ela e verdadeira.
  const r = aggregateUsage([
    { flow: "audit", operation: "audit-global", status: "success", model: "sol", totalTokens: 100, estimatedCostUsd: 0.01 },
  ]);
  assert.equal(r.desperdicioUsd, 0);
});

test("operacao desconhecida nao vira linha em branco", () => {
  const r = aggregateUsage([
    { flow: "audit", operation: "audit-inventada", status: "success", model: "sol", totalTokens: 10, estimatedCostUsd: 0.01 },
  ]);
  assert.ok(r.porTarefa[0].label.length > 0);
});

test("o anel por MODELO nao se fatia por operacao", () => {
  // O anel mostra composicao por modelo; abri-lo por operacao roubaria a leitura
  // de relance que ele existe para dar.
  const r = aggregateUsage([
    { flow: "audit", operation: "audit-global", status: "success", model: "sol", totalTokens: 100, estimatedCostUsd: 0.01 },
    { flow: "audit", operation: "audit-chunk", status: "success", model: "sol", totalTokens: 200, estimatedCostUsd: 0.02 },
  ]);
  assert.equal(r.porModelo.length, 1);
  assert.equal(r.porModelo[0].totalTokens, 300);
});

console.log(`\n${passed} teste(s) da agregação de consumo OK.`);
