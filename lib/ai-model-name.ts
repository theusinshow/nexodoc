/**
 * NOME DE MODELO — normalização e validação, puras e sem banco.
 *
 * Separadas de `ai-model-config.ts` porque aquele módulo importa `@/lib/db`,
 * atalho que só o bundler resolve: com a regra lá dentro, nenhum teste
 * conseguia exercitá-la fora do Next. Foi assim que a checagem de segredo
 * abaixo passou meses sem existir.
 */

/**
 * Uma chave `sk-proj-...` da OpenAI é feita de letras, dígitos, hífen e
 * underline — ou seja, casa inteira com o formato de um nome de modelo, e a
 * validação de formato não tem como recusá-la.
 *
 * Isso não é hipótese: quatro eventos de 09/06/2026 chegaram ao banco de
 * produção com a chave em texto puro no campo `model` de `AiUsageEvent`, e lá
 * ficaram, visíveis para qualquer leitura da tabela ou do painel de uso.
 *
 * O teste é pelo PREFIXO, não pelo comprimento: chave curta também é chave, e
 * gravá-la custa o mesmo. Prefixos comuns de segredo entram todos, porque o
 * campo é digitado à mão e o erro é de colar no lugar errado.
 */
export function looksLikeApiSecret(value: string) {
  return /^(sk|pk|rk|api|token|bearer)[-_]/i.test(value.trim());
}

export function normalizeAiModelName(model: string) {
  return model.trim();
}

export function validateAiModelName(model: string) {
  const normalized = normalizeAiModelName(model);

  if (!normalized) {
    return "Informe um modelo.";
  }

  if (normalized.length > 120) {
    return "Modelo muito longo.";
  }

  if (!/^[a-zA-Z0-9._:()/-]+$/.test(normalized)) {
    return "Use apenas letras, números, ponto, hífen, barra, dois-pontos, parênteses ou underline.";
  }

  if (looksLikeApiSecret(normalized)) {
    return "Isso parece uma chave de API, não um modelo. Chave nunca vai neste campo.";
  }

  return "";
}
