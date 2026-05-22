"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  ExternalLink,
  FileText,
  LayoutList,
  MapPin,
  Search,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { AuditResultActions } from "@/components/audit-result-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  classifyFindingImpact,
  getImpactLabel,
  groupFindingsByImpact,
  type AuditFinding,
  type AuditReport,
  type FindingImpact,
} from "@/lib/audit-report";
import { cn } from "@/lib/utils";

type AuditResultProps = {
  content: string;
  elapsedMs?: number;
  report?: AuditReport;
  pdfSources?: AuditPdfSource[];
};

export type AuditPdfSource = {
  name: string;
  url: string;
};

type AuditSectionKey =
  | "project"
  | "status"
  | "files"
  | "fileAnalysis"
  | "comparisons"
  | "findings"
  | "conclusion";

type ParsedAudit = Record<AuditSectionKey, string>;

type StructuredFinding = {
  title: string;
  refId?: string;
  severity: "critical" | "warning" | "ok";
  documento?: string;
  pagina?: string;
  local?: string;
  evidencia?: string;
  termoBusca?: string;
  conflito?: string;
  acao?: string;
  categoria?: string;
  referencia?: string;
  impacto?: FindingImpact;
  pdfUrl?: string;
  raw: string;
};

type ProjectField = {
  label: string;
  value: string;
};

const SECTION_MAP: Record<string, AuditSectionKey> = {
  "projeto analisado": "project",
  "status geral": "status",
  "arquivos analisados": "files",
  "analise por arquivo": "fileAnalysis",
  "análise por arquivo": "fileAnalysis",
  "comparacoes entre arquivos": "comparisons",
  "comparações entre arquivos": "comparisons",
  "achados encontrados": "findings",
  "incongruências relevantes encontradas": "findings",
  "incongruencias relevantes encontradas": "findings",
  "conclusão objetiva": "conclusion",
  "conclusao objetiva": "conclusion",
};

const EMPTY_AUDIT: ParsedAudit = {
  project: "",
  status: "",
  files: "",
  fileAnalysis: "",
  comparisons: "",
  findings: "",
  conclusion: "",
};

function normalizeHeading(value: string) {
  return value.trim().toLowerCase();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAuditResult(content: string): ParsedAudit {
  const parsed = { ...EMPTY_AUDIT };
  const sectionRegex =
    /(?:^|\n)\s*(\d+)\.\s*(Projeto analisado|Status geral|Arquivos analisados|Analise por arquivo|Análise por arquivo|Comparacoes entre arquivos|Comparações entre arquivos|Achados encontrados|Incongruências relevantes encontradas|Incongruencias relevantes encontradas|Conclusão objetiva|Conclusao objetiva)\s*\n/gi;
  const matches = Array.from(content.matchAll(sectionRegex));

  matches.forEach((match, index) => {
    const key = SECTION_MAP[normalizeHeading(match[2] ?? "")];
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? content.length)
        : content.length;

    if (key) {
      parsed[key] = content.slice(start, end).trim();
    }
  });

  return parsed;
}

function getStatusVariant(status: string) {
  const normalized = normalizeText(status);

  if (
    normalized.includes("sem achados criticos") ||
    normalized.includes("sem incongruencia relevante")
  ) {
    return {
      label: "sem achados críticos",
      className:
        "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]",
      icon: CheckCircle2,
    };
  }

  if (
    normalized.includes("revisao obrigatoria") ||
    normalized.includes("inconsistencias criticas") ||
    normalized.includes("incongruencia relevante")
  ) {
    return {
      label: "com inconsistências críticas",
      className:
        "border-[var(--status-critical)]/30 bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
      icon: AlertTriangle,
    };
  }

  if (
    normalized.includes("pontos de revisao") ||
    normalized.includes("ponto de atencao")
  ) {
    return {
      label: "com pontos de revisão",
      className:
        "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
      icon: AlertTriangle,
    };
  }

  return {
    label: "sem achados críticos",
    className:
      "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]",
    icon: CheckCircle2,
  };
}

function formatElapsedTime(elapsedMs?: number) {
  if (!elapsedMs) {
    return null;
  }

  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `${seconds}s`;
}

