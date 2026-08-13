/**
 * PREÇO DE MODELO — a parte pura, sem banco e sem `@/`.
 *
 * Vive separada de `ai-usage.ts` de propósito: aquele módulo importa
 * `@/lib/db`, um atalho que só o bundler resolve, e isso torna a regra de preço
 * impossível de testar fora do Next. Preço é aritmética; gravar evento é I/O.
 *
 * NUNCA deduza o preço pelo sufixo do nome. O `gpt-5.6-luna` é 3,75x MAIS
 * BARATO que o `gpt-5.4-mini` nas duas pontas — "mini" é de uma geração
 * anterior e não acompanhou a queda de preço da seguinte. Preços conferidos na
 * tabela da OpenAI em 11/08/2026.
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
  "gpt-5.6-sol": { input: 5, cachedInput: 0.5, output: 30 },
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
 * e saída 1,5x. Só vale para os dois modelos de janela grande.
 */
const LONG_CONTEXT_INPUT_THRESHOLD = 272_000;
const LONG_CONTEXT_MODELS = new Set(["gpt-5.6-sol", "gpt-5.6-terra"]);

/**
 * Existe preço para este modelo? Quem soma custo precisa distinguir "de graça"
 * de "sem preço" — as duas coisas viravam zero e o painel mostrava silêncio.
 */
export function isModelPriceKnown(model: string) {
  return Boolean(MODEL_PRICES_USD_PER_MILLION[model]);
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
