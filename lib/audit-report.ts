import type { AuditMode } from "@/lib/audit-mode";

export type FindingPriority = "Alta" | "Media/Alta" | "Media" | "Baixa/Media" | "Baixa";
export type FindingConfidence = "alta" | "media" | "baixa";

export type AuditFinding = {
  id: string;
  prioridade: FindingPriority;
  pagina: string;
  capitulo: string;
  local: string;
  tipo: string;
  descricao: string;
  evidencia: string;
  conflito: string;
  sugestao_correcao: string;
  confianca: FindingConfidence;
  origem?: "regra" | "ia";
};

export type AuditFileSummary = {
  arquivo: string;
  tipo_documento: string;
  paginas?: number;
  caracteres_extraidos?: number;
  resumo: string;
};

export type AuditReport = {
  arquivo?: string;
  tipo_auditoria: AuditMode;
  tipo_documento: string;
  obra: string;
  codigo: string;
  municipio: string;
  data_documento: string;
  status_analise: "concluida" | "parcial" | "falha";
  status_geral: "sem incongruencia relevante" | "com ponto de atencao" | "com incongruencia relevante";
  total_incongruencias: number;
  arquivos_analisados: AuditFileSummary[];
  comparacoes: string[];
  incongruencias: AuditFinding[];
  conclusao: string;
};

export function normalizePriority(value: string | undefined): FindingPriority {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("alta") && normalized.includes("media")) {
    return "Media/Alta";
  }

  if (normalized === "alta" || normalized.includes("critica")) {
    return "Alta";
  }

  if (normalized.includes("baixa") && normalized.includes("media")) {
    return "Baixa/Media";
  }

  if (normalized === "baixa") {
    return "Baixa";
  }

  return "Media";
}

export function normalizeConfidence(value: string | undefined): FindingConfidence {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("alta")) {
    return "alta";
  }

  if (normalized.includes("baixa")) {
    return "baixa";
  }

  return "media";
}

export function makeTextReport(report: AuditReport) {
  const findings =
    report.incongruencias.length === 0
      ? "- nenhuma incongruencia relevante encontrada"
      : report.incongruencias
          .map((finding) => {
            return [
              `Achado ${finding.id}: ${finding.tipo}`,
              `Prioridade: ${finding.prioridade}`,
              `Documento: ${report.arquivo ?? report.arquivos_analisados[0]?.arquivo ?? "nao informado"}`,
              `Pagina provavel: ${finding.pagina || "nao identificada"}`,
              `Capitulo: ${finding.capitulo || "nao identificado"}`,
              `Local: ${finding.local || "nao informado"}`,
              `Evidencia: ${finding.evidencia || finding.descricao}`,
              `Conflito: ${finding.conflito || "nao informado"}`,
              `Acao recomendada: ${finding.sugestao_correcao || "revisar o trecho indicado"}`,
              `Confianca: ${finding.confianca}`,
            ].join("\n");
          })
          .join("\n\n");

  return `
1. Projeto analisado
Arquivo: ${report.arquivo ?? "nao informado"}
Obra: ${report.obra || "nao identificada"}
Codigo: ${report.codigo || "nao identificado"}
Municipio: ${report.municipio || "nao identificado"}
Data: ${report.data_documento || "nao identificada"}

2. Status geral
${report.status_geral}

3. Arquivos analisados
${report.arquivos_analisados
  .map((item) => {
    return `- ${item.arquivo} | ${item.tipo_documento} | ${item.paginas ?? "-"} paginas | ${item.caracteres_extraidos ?? "-"} caracteres`;
  })
  .join("\n")}

4. Analise por arquivo
${report.arquivos_analisados
  .map((item) => {
    return `Arquivo: ${item.arquivo}\nResumo: ${item.resumo}`;
  })
  .join("\n\n")}

5. Comparacoes entre arquivos
${report.comparacoes.length > 0 ? report.comparacoes.map((item) => `- ${item}`).join("\n") : "- sem comparacao especifica"}

6. Incongruencias relevantes encontradas
${findings}

7. Conclusao objetiva
${report.conclusao}
`.trim();
}
