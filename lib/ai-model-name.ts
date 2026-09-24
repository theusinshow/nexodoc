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

  /*
   * SEM PARÊNTESES. Eles estavam nesta lista e foi por essa fresta que o
   * `deepseek-v4-flash(1)` entrou: o "(1)" é o sufixo que o navegador põe em
   * "arquivo (1).pdf", colado por engano no campo de modelo. O painel aceitou,
   * o valor foi para o `.env` e para o dropdown, e 88 chamadas seguidas
   * falharam contra a API sem que ninguém visse.
   *
   * Os DOIS-PONTOS ficam: modelo afinado da OpenAI tem id no formato
   * `ft:gpt-4.1-2025-04-14:acme::abc123`, e recusá-lo quebraria um caso real.
   */
  if (!/^[a-zA-Z0-9._:/-]+$/.test(normalized)) {
    return "Use apenas letras, números, ponto, hífen, barra, dois-pontos ou underline.";
  }

  if (looksLikeApiSecret(normalized)) {
    return "Isso parece uma chave de API, não um modelo. Chave nunca vai neste campo.";
  }

  return "";
}

/**
 * Modelos que RECUSAM `reasoning.effort: "none"`. Medido na API em 24/09/2026:
 * o `gpt-6-astra` devolve "Unsupported value: 'none'" e aceita de `low` para
 * cima; `gpt-6-sol` e `gpt-6-luna` aceitam `none`, como a família 5.6.
 *
 * Os fluxos que copiam em vez de pensar (selo, transcrição, conferência do
 * volume, teste do painel) mandam `none` fixo. Sem esta troca, escolher o astra
 * no painel para um deles faria TODA chamada falhar contra a API.
 */
const MODELOS_SEM_ESFORCO_NONE = new Set(["gpt-6-astra"]);

/**
 * Sobe `none` para `low` quando o modelo não aceita `none`. É o menor esforço
 * que ele aceita, não uma escolha de qualidade. Os outros valores passam como
 * vieram.
 */
export function esforcoAceitoPeloModelo<T extends string | null | undefined>(
  model: string,
  effort: T,
): T | "low" {
  if (effort === "none" && MODELOS_SEM_ESFORCO_NONE.has(normalizeAiModelName(model))) {
    return "low";
  }

  return effort;
}
