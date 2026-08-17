export const ANALYSIS_LEVELS = ["standard", "deep"] as const;

export type AnalysisLevel = (typeof ANALYSIS_LEVELS)[number];

/**
 * O PADRÃO É `deep` DESDE 17/08/2026 — e a escolha de nível deixou de existir.
 *
 * O default era `standard`, e isso ficou catastrófico quando o seletor de nível
 * foi removido no mesmo dia: sem ninguém mandar `"deep"`, TODA auditoria passou
 * a rodar no nível que amostra o documento. Medido no memorial 084_25 (218
 * páginas, 547.855 caracteres):
 *
 *   standard  leitura global recebe 90.000 chars — 16% do documento, amostrado
 *             em cabeça/meio/cauda — e no máximo 8 blocos;
 *   deep      leitura global recebe o documento INTEIRO (até 700.000 chars).
 *
 * O resultado foi um parecer que encontrou 6 dos 25 achados de um benchmark, com
 * os perdidos concentrados no miolo — exatamente o que a amostragem descarta. E
 * os dois níveis custam praticamente o MESMO (US$ 0,82 medidos no 156-25): nunca
 * foi barato contra caro, era ler o documento contra não ler pelo mesmo preço.
 *
 * `standard` continua existindo como valor porque pareceres antigos o gravaram e
 * porque serve para benchmark — mas só se alguém o pedir explicitamente.
 */
export const DEFAULT_ANALYSIS_LEVEL: AnalysisLevel = "deep";

export function parseAnalysisLevel(value: FormDataEntryValue | null): AnalysisLevel {
  return value === "standard" ? "standard" : DEFAULT_ANALYSIS_LEVEL;
}

export function getAnalysisLevelLabel(level: AnalysisLevel) {
  return level === "deep" ? "Profundo" : "Padrão";
}

export function getAnalysisLevelDescription(level: AnalysisLevel) {
  return level === "deep"
    ? "Leitura ampliada para revisão final."
    : "Equilíbrio para auditoria de rotina.";
}