function getFindingField(block: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:-\\s*)?${escapedLabel}\\s*:\\s*(.+?)(?=\\n\\s*(?:-\\s*)?(?:Documento|Página provável|Pagina provavel|Local|Evidência|Evidencia|Termo de busca|Conflito|Ação recomendada|Acao recomendada|Categoria|Referência comparada|Referencia comparada)\\s*:|$)`,
    "is",
  );
  return block.match(regex)?.[1]?.trim();
}

function getFindingSeverity(block: string): StructuredFinding["severity"] {
  const normalized = normalizeText(block);

  if (
    normalized.includes("divergente") ||
    normalized.includes("conflito") ||
    normalized.includes("reaproveitamento") ||
    normalized.includes("nao corresponde")
  ) {
    return "critical";
  }

  if (
    normalized.includes("atencao") ||
    normalized.includes("conferir") ||
    normalized.includes("confirmar")
  ) {
    return "warning";
  }

  return "ok";
}

function getSeverityLabel(severity: StructuredFinding["severity"]) {
  if (severity === "critical") {
    return "inconsistência crítica";
  }

  if (severity === "warning") {
    return "ponto de atenção";
  }

  return "achado informativo";
}

function getSeverityClass(severity: StructuredFinding["severity"]) {
  if (severity === "critical") {
    return "border-[var(--status-critical)]/35 bg-[var(--status-critical-bg)] text-[var(--status-critical)]";
  }

  if (severity === "warning") {
    return "border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
  }

  return "border-[var(--status-ok)]/35 bg-[var(--status-ok-bg)] text-[var(--status-ok)]";
}

function parseProjectFields(project: string): ProjectField[] {
  return project
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...valueParts] = line.split(":");
      return {
        label: label?.trim() || "Campo",
        value: valueParts.join(":").trim() || line,
      };
    });
}

function splitFindings(findings: string): StructuredFinding[] {
  const normalized = findings.trim();

  if (!normalized) {
    return [];
  }

  const structuredBlocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => /Documento\s*:|Página provável\s*:|Pagina provavel\s*:/i.test(block));

  if (structuredBlocks.length > 0) {
    return structuredBlocks.map((block, index) => ({
      title:
        block
          .split("\n")[0]
          ?.replace(/^[-•]\s*/, "")
          .replace(/^Achado\s*\d+\s*:\s*/i, "")
          .trim() || `Achado ${index + 1}`,
      severity: getFindingSeverity(block),
      documento: getFindingField(block, "Documento"),
      pagina:
        getFindingField(block, "Página provável") ??
        getFindingField(block, "Pagina provável") ??
        getFindingField(block, "Pagina provavel"),
      local: getFindingField(block, "Local"),
      evidencia:
        getFindingField(block, "Evidência") ??
        getFindingField(block, "Evidencia"),
      termoBusca: getFindingField(block, "Termo de busca"),
      conflito: getFindingField(block, "Conflito"),
      acao:
        getFindingField(block, "Ação recomendada") ??
        getFindingField(block, "Acao recomendada") ??
        getFindingField(block, "Acao recomendada"),
      categoria: getFindingField(block, "Categoria"),
      referencia:
        getFindingField(block, "Referência comparada") ??
        getFindingField(block, "Referencia comparada"),
      raw: block,
    }));
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      title: line.replace(/^[-•]\s*/, ""),
      severity: getFindingSeverity(line),
      raw: line,
      pagina: "não informada",
      local: "não informado",
      acao: index === 0 ? undefined : undefined,
    }));
}

function buildFindingsText(findings: StructuredFinding[]) {
  if (findings.length === 0) {
    return "Nenhum achado encontrado.";
  }

  return findings
    .map((finding, index) => {
      return [
        `${index + 1}. ${finding.title}`,
        finding.documento ? `Documento: ${finding.documento}` : null,
        finding.pagina ? `Página: ${finding.pagina}` : null,
        finding.local ? `Local: ${finding.local}` : null,
        finding.evidencia ? `Evidência: ${finding.evidencia}` : null,
        finding.termoBusca ? `Termo de busca: ${finding.termoBusca}` : null,
        finding.conflito ? `Conflito: ${finding.conflito}` : null,
        finding.acao ? `Ação recomendada: ${finding.acao}` : null,
        finding.categoria ? `Categoria: ${finding.categoria}` : null,
        finding.referencia ? `Referência comparada: ${finding.referencia}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildActionsText(findings: StructuredFinding[]) {
  const actions = findings
    .map((finding) => finding.acao)
    .filter((value): value is string => Boolean(value));

  if (actions.length === 0) {
    return "Nenhuma ação recomendada identificada.";
  }

  return actions.map((action, index) => `${index + 1}. ${action}`).join("\n");
}

