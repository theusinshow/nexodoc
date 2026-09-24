/**
 * PREÇO DE MODELO — a parte pura, sem banco e sem `@/`.
 *
 * Vive separada de `ai-usage.ts` de propósito: aquele módulo importa
 * `@/lib/db`, um atalho que só o bundler resolve, e isso torna a regra de preço
 * impossível de testar fora do Next. Preço é aritmética; gravar evento é I/O.
 *
 * NUNCA deduza o preço pelo sufixo do nome. O `gpt-5.6-luna` é 3,75x MAIS
 * BARATO que o `gpt-5.4-mini` nas duas pontas — "mini" é de uma geração
 * anterior e não acompanhou a queda de preço da seguinte.
 *
 * CONFERIDOS em 17/09/2026 na tabela oficial, faixa Standard
 * (developers.openai.com/api/docs/pricing). A conferência de 11/08/2026 tinha o
 * `gpt-5.6-sol` a $5 / $30 — o preço do `gpt-5.5` — e o painel superestimou uns
 * 21% em 30 dias, quase tudo na leitura global da auditoria: o Matheus via "US$
 * 4" na tela e o saldo da OpenAI mal se mexia. Preço muda; ao mexer aqui, confira
 * a página e atualize a data.
 *
 * FAMÍLIA 6 conferida em 24/09/2026 na mesma página. Não existe `gpt-6-terra`, e
 * o `gpt-6-sol` custa MENOS que o `gpt-5.6-sol` e empata com o `terra` na entrada
 * ($2 contra $2, saída $10 contra $12). O `gpt-6-astra` é o topo: 2,5x o sol.
 */
export type TokenUsageForPricing = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export const MODEL_PRICES_USD_PER_MILLION: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-6-astra": { input: 10, cachedInput: 1, output: 50 },
  "gpt-6-sol": { input: 2, cachedInput: 0.2, output: 10 },
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, output: 0.5 },
  "gpt-5.6-sol": { input: 4, cachedInput: 0.4, output: 20 },
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
  "gpt-5.5-pro": { input: 30, cachedInput: 30, output: 180 },
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
};

/**
 * Acima deste corte a OpenAI cobra a faixa de contexto longo: entrada em dobro
 * e saída 1,5x — conferido nas três linhas do 5.6 (sol $8/$30, terra $4/$18,
 * luna $0,40/$1,80). A página não escreve o corte para o 5.6; 272k é o que ela
 * escreve para o gpt-5.5, e segue valendo aqui até haver número melhor.
 *
 * A família 6 tem a mesma forma (conferida em 24/09/2026: astra $20/$75, sol
 * $4/$15, luna $0,20/$0,75), e a página também não escreve o corte dela.
 */
const LONG_CONTEXT_INPUT_THRESHOLD = 272_000;
const LONG_CONTEXT_MODELS = new Set([
  "gpt-6-astra",
  "gpt-6-sol",
  "gpt-6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
]);

/**
 * O CONFERENTE (TypeSafe/Jev) — outra tabela porque é outra conta.
 *
 * Conferido em 21/09/2026 em docs.typesafe.ai/models.md: US$ 0,042 por 1M de
 * tokens de ENTRADA, e **saída de graça** ("Charged per input token. Output
 * tokens are free."). Não há faixa de cache nem faixa de contexto longo — o
 * teto é 64k por requisição e acabou.
 *
 * A saída ser gratuita não é detalhe de preço, é o que torna o Encaixe 2
 * possível: varrer bloco que ninguém leu com 30 perguntas custa a ENTRADA do
 * bloco e mais nada. No `sol` a mesma varredura paga a saída, e foi a saída que
 * estourou o teto e censurou 24% dos blocos entre jun e ago/2026.
 *
 * `cachedInput` repete `input` de propósito: não existe desconto de cache
 * documentado, e escrever 0 aqui faria o painel afirmar que houve desconto.
 */
export const CONFERENTE_PRICES_USD_PER_MILLION: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "jev-1.13.0": { input: 0.042, cachedInput: 0.042, output: 0 },
};

export function estimateConferenteCostUsd(model: string, usage: TokenUsageForPricing) {
  const price = CONFERENTE_PRICES_USD_PER_MILLION[model];

  if (!price) {
    return null;
  }

  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

/**
 * Existe preço para este modelo? Quem soma custo precisa distinguir "de graça"
 * de "sem preço" — as duas coisas viravam zero e o painel mostrava silêncio.
 */
export function isModelPriceKnown(model: string) {
  return Boolean(MODEL_PRICES_USD_PER_MILLION[model] || CONFERENTE_PRICES_USD_PER_MILLION[model]);
}

/**
 * Devolve `null` — e não zero — quando o modelo não está na tabela. Zero é uma
 * afirmação sobre o custo; null é a ausência dela, e só quem chama sabe como
 * apresentar uma ausência.
 */
export function estimateOpenAiCostUsd(model: string, usage: TokenUsageForPricing) {
  const price = MODEL_PRICES_USD_PER_MILLION[model];

  if (!price) {
    return null;
  }

  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedTokens);
  const usesLongContextPricing =
    LONG_CONTEXT_MODELS.has(model) && usage.inputTokens > LONG_CONTEXT_INPUT_THRESHOLD;
  const inputMultiplier = usesLongContextPricing ? 2 : 1;
  const outputMultiplier = usesLongContextPricing ? 1.5 : 1;

  return (
    (uncachedInput * price.input * inputMultiplier +
      usage.cachedTokens * price.cachedInput * inputMultiplier +
      usage.outputTokens * price.output * outputMultiplier) /
    1_000_000
  );
}
