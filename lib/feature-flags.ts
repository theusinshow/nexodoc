/**
 * Feature flags do NexoDoc.
 *
 * Kill-switch por variavel de ambiente. Semantica conservadora: um modulo so
 * liga com o valor EXATO "true". Qualquer outra coisa (ausente, "false", "0")
 * mantem desligado — assim producao fica segura por padrao e o modulo novo so
 * aparece onde a flag foi ligada explicitamente (ex.: .env.local em dev).
 */

/** Modulo Nexo (assistente que orquestra os demais modulos). Carro-chefe em construcao. */
export function isNexoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NEXO_ENABLED === "true";
}