function getFirstPageNumber(value?: string) {
  const match = value?.match(/\d+/);

  if (!match) {
    return null;
  }

  const page = Number(match[0]);

  return Number.isFinite(page) && page > 0 ? page : null;
}

function normalizeFileName(value: string) {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function findPdfSource(
  finding: StructuredFinding,
  pdfSources: AuditPdfSource[],
) {
  if (pdfSources.length === 0) {
    return null;
  }

  const documentName = normalizeFileName(finding.documento ?? "");

  if (documentName) {
    const directMatch = pdfSources.find((source) => {
      const sourceName = normalizeFileName(source.name);

      return sourceName === documentName || documentName.includes(sourceName);
    });

    if (directMatch) {
      return directMatch;
    }
  }

  return pdfSources.length === 1 ? pdfSources[0] : null;
}

function openPdfAtFinding(finding: StructuredFinding, pdfSources: AuditPdfSource[]) {
  const source = findPdfSource(finding, pdfSources);

  if (!source) {
    return;
  }

  const page = getFirstPageNumber(finding.pagina);
  const url = page ? `${source.url}#page=${page}` : source.url;
  window.open(url, "_blank", "noopener,noreferrer");
}

function reportFindingToStructured(finding: AuditFinding): StructuredFinding {
  const severity =
    finding.prioridade === "Alta" || finding.prioridade === "Media/Alta"
      ? "critical"
      : finding.prioridade === "Baixa"
        ? "ok"
        : "warning";

  return {
    title: finding.tipo,
    refId: finding.id,
    severity,
    documento: finding.arquivo,
    pagina: finding.pagina,
    local: finding.local,
    evidencia: finding.evidencia,
    termoBusca: finding.termo_busca ?? finding.evidencia,
    conflito: finding.conflito,
    acao: finding.sugestao_correcao,
    categoria: finding.capitulo,
    referencia: finding.descricao,
    impacto: finding.impacto ?? classifyFindingImpact(finding),
    raw: [
      `${finding.id}: ${finding.tipo}`,
      `Prioridade: ${finding.prioridade}`,
      `Pagina: ${finding.pagina}`,
      `Capitulo: ${finding.capitulo}`,
      `Local: ${finding.local}`,
      `Evidencia: ${finding.evidencia}`,
      `Termo de busca: ${finding.termo_busca ?? finding.evidencia}`,
      `Conflito: ${finding.conflito}`,
      `Acao recomendada: ${finding.sugestao_correcao}`,
      `Impacto: ${getImpactLabel(finding.impacto ?? classifyFindingImpact(finding))}`,
      `Confianca: ${finding.confianca}`,
    ].join("\n"),
  };
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card/80 p-4 shadow-[var(--shadow-panel)]">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export function AuditResult({
  content,
  elapsedMs,
  report,
  pdfSources = [],
}: AuditResultProps) {
  const [view, setView] = useState<"summary" | "findings" | "evidence" | "report">("summary");
  const parsed = parseAuditResult(content);
  const status = getStatusVariant(report?.status_geral ?? parsed.status);
  const StatusIcon = status.icon;
  const elapsed = formatElapsedTime(elapsedMs);
  const findings = report
    ? report.incongruencias.map(reportFindingToStructured)
    : splitFindings(parsed.findings);
  const findingsWithPdf = findings.map((finding) => ({
    ...finding,
    pdfUrl: findPdfSource(finding, pdfSources)?.url,
  }));
  const groupedReportFindings = report
    ? groupFindingsByImpact(report.incongruencias)
    : null;
  const groupedStructuredFindings = {
    critico_documental: findingsWithPdf.filter((finding) => finding.impacto === "critico_documental" || (!finding.impacto && finding.severity === "critical")),
    tecnico_contratual: findingsWithPdf.filter((finding) => finding.impacto === "tecnico_contratual"),
    revisao_editorial: findingsWithPdf.filter((finding) => finding.impacto === "revisao_editorial" || (!finding.impacto && finding.severity !== "critical")),
  };
  const findingsText = buildFindingsText(findingsWithPdf);
  const actionsText = buildActionsText(findingsWithPdf);
  const projectFields = report
    ? [
        { label: "Arquivo", value: report.arquivo ?? "nao informado" },
        { label: "Obra", value: report.obra || "nao identificada" },
        { label: "Codigo", value: report.codigo || "nao identificado" },
        { label: "Municipio", value: report.municipio || "nao identificado" },
        { label: "Data", value: report.data_documento || "nao identificada" },
        { label: "Total de achados", value: String(report.total_incongruencias) },
      ]
    : parseProjectFields(parsed.project);
  const criticalCount = groupedReportFindings
    ? groupedReportFindings.critico_documental.length
    : findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <article className="w-full rounded-lg border bg-[var(--nexodoc-panel)] p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Resultado da auditoria</Badge>
            {elapsed ? (
              <Badge variant="outline">Concluída em {elapsed}</Badge>
            ) : null}
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
              status.className,
            )}
          >
            <StatusIcon className="size-4" />
            {status.label}
          </div>
        </div>
        <AuditResultActions result={content} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border bg-[var(--nexodoc-recessed)] p-1">
        <Button
          type="button"
          variant={view === "summary" ? "secondary" : "outline"}
          size="sm"
          className="border-transparent"
          onClick={() => setView("summary")}
        >
          Resumo
        </Button>
        <Button
          type="button"
          variant={view === "findings" ? "secondary" : "outline"}
          size="sm"
          className="border-transparent"
          onClick={() => setView("findings")}
        >
          Achados
        </Button>
        <Button
          type="button"
          variant={view === "evidence" ? "secondary" : "outline"}
          size="sm"
          className="border-transparent"
          onClick={() => setView("evidence")}
        >
          Evidências
        </Button>
        <Button
          type="button"
          variant={view === "report" ? "secondary" : "outline"}
          size="sm"
          className="border-transparent"
          onClick={() => setView("report")}
        >
          Relatório
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => copyText(findingsText)}
        >
          Copiar achados
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyText(actionsText)}
        >
          Copiar ações
        </Button>
      </div>

      <div className="mt-4 grid gap-4">
        {view === "summary" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border bg-background p-3">
                <p className="text-xs text-muted-foreground">Achados</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {findings.length}
                </p>
              </div>
              <div className="border bg-background p-3">
                <p className="text-xs text-muted-foreground">Inconsistências críticas</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--status-critical)]">
                  {criticalCount}
                </p>
              </div>
              <div className="border bg-background p-3">
                <p className="text-xs text-muted-foreground">Pontos de revisão</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--status-warning)]">
                  {warningCount}
                </p>
              </div>
            </div>

            <SectionCard title="Projeto analisado" icon={ClipboardCheck}>
              {projectFields.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {projectFields.map((field) => (
                    <div key={`${field.label}-${field.value}`} className="border bg-background p-3">
                      <p className="text-xs uppercase text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Não identificado na resposta.</p>
              )}
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Arquivos analisados" icon={FileText}>
                <pre className="whitespace-pre-wrap break-words font-sans">
                  {report
                    ? report.arquivos_analisados
                        .map((item) => {
                          return `${item.arquivo} | ${item.tipo_documento} | ${item.paginas ?? "-"} paginas | ${item.caracteres_extraidos ?? "-"} caracteres\n${item.resumo}`;
                        })
                        .join("\n\n")
                    : parsed.files || "Sem informacao especifica."}
                </pre>
              </SectionCard>
              <SectionCard title="Comparacoes" icon={LayoutList}>
                <pre className="whitespace-pre-wrap break-words font-sans">
                  {report
                    ? report.comparacoes.map((item) => `- ${item}`).join("\n")
                    : parsed.comparisons || "Sem comparacao especifica."}
                </pre>
              </SectionCard>
            </div>

            <SectionCard title="Analise por arquivo" icon={ClipboardList}>
              <pre className="whitespace-pre-wrap break-words font-sans">
                {report
                  ? report.arquivos_analisados
                      .map((item) => `${item.arquivo}\n${item.resumo}`)
                      .join("\n\n")
                  : parsed.fileAnalysis || "Sem analise por arquivo identificada."}
              </pre>
            </SectionCard>

            <SectionCard title="Conclusão objetiva" icon={CheckCircle2}>
              <pre className="whitespace-pre-wrap break-words font-sans">
                {report?.conclusao || parsed.conclusion || "Sem conclusão identificada."}
              </pre>
            </SectionCard>
          </>
        ) : null}

        {view === "findings" ? (
          <SectionCard title="Achados e ações recomendadas" icon={MapPin}>
            {findings.length > 0 ? (
              <div className="space-y-5">
                {[
                  {
                    title: "Críticos documentais",
                    description: "Endereço, bairro, município, proprietário, cliente, obra, identidade ou trecho reaproveitado.",
                    items: groupedStructuredFindings.critico_documental,
                  },
                  {
                    title: "Pontos de revisão técnica",
                    description: "Normas, cálculos, hierarquia técnica, compatibilização, redação e padronização.",
                    items: groupedStructuredFindings.tecnico_contratual,
                  },
                  {
                    title: "Revisões editoriais",
                    description: "Redação, nomenclatura, formatação e padronização.",
                    items: groupedStructuredFindings.revisao_editorial,
                  },
                ].map((group) =>
                  group.items.length > 0 ? (
                    <section key={group.title} className="space-y-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {group.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                      <ul className="space-y-3">
                        {group.items.map((finding, index) => (
                          <li
                            key={`${finding.raw}-${group.title}-${index}`}
                            className="rounded-lg border bg-background/80 p-4"
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-2">
                                  <Search className="mt-0.5 size-4 shrink-0 text-primary" />
                                  <p className="font-medium text-foreground">
                                    {index + 1}. {finding.title}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  {finding.refId ? (
                                    <span className="w-fit border px-2 py-1 text-xs text-muted-foreground">
                                      Ref. {finding.refId}
                                    </span>
                                  ) : null}
                                  <span
                                    className={cn(
                                      "w-fit border px-2 py-1 text-xs font-medium",
                                      getSeverityClass(finding.severity),
                                    )}
                                  >
                                    {finding.impacto
                                      ? getImpactLabel(finding.impacto)
                                      : getSeverityLabel(finding.severity)}
                                  </span>
                                </div>
                              </div>

                              <div className="grid gap-2 rounded-md border bg-[var(--nexodoc-recessed)] p-3 text-xs sm:grid-cols-3">
                                <p>
                                  <span className="block text-muted-foreground">Documento</span>
                                  <span className="font-medium text-foreground">
                                    {finding.documento || "não informado"}
                                  </span>
                                </p>
                                <p>
                                  <span className="block text-muted-foreground">Página</span>
                                  <span className="font-medium text-foreground">
                                    {finding.pagina || "não identificada"}
                                  </span>
                                </p>
                                <p>
                                  <span className="block text-muted-foreground">Local</span>
                                  <span className="font-medium text-foreground">
                                    {finding.local || "não informado"}
                                  </span>
                                </p>
                              </div>
                              {finding.pdfUrl ? (
                                <div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openPdfAtFinding(finding, pdfSources)
                                    }
                                  >
                                    <ExternalLink />
                                    Abrir página no PDF
                                  </Button>
                                </div>
                              ) : null}
                              {(finding.categoria || finding.referencia) ? (
                                <div className="grid gap-2 text-xs sm:grid-cols-2">
                                  {finding.categoria ? (
                                    <p>
                                      <span className="font-medium text-foreground">Categoria:</span>{" "}
                                      {finding.categoria}
                                    </p>
                                  ) : null}
                                  {finding.referencia ? (
                                    <p>
                                      <span className="font-medium text-foreground">
                                        Referência comparada:
                                      </span>{" "}
                                      {finding.referencia}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {finding.evidencia ? (
                                <p className="border-l-2 border-primary pl-3 text-xs">
                                  <span className="font-medium text-foreground">Evidência:</span>{" "}
                                  {finding.evidencia}
                                </p>
                              ) : null}
                              {finding.termoBusca ? (
                                <div className="flex flex-col gap-2 rounded-md border bg-[var(--nexodoc-recessed)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                                  <p className="min-w-0">
                                    <span className="font-medium text-foreground">
                                      Buscar no PDF:
                                    </span>{" "}
                                    <span className="break-words text-foreground">
                                      {finding.termoBusca}
                                    </span>
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyText(finding.termoBusca ?? "")}
                                  >
                                    Copiar termo
                                  </Button>
                                </div>
                              ) : null}
                              {finding.conflito ? (
                                <p className="text-xs">
                                  <span className="font-medium text-foreground">Conflito:</span>{" "}
                                  {finding.conflito}
                                </p>
                              ) : null}
                              {finding.acao ? (
                                <p className="border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning)]">
                                  <Wrench className="mr-1 inline size-3" />
                                  {finding.acao}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null,
                )}
              </div>
            ) : (
              <p>Nenhum achado encontrado.</p>
            )}
          </SectionCard>
        ) : null}

        {view === "evidence" ? (
          <SectionCard title="Localização no PDF" icon={Eye}>
            {findingsWithPdf.length > 0 ? (
              <div className="grid gap-3">
                {findingsWithPdf.map((finding, index) => (
                  <div key={`${finding.raw}-evidence-${index}`} className="rounded-lg border bg-background/80 p-4">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                        <p className="text-xs uppercase text-muted-foreground">
                          Localização {index + 1}
                        </p>
                        <h4 className="mt-1 font-medium text-foreground">
                          {finding.title}
                        </h4>
                        </div>
                        {finding.pdfUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPdfAtFinding(finding, pdfSources)}
                          >
                            <ExternalLink />
                            Abrir página
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-2 rounded-md border bg-[var(--nexodoc-recessed)] p-3 text-xs sm:grid-cols-3">
                        <p>
                          <span className="block text-muted-foreground">Documento</span>
                          <span className="font-medium text-foreground">
                            {finding.documento || "não informado"}
                          </span>
                        </p>
                        <p>
                          <span className="block text-muted-foreground">Página provável</span>
                          <span className="font-medium text-foreground">
                            {finding.pagina || "não identificada"}
                          </span>
                        </p>
                        <p>
                          <span className="block text-muted-foreground">Local</span>
                          <span className="font-medium text-foreground">
                            {finding.local || "não informado"}
                          </span>
                        </p>
                      </div>
                      {(finding.categoria || finding.referencia) ? (
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          {finding.categoria ? (
                            <p>
                              <span className="font-medium text-foreground">Categoria:</span>{" "}
                              {finding.categoria}
                            </p>
                          ) : null}
                          {finding.referencia ? (
                            <p>
                              <span className="font-medium text-foreground">
                                Referência comparada:
                              </span>{" "}
                              {finding.referencia}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {finding.evidencia ? (
                        <p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground">
                          {finding.evidencia}
                        </p>
                      ) : null}
                      {finding.termoBusca ? (
                        <div className="flex flex-col gap-2 rounded-md border bg-[var(--nexodoc-recessed)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <p className="min-w-0">
                            <span className="font-medium text-foreground">
                              Termo para localizar:
                            </span>{" "}
                            <span className="break-words text-foreground">
                              {finding.termoBusca}
                            </span>
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyText(finding.termoBusca ?? "")}
                          >
                            Copiar termo
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          O PDF abre na página provável. Use o termo de busca para localizar o trecho exato.
                        </span>
                        {!finding.pdfUrl ? (
                          <span className="text-[var(--status-warning)]">
                            PDF indisponível nesta sessão.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>Nenhuma evidência visual necessária para este resultado.</p>
            )}
          </SectionCard>
        ) : null}

        {view === "report" ? (
          <SectionCard title="Relatório da auditoria" icon={ClipboardList}>
            <div className="space-y-4 text-foreground">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Projeto
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                  {report
                    ? `Arquivo: ${report.arquivo ?? "nao informado"}\nObra: ${report.obra}\nCodigo: ${report.codigo}\nMunicipio: ${report.municipio}`
                    : parsed.project || "Não identificado na resposta."}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Status
                </p>
                <p className="mt-1 text-sm">{status.label}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Achados
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {findingsText}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Ações recomendadas
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {actionsText}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Conclusão
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                  {report?.conclusao || parsed.conclusion || "Sem conclusão identificada."}
                </pre>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </article>
  );
}
