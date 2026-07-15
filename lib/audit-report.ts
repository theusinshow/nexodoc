import type { AuditMode } from "@/lib/audit-mode";
import type { AnalysisLevel } from "@/lib/analysis-level";

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
  categoria?: string;
  referencia_comparada?: string;
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
  runtime?: {
    nivel_analise?: AnalysisLevel;
    motor_auditoria?: "single" | "dual";
    regras_locais_ativas?: boolean;
    provedor_principal?: "openai" | "deepseek";
    provedor_validacao?: "openai" | "deepseek";
    modelo_principal?: string;
    modelo_validacao?: string;
    segunda_ia?: {
      ativa?: boolean;
      modelo?: string;
      papel?: "validacao_semantica";
      observacao?: string;
    };
    modelos_operacionais?: {
      identidade?: string;
      leitura_global?: string;
      blocos?: string;
      comparacao_arquivos?: string;
      validacao?: string;
    };
    esforco_raciocinio?: string;
    duracao_ms?: number;
    arquivos?: number;
    gerado_em?: string;
  };
  obra: string;
  codigo: string;
  municipio: string;
  volume?: string;
  orgao?: string;
  data_documento: string;
  status_analise: "concluida" | "parcial" | "falha";
  status_geral:
    | "sem achados críticos"
    | "com pontos de revisão"
    | "com inconsistências críticas"
    | "revisão obrigatória antes de emissão";
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
  // Escopo = a auto-classificação do achado (tipo + categoria). Não inclui o
  // "local" nem a evidência: locais como "Sumário" ou "Título do capítulo"
  // contaminam a decisão (um achado técnico localizado no sumário não é
  // editorial), e a prosa da IA menciona "identidade" sem o achado ser disso.
  const scope = normalizeForMatch([finding.tipo, finding.categoria ?? ""].join(" "));
  const haystack = normalizeForMatch(
    [
      finding.tipo,
      finding.capitulo,
      finding.local,
      finding.descricao,
      finding.evidencia,
      finding.conflito,
      finding.sugestao_correcao,
    ].join(" "),
  );

  // 1) Crítico documental — identidade/localização da obra (o mais grave).
  //    Decidido pelo ESCOPO do achado (tipo/categoria/local), não pela prosa:
  //    a IA menciona "identidade"/"obra" em muitas descrições sem que o achado
  //    seja de identidade — usar o haystack completo inflava os críticos.
  if (
    scope.includes("nome da obra") ||
    scope.includes("nome de obra") ||
    scope.includes("obra/unidade") ||
    scope.includes("identidade") ||
    scope.includes("identificacao") ||
    scope.includes("ocupacao") ||
    scope.includes("municipio") ||
    scope.includes("proprietario") ||
    scope.includes("endereco") ||
    scope.includes("logradouro") ||
    scope.includes("bairro") ||
    scope.includes("ubs")
  ) {
    return "critico_documental";
  }

  // 2) Revisão editorial — decidido pelo TIPO/CATEGORIA do achado (grafia,
  //    redação, formatação, numeração, duplicidade). Evita "titulo"/"sumario"
  //    soltos, que são locais e não indicam natureza editorial.
  if (
    scope.includes("reda") ||
    scope.includes("grafia") ||
    scope.includes("ortograf") ||
    scope.includes("formata") ||
    scope.includes("acentua") ||
    scope.includes("editorial") ||
    scope.includes("numeracao") ||
    scope.includes("duplicad") ||
    scope.includes("repetid")
  ) {
    return "revisao_editorial";
  }

  // 3) Técnico/contratual.
  if (
    haystack.includes("hierarquia") ||
    haystack.includes("prevalenc") ||
    haystack.includes("responsabilidade") ||
    haystack.includes("terraplenagem") ||
    haystack.includes("linguagem rodoviaria") ||
    haystack.includes("eixo da rodovia") ||
    haystack.includes("quadro de origem e destino") ||
    haystack.includes("dnit") ||
    haystack.includes("norma") ||
    haystack.includes("calculo") ||
    haystack.includes("autonomia") ||
    haystack.includes("carga termica") ||
    haystack.includes("referencia municipal") ||
    haystack.includes("comcap") ||
    haystack.includes("prancha") ||
    haystack.includes("revisao") ||
    scope.includes("escopo")
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
    return "Não foram detectados achados críticos dentro da auditoria executada.";
  }

  const parts: string[] = [];

  if (critical.length > 0) {
    parts.push(
      `Documento com ${critical.length} incongruência(s) crítica(s) de identidade/localização da obra, com risco de reaproveitamento de texto ou emissão com dados divergentes.`,
    );
  }

  if (technical.length > 0) {
    parts.push(
      `${technical.length} ponto(s) técnico(s)/contratual(is) exigem conferência antes da emissão.`,
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
  return `- ${finding.id}: ${finding.tipo} | Página ${finding.pagina || "não identificada"} | ${finding.conflito || finding.descricao}`;
}

export function makeTextReport(report: AuditReport) {
  const sortedFindings = sortAuditFindings(report.incongruencias);
  const grouped = groupFindingsByImpact(sortedFindings);
  const executiveSummary = buildExecutiveSummary(sortedFindings);
  const findings =
    sortedFindings.length === 0
      ? "- nenhum achado crítico detectado"
      : sortedFindings
          .map((finding) => {
            return [
              `Achado ${finding.id}: ${finding.tipo}`,
              `Prioridade: ${finding.prioridade}`,
              `Documento: ${finding.arquivo ?? report.arquivo ?? report.arquivos_analisados[0]?.arquivo ?? "não informado"}`,
              `Página provável: ${finding.pagina || "não identificada"}`,
              `Capítulo: ${finding.capitulo || "não identificado"}`,
              `Local: ${finding.local || "não informado"}`,
              `Evidência: ${finding.evidencia || finding.descricao}`,
              `Termo de busca: ${finding.termo_busca || finding.evidencia || finding.descricao}`,
              finding.categoria ? `Categoria: ${finding.categoria}` : "",
              finding.referencia_comparada ? `Referência comparada: ${finding.referencia_comparada}` : "",
              `Conflito: ${finding.conflito || "não informado"}`,
              `Ação recomendada: ${finding.sugestao_correcao || "revisar o trecho indicado"}`,
              `Impacto: ${getImpactLabel(finding.impacto ?? classifyFindingImpact(finding))}`,
              `Confiança: ${finding.confianca}`,
            ].filter(Boolean).join("\n");
          })
          .join("\n\n");

  return `
1. Projeto analisado
Arquivo: ${report.arquivo ?? "não informado"}
Obra: ${report.obra || "não identificada"}
Projeto: ${report.codigo || "não identificado"}
Documento: ${report.tipo_documento || "não identificado"}
Volume: ${report.volume || "não identificado"}
Data: ${report.data_documento || "não identificada"}
Órgão: ${report.orgao || "não identificado"}
Modelo: ${report.runtime?.modelo_principal || "não informado"}
Validação: ${report.runtime?.modelo_validacao || report.runtime?.modelo_principal || "não informado"}
Nível: ${report.runtime?.nivel_analise === "deep" ? "Profundo" : "Padrão"}

2. Status geral
${report.status_geral}

2.1 Síntese executiva
${executiveSummary}

2.2 Principais riscos
${grouped.critico_documental.length > 0 ? grouped.critico_documental.map(formatFindingLine).join("\n") : "- nenhum risco crítico documental identificado"}

3. Arquivos analisados
${report.arquivos_analisados
  .map((item) => {
    return `- ${item.arquivo} | ${item.tipo_documento} | ${item.paginas ?? "-"} páginas | ${item.caracteres_extraidos ?? "-"} caracteres`;
  })
  .join("\n")}

4. Análise por arquivo
${report.arquivos_analisados
  .map((item) => {
    return `Arquivo: ${item.arquivo}\nResumo: ${item.resumo}`;
  })
  .join("\n\n")}

5. Comparações entre arquivos
${report.comparacoes.length > 0 ? report.comparacoes.map((item) => `- ${item}`).join("\n") : "- sem comparação específica"}

6. Achados críticos documentais
${grouped.critico_documental.length > 0 ? grouped.critico_documental.map(formatFindingLine).join("\n") : "- nenhum achado crítico documental"}

6.1 Pontos técnicos/contratuais
${grouped.tecnico_contratual.length > 0 ? grouped.tecnico_contratual.map(formatFindingLine).join("\n") : "- nenhum ponto técnico/contratual detectado"}

6.2 Revisões editoriais
${grouped.revisao_editorial.length > 0 ? grouped.revisao_editorial.map(formatFindingLine).join("\n") : "- nenhuma revisão editorial detectada"}

6.3 Lista completa com evidências
${findings}

7. Conclusão objetiva
${report.conclusao}
`.trim();
}
