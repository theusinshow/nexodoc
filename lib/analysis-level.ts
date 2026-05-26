export const ANALYSIS_LEVELS = ["standard", "deep"] as const;

export type AnalysisLevel = (typeof ANALYSIS_LEVELS)[number];

export const DEFAULT_ANALYSIS_LEVEL: AnalysisLevel = "standard";

export function parseAnalysisLevel(value: FormDataEntryValue | null): AnalysisLevel {
  return value === "deep" ? "deep" : DEFAULT_ANALYSIS_LEVEL;
}

export function getAnalysisLevelLabel(level: AnalysisLevel) {
  return level === "deep" ? "Profundo" : "Padrão";
}

export function getAnalysisLevelDescription(level: AnalysisLevel) {
  return level === "deep"
    ? "Leitura ampliada para revisão final."
    : "Equilíbrio para auditoria de rotina.";
}
