/**
 * A TABELA DE PREÇOS E A DIFERENÇA ENTRE "DE GRAÇA" E "SEM PREÇO".
 *
 * O painel de uso somava `estimatedCostUsd ?? 0`. Modelo fora da tabela não
 * custa zero — ele custa uma quantia que ninguém sabe, e somar zero transforma
 * consumo real em silêncio. Em 45 dias isso escondeu 402 chamadas e 2,36 M de
 * tokens do `gpt-5.6-luna`.
 *
 * O outro teste trava o erro que já aconteceu uma vez: deduzir preço pelo
 * sufixo do nome. "mini" é de uma geração anterior e NÃO é o mais barato.
 *
 *   node scripts/test-ai-precos.ts   (== npm run test:ai:precos)
 */
import assert from "node:assert/strict";

import { estimateOpenAiCostUsd, isModelPriceKnown } from "../lib/ai-precos.ts";
import { validateAiModelName } from "../lib/ai-model-name.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const umMilhao = { inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0, totalTokens: 1_000_000 };
const semUso = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0 };

test("o luna tem preço — era ele o custo invisível do painel", () => {
  assert.equal(isModelPriceKnown("gpt-5.6-luna"), true);
  assert.equal(estimateOpenAiCostUsd("gpt-5.6-luna", umMilhao), 0.2);
});

test("o luna é 3,75x mais barato que o mini, na entrada e na saída", () => {
  const entrada = (model: string) => estimateOpenAiCostUsd(model, umMilhao)!;
  const saida = (model: string) =>
    estimateOpenAiCostUsd(model, { ...semUso, outputTokens: 1_000_000 })!;

  assert.equal(entrada("gpt-5.4-mini") / entrada("gpt-5.6-luna"), 3.75);
  assert.equal(saida("gpt-5.4-mini") / saida("gpt-5.6-luna"), 3.75);
});

test("modelo desconhecido devolve null, e NUNCA zero", () => {
  const custo = estimateOpenAiCostUsd("modelo-que-nao-existe", umMilhao);
  assert.equal(custo, null);
  assert.notEqual(custo, 0);
  assert.equal(isModelPriceKnown("modelo-que-nao-existe"), false);
});

test("entrada cacheada custa 10x menos que entrada nova", () => {
  // Abaixo do corte de 272k de propósito: acima dele a faixa longa dobra as
  // duas pontas e a razão continua 10x, mas os valores deixam de ser óbvios.
  const cem = { inputTokens: 100_000, outputTokens: 0, cachedTokens: 0, totalTokens: 100_000 };
  const nova = estimateOpenAiCostUsd("gpt-5.6-sol", cem)!;
  const cacheada = estimateOpenAiCostUsd("gpt-5.6-sol", { ...cem, cachedTokens: 100_000 })!;

  assert.equal(nova, 0.5);
  assert.equal(cacheada, 0.05);
  assert.equal(nova / cacheada, 10);
});

test("1M de entrada no sol já paga faixa longa — o corte é 272k, não 1M", () => {
  assert.equal(estimateOpenAiCostUsd("gpt-5.6-sol", umMilhao), 10);
});

test("acima de 272k o preço longo dobra a entrada e multiplica a saída por 1,5", () => {
  const curto = { inputTokens: 272_000, outputTokens: 100_000, cachedTokens: 0, totalTokens: 372_000 };
  const longo = { inputTokens: 272_001, outputTokens: 100_000, cachedTokens: 0, totalTokens: 372_001 };

  const a = estimateOpenAiCostUsd("gpt-5.6-sol", curto)!;
  const b = estimateOpenAiCostUsd("gpt-5.6-sol", longo)!;

  // entrada 272k*$5 = $1,36 ; saída 100k*$30 = $3 -> $4,36
  assert.equal(Number(a.toFixed(4)), 4.36);
  // dobra a entrada (~$2,72) e 1,5x a saída ($4,50) -> ~$7,22
  assert.equal(Number(b.toFixed(2)), 7.22);
});

test("o luna não paga preço de contexto longo — a regra é só do sol e do terra", () => {
  const longo = { inputTokens: 300_000, outputTokens: 0, cachedTokens: 0, totalTokens: 300_000 };
  assert.equal(Number(estimateOpenAiCostUsd("gpt-5.6-luna", longo)!.toFixed(4)), 0.06);
});

test("nome de modelo não aceita chave de API — uma já foi parar no banco", () => {
  // Montada em runtime para exercitar o formato sem manter um segredo — nem uma
  // sequência que scanners confundam com segredo — no código-fonte.
  const chave = ["sk", "proj", "exemplo-ficticio-com-mais-de-vinte-caracteres"].join("-");
  assert.notEqual(validateAiModelName(chave), "");
  assert.notEqual(validateAiModelName("  sk-abc123  "), "");
  assert.notEqual(validateAiModelName("SK-PROJ-MAIUSCULO"), "");
});

test("os modelos de verdade continuam passando na validação", () => {
  for (const model of ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.4-mini"]) {
    assert.equal(validateAiModelName(model), "", `rejeitou ${model}`);
  }
});

test("nome com parêntese é recusado — foi por aí que o '(1)' entrou", () => {
  // O sufixo de "arquivo (1).pdf" colado no campo de modelo. Passava na
  // validação e falhava em TODA chamada contra a API: 88 seguidas.
  assert.notEqual(validateAiModelName("deepseek-v4-flash(1)"), "");
  assert.notEqual(validateAiModelName("gpt-5.6-terra (1)"), "");
  assert.notEqual(validateAiModelName("gpt-5.6-terra(cópia)"), "");
});

test("modelo AFINADO continua passando — os dois-pontos não podem cair junto", () => {
  assert.equal(validateAiModelName("ft:gpt-4.1-2025-04-14:acme::abc123"), "");
  assert.equal(validateAiModelName("org/gpt-5.6-terra"), "");
});

console.log(`\n${passed} verificações de preço passaram.`);
