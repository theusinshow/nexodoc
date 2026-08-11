/**
 * COMO UM ERRO DE PROVEDOR É LIDO — lógica pura, sem Next, sem banco, sem env.
 *
 * Mora fora de `ai-providers.ts` de propósito: aquele módulo puxa o cache de
 * overrides (e o Prisma atrás dele), então não roda no `node` cru. Aqui a
 * classificação fica testável direto (`npm run test:ai-failure`).
 *
 * O que motivou o arquivo (11/08/2026): um bloco do memorial estourou o teto de
 * saída, o erro veio com `code=incomplete_max_output_tokens`, e a classificação
 * antiga — que comparava o código por IGUALDADE contra "invalid_response" e
 * depois caía num `message.includes("modelo")` — respondeu ao engenheiro
 * "O modelo configurado para OpenAI não está disponível". Nada havia de errado
 * com o modelo. A mensagem mandou caçar configuração por 0 motivo.
 */

export type ProviderFailureCategory =
  | "quota_billing"
  | "authentication"
  | "timeout"
  | "rate_limit"
  | "invalid_response"
  | "configuration"
  | "model_unavailable"
  | "unknown";

export type ProviderErrorShape = {
  status?: number;
  code?: string;
  type?: string;
  name?: string;
  message?: string;
};

/**
 * O envelope da resposta veio quebrado (truncado, recusado, ilegível) — ou seja,
 * o provedor RESPONDEU, e o problema está no conteúdo, não na chamada.
 *
 * Distinção que importa: falha de envelope é DEGRADÁVEL. A etapa que a recebeu
 * pode ser descartada e a auditoria segue com as outras. Falha de credencial,
 * quota ou modelo inexistente não é — ali toda chamada seguinte morreria igual.
 */
export function isInvalidProviderResponseError(error: unknown) {
  const candidate = error as ProviderErrorShape;
  const code = `${candidate?.code ?? ""}`.toLowerCase();
  const type = `${candidate?.type ?? ""}`.toLowerCase();
  const message = `${candidate?.message ?? ""}`.toLowerCase();

  return (
    code === "invalid_response" ||
    type === "invalid_response" ||
    // `incomplete_max_output_tokens`, `incomplete_content_filter`, `refusal`:
    // todos nascem em `extractOutputText`, todos são resposta imprestável.
    code.startsWith("incomplete_") ||
    code === "refusal" ||
    message.includes("resposta inválida") ||
    message.includes("não foi concluída")
  );
}

export function classifyProviderErrorCategory(error: unknown): ProviderFailureCategory {
  const candidate = error as ProviderErrorShape;
  const status = candidate?.status;
  const rawCode = `${candidate?.code ?? ""} ${candidate?.type ?? ""}`.toLowerCase();
  const rawMessage = `${candidate?.message ?? ""}`.toLowerCase();

  if (
    rawCode.includes("insufficient_quota") ||
    rawMessage.includes("insufficient_quota") ||
    rawMessage.includes("billing")
  ) {
    return "quota_billing";
  }

  if (
    status === 401 ||
    status === 403 ||
    rawCode.includes("invalid_api_key") ||
    rawMessage.includes("api key")
  ) {
    return "authentication";
  }

  if (
    candidate?.name === "AbortError" ||
    rawMessage.includes("timeout") ||
    rawMessage.includes("tempo limite")
  ) {
    return "timeout";
  }

  if (status === 429) {
    return "rate_limit";
  }

  /*
   * ANTES do teste de modelo, e não depois. As mensagens de envelope quebrado
   * são escritas em português e falam do "modelo" ("A resposta do modelo não foi
   * concluída"); se o teste de modelo viesse primeiro, toda truncagem seria
   * anunciada como modelo indisponível — que foi exatamente o bug.
   */
  if (isInvalidProviderResponseError(error)) {
    return "invalid_response";
  }

  if (rawCode.includes("configuration") || rawMessage.includes("não configurada")) {
    return "configuration";
  }

  if (status === 404 || rawMessage.includes("model") || rawMessage.includes("modelo")) {
    return "model_unavailable";
  }

  return "unknown";
}
