import type { AuditMode } from "@/lib/audit-mode";

export type FindingPriority = "Alta" | "Media/Alta" | "Media" | "Baixa/Media" | "Baixa";
export type FindingConfidence = "alta" | "media" | "baixa";
export type FindingImpact = "critico_documental" | "tecnico_contratual" | "revisao_editorial";

export type AuditFinding = {
  id: string;
  arquivo?: string;
  prioridade: FindingPriority;
  pagina: string;
  capitulo: string;
  local: string;
  tipo: string;
  descricao: string;
  evidencia: string;
  termo_busca?: string;
  conflito: string;
  sugestao_correcao: string;
  confianca: FindingConfidence;
  origem?: "regra" | "ia";
  impacto?: FindingImpact;
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
  status_geral:
    | "sem achados criticos"
    | "com pontos de revisao"
    | "com inconsistencias criticas"
    | "revisao obrigatoria antes de emissao";
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

export function getPriorityRank(priority: FindingPriority) {
  switch (priority) {
    case "Alta":
      return 0;
    case "Media/Alta":
      return 1;
    case "Media":
      return 2;
    case "Baixa/Media":
      return 3;
    case "Baixa":
      return 4;
    default:
      return 5;
  }
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function classifyFindingImpact(finding: AuditFinding): FindingImpact {
  const haystack = normalizeForMatch(
    [
      finding.tipo,
      finding.capitulo,
      finding.local,
      finding.descricao,
      finding.evidencia,
      finding.conflito,
    ].join(" "),
  );

  if (
    haystack.includes("nome da obra") ||
    haystack.includes("unidade") ||
    haystack.includes("ubs") ||
    haystack.includes("municipio") ||
    haystack.includes("proprietario") ||
    haystack.includes("bairro") ||
    haystack.includes("logradouro") ||
    haystack.includes("endereco") ||
    haystack.includes("identidade")
  ) {
    return "critico_documental";
  }

  if (
    haystack.includes("hierarquia") ||
    haystack.includes("norma") ||
    haystack.includes("calculo") ||
    haystack.includes("autonomia") ||
    haystack.includes("carga termica") ||
    haystack.includes("referencia municipal") ||
    haystack.includes("comcap") ||
    haystack.includes("ld") ||
    haystack.includes("prancha")
  ) {
    return "tecnico_contratual";
  }

  return "revisao_editorial";
}

export function getImpactRank(impact: FindingImpact) {
  switch (impact) {
    case "critico_documental":
      return 0;
    case "tecnico_contratual":
      return 1;
    case "revisao_editorial":
      return 2;
    default:
      return 3;
  }
}

export function getImpactLabel(impact: FindingImpact) {
  switch (impact) {
    case "critico_documental":
      return "Critico documental";
    case "tecnico_contratual":
      return "Tecnico/contratual";
    case "revisao_editorial":
      return "Revisao editorial";
    default:
      return "Outro";
  }
}

export function withFindingImpact(finding: AuditFinding): AuditFinding {
  return {
    ...finding,
    impacto: finding.impacto ?? classifyFindingImpact(finding),
  };
}

export function sortAuditFindings(findings: AuditFinding[]) {
  return findings.map(withFindingImpact).sort((a, b) => {
    const impactDiff =
      getImpactRank(a.impacto ?? classifyFindingImpact(a)) -
      getImpactRank(b.impacto ?? classifyFindingImpact(b));

    if (impactDiff !== 0) {
      return impactDiff;
    }

    const priorityDiff = getPriorityRank(a.prioridade) - getPriorityRank(b.prioridade);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const pageA = Number.parseInt(a.pagina, 10);
    const pageB = Number.parseInt(b.pagina, 10);

    if (Number.isFinite(pageA) && Number.isFinite(pageB) && pageA !== pageB) {
      return pageA - pageB;
    }

    return a.tipo.localeCompare(b.tipo, "pt-BR");
  });
}

export function groupFindingsByImpact(findings: AuditFinding[]) {
  const sorted = sortAuditFindings(findings);

  return {
    critico_documental: sorted.filter((finding) => finding.impacto === "critico_documental"),
    tecnico_contratual: sorted.filter((finding) => finding.impacto === "tecnico_contratual"),
    revisao_editorial: sorted.filter((finding) => finding.impacto === "revisao_editorial"),
  };
}

export function buildExecutiveSummary(findings: AuditFinding[]) {
  const groups = groupFindingsByImpact(findings);
  const critical = groups.critico_documental;
  const technical = groups.tecnico_contratual;
  const editorial = groups.revisao_editorial;

  if (findings.length === 0) {
    return "Nao foram detectados achados criticos dentro da auditoria executada.";
  }

  const parts: string[] = [];

  if (critical.length > 0) {
    parts.push(
      `Documento com ${critical.length} incongruencia(s) critica(s) de identidade/localizacao da obra, com risco de reaproveitamento de texto ou emissao com dados divergentes.`,
    );
  }

  if (technical.length > 0) {
    parts.push(
      `${technical.length} ponto(s) tecnico(s)/contratual(is) exigem conferencia antes da emissao.`,
    );
  }

  if (editorial.length > 0) {
    parts.push(
      `${editorial.length} ponto(s) editorial(is) devem ser revisados sem o mesmo peso dos erros documentais.`,
    );
  }

  return parts.join(" ");
}

function formatFindingLine(finding: AuditFinding) {
  return `- ${finding.id}: ${finding.tipo} | Pagina ${finding.pagina || "nao identificada"} | ${finding.conflito || finding.descricao}`;
}

export function makeTextReport(report: AuditReport) {
  const sortedFindings = sortAuditFindings(report.incongruencias);
  const grouped = groupFindingsByImpact(sortedFindings);
  const executiveSummary = buildExecutiveSummary(sortedFindings);
  const findings =
    sortedFindings.length === 0
      ? "- nenhum achado critico detectado"
      : sortedFindings
          .map((finding) => {
            return [
              `Achado ${finding.id}: ${finding.tipo}`,
              `Prioridade: ${finding.prioridade}`,
              `Documento: ${finding.arquivo ?? report.arquivo ?? report.arquivos_analisados[0]?.arquivo ?? "nao informado"}`,
              `Pagina provavel: ${finding.pagina || "nao identificada"}`,
              `Capitulo: ${finding.capitulo || "nao identificado"}`,
              `Local: ${finding.local || "nao informado"}`,
              `Evidencia: ${finding.evidencia || finding.descricao}`,
              `Termo de busca: ${finding.termo_busca || finding.evidencia || finding.descricao}`,
              `Conflito: ${finding.conflito || "nao informado"}`,
              `Acao recomendada: ${finding.sugestao_correcao || "revisar o trecho indicado"}`,
              `Impacto: ${getImpactLabel(finding.impacto ?? classifyFindingImpact(finding))}`,
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

2.1 Sintese executiva
${executiveSummary}

2.2 Principais riscos
${grouped.critico_documental.length > 0 ? grouped.critico_documental.map(formatFindingLine).join("\n") : "- nenhum risco critico documental identificado"}

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

6. Achados criticos documentais
${grouped.critico_documental.length > 0 ? grouped.critico_documental.map(formatFindingLine).join("\n") : "- nenhum achado critico documental"}

6.1 Pontos tecnicos/contratuais
${grouped.tecnico_contratual.length > 0 ? grouped.tecnico_contratual.map(formatFindingLine).join("\n") : "- nenhum ponto tecnico/contratual detectado"}

6.2 Revisoes editoriais
${grouped.revisao_editorial.length > 0 ? grouped.revisao_editorial.map(formatFindingLine).join("\n") : "- nenhuma revisao editorial detectada"}

6.3 Lista completa com evidencias
${findings}

7. Conclusao objetiva
${report.conclusao}
`.trim();
}
