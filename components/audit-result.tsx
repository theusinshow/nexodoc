"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  LayoutList,
  MapPin,
  Route,
  Search,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AuditResultActions } from "@/components/audit-result-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAnalysisLevelLabel } from "@/lib/analysis-level";
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
  auditId?: string;
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

type FeedbackVerdict =
  | "CONFIRMED"
  | "FALSE_POSITIVE"
  | "WRONG_SEVERITY"
  | "MISSING_FINDING";

type SavedFeedback = {
  id: string;
  findingId: string | null;
  verdict: FeedbackVerdict;
  note: string;
};

function getFeedbackEndpoint(auditId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const path = `/api/audits/${encodeURIComponent(auditId)}/feedback`;

  return apiUrl ? `${apiUrl}${path}` : path;
}

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
  const uniqueActions = [...new Set(actions.map((action) => action.trim()).filter(Boolean))];

  if (uniqueActions.length === 0) {
    return "Nenhuma ação recomendada identificada.";
  }

  return uniqueActions.map((action, index) => `${index + 1}. ${action}`).join("\n");
}

function getFirstAction(findings: StructuredFinding[]) {
  return findings.find((finding) => finding.acao)?.acao;
}

function countUniqueDocuments(findings: StructuredFinding[]) {
  return new Set(
    findings
      .map((finding) => finding.documento)
      .filter((value): value is string => Boolean(value)),
  ).size;
}

function buildReviewRouteText(findings: StructuredFinding[]) {
  if (findings.length === 0) {
    return "Nenhum achado para revisar.";
  }

  return groupFindingsByDocumentPage(findings)
    .map((documentGroup) => {
      const pages = documentGroup.pages
        .map((pageGroup) => {
          const items = pageGroup.items
            .map((finding, index) => {
              return [
                `${index + 1}. ${finding.title}`,
                finding.local ? `Local: ${finding.local}` : null,
                finding.termoBusca ? `Buscar: ${finding.termoBusca}` : null,
                finding.acao ? `Ação: ${finding.acao}` : null,
              ]
                .filter(Boolean)
                .join("\n   ");
            })
            .join("\n");

          return `Página ${pageGroup.page}\n${items}`;
        })
        .join("\n\n");

      return `${documentGroup.document}\n\n${pages}`;
    })
    .join("\n\n---\n\n");
}

function getFirstPageNumber(value?: string) {
  const match = value?.match(/\d+/);

  if (!match) {
    return null;
  }

  const page = Number(match[0]);

  return Number.isFinite(page) && page > 0 ? page : null;
}

function getPageSortValue(value: string) {
  return getFirstPageNumber(value) ?? Number.MAX_SAFE_INTEGER;
}

function groupFindingsByDocumentPage(findings: StructuredFinding[]) {
  const documents = new Map<
    string,
    Map<string, StructuredFinding[]>
  >();

  for (const finding of findings) {
    const document = finding.documento || "Documento não informado";
    const page = finding.pagina || "não identificada";
    const pageMap = documents.get(document) ?? new Map<string, StructuredFinding[]>();
    const pageFindings = pageMap.get(page) ?? [];

    pageFindings.push(finding);
    pageMap.set(page, pageFindings);
    documents.set(document, pageMap);
  }

  return [...documents.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([document, pageMap]) => ({
      document,
      pages: [...pageMap.entries()]
        .sort(([a], [b]) => getPageSortValue(a) - getPageSortValue(b))
        .map(([page, items]) => ({ page, items })),
    }));
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getHighlightNeedle(finding: StructuredFinding) {
  const evidence = finding.evidencia ?? "";
  const candidates = [
    finding.termoBusca,
    ...Array.from((finding.conflito ?? "").matchAll(/"([^"]{3,120})"/g)).map(
      (match) => match[1],
    ),
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item && item.length >= 3));

  return (
    candidates.find((candidate) =>
      evidence.toLowerCase().includes(candidate.toLowerCase()),
    ) ?? candidates[0] ?? ""
  );
}

function HighlightedEvidence({
  text,
  needle,
}: {
  text?: string;
  needle?: string;
}) {
  if (!text) {
    return <span>Evidência não informada no resultado.</span>;
  }

  const cleanNeedle = needle?.trim();

  if (!cleanNeedle) {
    return <span>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(cleanNeedle)})`, "i"));

  if (parts.length === 1) {
    return <span>{text}</span>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === cleanNeedle.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-sm border border-primary/30 bg-primary/20 px-1 py-0.5 font-medium text-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function wrapSnapshotText(value: string, maxLength: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
      continue;
    }

    current = next;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

async function createFindingSnapshot(finding: StructuredFinding, index: number) {
  const rows = [
    `Achado ${index + 1}${finding.refId ? ` | ${finding.refId}` : ""}`,
    finding.title,
    `Documento: ${finding.documento || "não informado"}`,
    `Página provável: ${finding.pagina || "não identificada"}`,
    `Local: ${finding.local || "não informado"}`,
    `Evidência: ${finding.evidencia || "não informada"}`,
    `Conflito: ${finding.conflito || finding.referencia || "não informado"}`,
    `Ação: ${finding.acao || "revisar o trecho indicado"}`,
    `Termo de busca: ${finding.termoBusca || finding.evidencia || "não informado"}`,
  ];
  const lines = rows.flatMap((row, rowIndex) => {
    const wrapped = wrapSnapshotText(row, rowIndex <= 1 ? 78 : 92);
    return rowIndex === 0 ? wrapped : ["", ...wrapped];
  });
  const width = 1400;
  const lineHeight = 28;
  const height = Math.max(720, 96 + lines.length * lineHeight);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0B0D0E"/>
  <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="10" fill="#171B1D" stroke="rgba(230,235,233,0.14)"/>
  <text x="76" y="88" fill="#8A9490" font-family="JetBrains Mono, ui-monospace, monospace" font-size="18">NexoDoc | evidência de auditoria</text>
  ${lines
    .map((line, lineIndex) => {
      const isTitle = lineIndex === 0;
      const isFindingTitle = lineIndex === 2;
      const fill = isTitle ? "#8A9490" : isFindingTitle ? "#E6EBE9" : "#D4DBD8";
      const size = isFindingTitle ? 24 : 19;
      const weight = isTitle || isFindingTitle ? 700 : 400;

      return `<text x="76" y="${134 + lineIndex * lineHeight}" fill="${fill}" font-family="Inter, system-ui, sans-serif" font-size="${size}" font-weight="${weight}">${escapeSvgText(line || " ")}</text>`;
    })
    .join("\n")}
</svg>`.trim();
  const image = new Image();
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não foi possível gerar o print do achado."));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas indisponível para gerar o print.");
  }

  context.drawImage(image, 0, 0);
  const link = document.createElement("a");
  link.download = `nexodoc-achado-${finding.refId ?? index + 1}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
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
    categoria: finding.categoria ?? finding.capitulo,
    referencia: finding.referencia_comparada ?? finding.descricao,
    impacto: finding.impacto ?? classifyFindingImpact(finding),
    raw: [
      `${finding.id}: ${finding.tipo}`,
      `Prioridade: ${finding.prioridade}`,
      `Página: ${finding.pagina}`,
      `Capítulo: ${finding.capitulo}`,
      `Local: ${finding.local}`,
      `Evidência: ${finding.evidencia}`,
      `Termo de busca: ${finding.termo_busca ?? finding.evidencia}`,
      `Conflito: ${finding.conflito}`,
      `Ação recomendada: ${finding.sugestao_correcao}`,
      `Impacto: ${getImpactLabel(finding.impacto ?? classifyFindingImpact(finding))}`,
      `Confiança: ${finding.confianca}`,
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
    <section className="nexodoc-section-reveal border-b pb-5 last:border-b-0 last:pb-0">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

function CopyTextButton({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={handleCopy}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copiado" : children}
    </Button>
  );
}

function FindingSnapshotButton({
  finding,
  index,
}: {
  finding: StructuredFinding;
  index: number;
}) {
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateSnapshot() {
    setIsCreating(true);

    try {
      await createFindingSnapshot(finding, index);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCreateSnapshot}
      disabled={isCreating}
    >
      <Eye />
      {isCreating ? "Gerando" : "Print do achado"}
    </Button>
  );
}

function FindingField({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-2.5">
      <p className="font-mono text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">
        {value || "não informado"}
      </p>
    </div>
  );
}

export function AuditResult({
  content,
  auditId,
  elapsedMs,
  report,
  pdfSources = [],
}: AuditResultProps) {
  const [view, setView] = useState<"summary" | "findings" | "route" | "evidence" | "report">("summary");
  const [feedbackByFinding, setFeedbackByFinding] = useState<Record<string, FeedbackVerdict>>({});
  const [feedbackSavingKey, setFeedbackSavingKey] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [missingFindingNote, setMissingFindingNote] = useState("");
  const parsed = parseAuditResult(content);
  const status = getStatusVariant(report?.status_geral ?? parsed.status);
  const StatusIcon = status.icon;
  const elapsed = formatElapsedTime(elapsedMs);
  const runtime = report?.runtime;
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
  const reviewRouteText = buildReviewRouteText(findingsWithPdf);
  const reviewRoute = groupFindingsByDocumentPage(findingsWithPdf);
  const uniqueDocumentCount = countUniqueDocuments(findingsWithPdf);
  const evidenceLinkCount = findingsWithPdf.filter((finding) => finding.pdfUrl).length;
  const criticalCount = groupedReportFindings
    ? groupedReportFindings.critico_documental.length
    : findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const firstAction = getFirstAction(findingsWithPdf);
  const nextStep =
    firstAction ??
    (criticalCount > 0
      ? "Revisar achados críticos antes da emissão."
      : "Validar pontos de revisão e registrar aceite técnico.");
  const confidenceItems = [
    {
      label: "Status",
      value: status.label,
      tone: status.className,
    },
    {
      label: "Arquivos",
      value: uniqueDocumentCount > 0 ? String(uniqueDocumentCount) : "não informado",
    },
    {
      label: "Achados",
      value: String(findings.length),
    },
    {
      label: "Evidências",
      value:
        evidenceLinkCount > 0
          ? `${evidenceLinkCount}/${findingsWithPdf.length} com PDF`
          : "sem PDF local",
    },
  ];
  const projectFields = report
    ? [
        { label: "Arquivo", value: report.arquivo ?? "não informado" },
        { label: "Obra", value: report.obra || "não identificada" },
        { label: "Código", value: report.codigo || "não identificado" },
        { label: "Município", value: report.municipio || "não identificado" },
        { label: "Data", value: report.data_documento || "não identificada" },
        { label: "Nível", value: getAnalysisLevelLabel(report.runtime?.nivel_analise ?? "standard") },
        { label: "Modelo", value: report.runtime?.modelo_principal || "não informado" },
        { label: "Validação", value: report.runtime?.modelo_validacao || report.runtime?.modelo_principal || "não informado" },
        { label: "Total de achados", value: String(report.total_incongruencias) },
      ]
    : parseProjectFields(parsed.project);

  useEffect(() => {
    if (!auditId) {
      return;
    }

    async function loadFeedback() {
      try {
        const response = await fetch(getFeedbackEndpoint(auditId!), { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { feedback?: SavedFeedback[] };
        const saved = Object.fromEntries(
          (payload.feedback ?? [])
            .filter((item) => item.findingId)
            .map((item) => [item.findingId as string, item.verdict]),
        );

        setFeedbackByFinding(saved);
      } catch {
        // O relatório continua utilizável mesmo sem carregar avaliação.
      }
    }

    void loadFeedback();
  }, [auditId]);

  async function saveFindingFeedback(
    finding: StructuredFinding,
    index: number,
    verdict: FeedbackVerdict,
  ) {
    if (!auditId) {
      return;
    }

    const findingId = finding.refId ?? `achado-${index + 1}`;
    setFeedbackSavingKey(findingId);
    setFeedbackNotice("");

    try {
      const response = await fetch(getFeedbackEndpoint(auditId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId,
          findingLabel: finding.title,
          page: finding.pagina,
          verdict,
        }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível salvar a avaliação.");
      }

      setFeedbackByFinding((current) => ({ ...current, [findingId]: verdict }));
      setFeedbackNotice("Avaliação registrada para o benchmark.");
    } catch (error) {
      setFeedbackNotice(
        error instanceof Error ? error.message : "Não foi possível salvar a avaliação.",
      );
    } finally {
      setFeedbackSavingKey("");
    }
  }

  async function saveMissingFinding() {
    if (!auditId || !missingFindingNote.trim()) {
      setFeedbackNotice("Descreva brevemente o erro que faltou apontar.");
      return;
    }

    setFeedbackSavingKey("missing");
    setFeedbackNotice("");

    try {
      const response = await fetch(getFeedbackEndpoint(auditId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: "MISSING_FINDING",
          note: missingFindingNote.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível registrar o erro ausente.");
      }

      setMissingFindingNote("");
      setFeedbackNotice("Erro ausente registrado para revisão do motor.");
    } catch (error) {
      setFeedbackNotice(
        error instanceof Error ? error.message : "Não foi possível registrar o erro ausente.",
      );
    } finally {
      setFeedbackSavingKey("");
    }
  }

  return (
    <article className="nexodoc-result-in w-full rounded-sm border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-sm font-medium",
                status.className,
              )}
            >
              <StatusIcon className="size-4" />
              {status.label}
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {findings.length} achado{findings.length !== 1 ? "s" : ""} em {uniqueDocumentCount || pdfSources.length || "?"} arquivo{pdfSources.length !== 1 ? "s" : ""}
              {elapsed ? ` · ${elapsed}` : ""}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold">{nextStep}</h3>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-sm bg-[var(--nexodoc-recessed)] p-0.5">
              {([
                { value: "summary" as const, label: "Resumo" },
                { value: "findings" as const, label: "Matriz" },
                { value: "evidence" as const, label: "Evidências" },
                { value: "route" as const, label: "Roteiro" },
                { value: "report" as const, label: "Relatório" },
              ]).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setView(tab.value)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 font-mono text-xs outline-none transition-colors",
                    view === tab.value
                      ? "border border-ring/30 bg-card font-medium text-foreground"
                      : "border border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <CopyTextButton value={findingsText}>Copiar achados</CopyTextButton>
          <CopyTextButton value={actionsText}>Copiar ações</CopyTextButton>
          <AuditResultActions result={content} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {confidenceItems.map((item) => (
          <div key={item.label} className="rounded-sm border bg-[var(--nexodoc-recessed)] px-3 py-2.5">
            <p className="font-mono text-[11px] text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                "mt-0.5 font-mono text-sm font-medium text-foreground",
                item.tone && "inline-flex rounded-sm border px-1.5 py-px font-mono text-[11px]",
                item.tone,
              )}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5">
        {view === "summary" ? (
          <>
            <div className="grid divide-y rounded-sm border bg-[var(--nexodoc-recessed)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <p className="font-mono text-[11px] text-muted-foreground">Achados</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{findings.length}</p>
              </div>
              <div className="px-4 py-3">
                <p className="font-mono text-[11px] text-muted-foreground">Inconsistências críticas</p>
                <p className="mt-1 text-xl font-semibold text-[var(--status-critical)]">{criticalCount}</p>
              </div>
              <div className="px-4 py-3">
                <p className="font-mono text-[11px] text-muted-foreground">Pontos de revisão</p>
                <p className="mt-1 text-xl font-semibold text-[var(--status-warning)]">{warningCount}</p>
              </div>
            </div>

            <SectionCard title="Projeto analisado" icon={ClipboardCheck}>
              {projectFields.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {projectFields.map((field) => (
                    <div key={`${field.label}-${field.value}`} className="rounded-sm border bg-[var(--nexodoc-recessed)] p-3">
                      <p className="font-mono text-[11px] text-muted-foreground">{field.label}</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{field.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Não identificado na resposta.</p>
              )}
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Arquivos analisados" icon={FileText}>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {report
                    ? report.arquivos_analisados
                        .map((item) => {
                          return `${item.arquivo} | ${item.tipo_documento} | ${item.paginas ?? "-"} páginas | ${item.caracteres_extraidos ?? "-"} caracteres\n${item.resumo}`;
                        })
                        .join("\n\n")
                    : parsed.files || "Sem informação específica."}
                </pre>
              </SectionCard>
              <SectionCard title="Comparações" icon={LayoutList}>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {report
                    ? report.comparacoes.map((item) => `- ${item}`).join("\n")
                    : parsed.comparisons || "Sem comparação específica."}
                </pre>
              </SectionCard>
            </div>

            <SectionCard title="Conclusão objetiva" icon={CheckCircle2}>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                {report?.conclusao || parsed.conclusion || "Sem conclusão identificada."}
              </pre>
            </SectionCard>
          </>
        ) : null}

        {view === "findings" ? (
          <SectionCard title="Matriz de achados" icon={MapPin}>
            {findings.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-[var(--nexodoc-recessed)] p-4">
                  <p className="font-mono text-xs uppercase text-muted-foreground">
                    Como ler
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    Cada linha mostra o problema, onde conferir, a evidência encontrada, o conflito e a ação recomendada. Use o termo de busca para localizar o trecho no PDF.
                  </p>
                </div>

                <div className="grid gap-4">
                  {findingsWithPdf.map((finding, index) => (
                    <article
                      key={`${finding.raw}-matrix-${index}`}
                      className="overflow-hidden rounded-md border bg-card"
                    >
                      <div className="grid gap-4 border-b bg-[var(--nexodoc-recessed)]/70 p-4 xl:grid-cols-[minmax(18rem,1fr)_auto] xl:items-start">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-md border bg-card px-2 py-1 font-mono text-xs text-muted-foreground">
                              Achado {index + 1}
                            </span>
                            <span
                              className={cn(
                                "rounded-md border px-2 py-1 font-mono text-xs font-medium",
                                getSeverityClass(finding.severity),
                              )}
                            >
                              {finding.impacto
                                ? getImpactLabel(finding.impacto)
                                : getSeverityLabel(finding.severity)}
                            </span>
                            {finding.refId ? (
                              <span className="rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground">
                                Ref. {finding.refId}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="text-base font-semibold leading-6 text-foreground">
                            {finding.title}
                          </h4>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          {finding.pdfUrl ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openPdfAtFinding(finding, pdfSources)}
                            >
                              <ExternalLink />
                              Abrir PDF
                            </Button>
                          ) : null}
                          {finding.termoBusca ? (
                            <CopyTextButton value={finding.termoBusca}>
                              Copiar termo
                            </CopyTextButton>
                          ) : null}
                          <FindingSnapshotButton finding={finding} index={index} />
                        </div>
                      </div>

                      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)]">
                        <div className="grid content-start gap-2">
                          <FindingField label="Documento" value={finding.documento} />
                          <FindingField label="Página provável" value={finding.pagina} />
                          <FindingField label="Local" value={finding.local} />
                          <FindingField label="Categoria" value={finding.categoria} />
                        </div>

                        <div className="grid gap-3">
                          <section className="rounded-md border bg-[var(--nexodoc-recessed)] p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Search className="size-4 text-primary" />
                              <p className="font-mono text-xs uppercase text-muted-foreground">
                                Evidência encontrada
                              </p>
                            </div>
                            <p className="text-sm leading-6 text-foreground">
                              <HighlightedEvidence
                                text={finding.evidencia}
                                needle={getHighlightNeedle(finding)}
                              />
                            </p>
                          </section>

                          <section className="rounded-md border bg-[var(--nexodoc-recessed)] p-3">
                            <p className="font-mono text-xs uppercase text-muted-foreground">
                              Conflito / por que importa
                            </p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {finding.conflito ||
                                finding.referencia ||
                                "Conflito não detalhado no resultado."}
                            </p>
                          </section>

                          <section className="rounded-md border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)]/70 p-3 text-[var(--status-warning)]">
                            <div className="mb-2 flex items-center gap-2">
                              <Wrench className="size-4" />
                              <p className="font-mono text-xs uppercase">
                                Ação recomendada
                              </p>
                            </div>
                            <p className="text-sm leading-6">
                              {finding.acao || "Ação recomendada não identificada."}
                            </p>
                          </section>

                          <section className="flex items-center justify-between gap-3 rounded-md border bg-[var(--nexodoc-recessed)] p-3">
                            <div className="min-w-0">
                              <p className="font-mono text-xs uppercase text-muted-foreground">
                                Termo de busca
                              </p>
                              <p className="mt-1 break-words text-sm text-foreground">
                                {finding.termoBusca || finding.evidencia || "não informado"}
                              </p>
                            </div>
                            {finding.termoBusca ? (
                              <CopyTextButton value={finding.termoBusca}>
                                Copiar
                              </CopyTextButton>
                            ) : null}
                          </section>

                          {auditId && finding.refId ? (
                            <section className="rounded-md border bg-card p-3">
                              <p className="font-mono text-xs uppercase text-muted-foreground">
                                Avaliar achado
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={feedbackByFinding[finding.refId] === "CONFIRMED" ? "secondary" : "outline"}
                                  disabled={feedbackSavingKey === finding.refId}
                                  onClick={() => void saveFindingFeedback(finding, index, "CONFIRMED")}
                                >
                                  <Check />
                                  Correto
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={feedbackByFinding[finding.refId] === "FALSE_POSITIVE" ? "secondary" : "outline"}
                                  disabled={feedbackSavingKey === finding.refId}
                                  onClick={() => void saveFindingFeedback(finding, index, "FALSE_POSITIVE")}
                                >
                                  <AlertTriangle />
                                  Falso positivo
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={feedbackByFinding[finding.refId] === "WRONG_SEVERITY" ? "secondary" : "outline"}
                                  disabled={feedbackSavingKey === finding.refId}
                                  onClick={() => void saveFindingFeedback(finding, index, "WRONG_SEVERITY")}
                                >
                                  <Wrench />
                                  Gravidade errada
                                </Button>
                              </div>
                            </section>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {auditId ? (
                  <section className="rounded-md border bg-[var(--nexodoc-recessed)] p-4">
                    <p className="font-mono text-xs uppercase text-muted-foreground">
                      Faltou apontar algum erro?
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <textarea
                        value={missingFindingNote}
                        onChange={(event) => setMissingFindingNote(event.target.value)}
                        rows={2}
                        className="min-h-12 flex-1 resize-y rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
                        placeholder="Descreva o erro não identificado pelo NexoDoc."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={feedbackSavingKey === "missing"}
                        onClick={() => void saveMissingFinding()}
                      >
                        Registrar erro ausente
                      </Button>
                    </div>
                    {feedbackNotice ? (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">{feedbackNotice}</p>
                    ) : null}
                  </section>
                ) : null}
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
                {evidenceLinkCount === 0 ? (
                  <div className="rounded-md border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)]/70 p-4 text-sm text-[var(--status-warning)]">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <p className="font-medium">PDF não disponível nesta sessão</p>
                        <p className="mt-1 text-xs leading-5">
                          A demo local e auditorias reabertas do histórico em memória podem não ter arquivo persistido. Ainda assim, os campos abaixo indicam documento, página provável, local e termo para conferência manual.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {findingsWithPdf.map((finding, index) => (
                  <div key={`${finding.raw}-evidence-${index}`} className="rounded-md border bg-card p-4">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                        <p className="font-mono text-xs uppercase text-muted-foreground">
                          Localização {index + 1}
                        </p>
                        <h4 className="mt-1 font-medium text-foreground">
                          {finding.title}
                        </h4>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-1 font-mono text-xs",
                              finding.pdfUrl
                                ? "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
                                : "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
                            )}
                          >
                            {finding.pdfUrl ? "PDF vinculado" : "sem PDF local"}
                          </span>
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
                      </div>
                      <div className="grid gap-2 rounded-md border bg-[var(--nexodoc-recessed)]/80 p-3 font-mono text-xs sm:grid-cols-3">
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
                        <div className="rounded-md border bg-[var(--nexodoc-recessed)] p-3">
                          <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">
                            Trecho grifado
                          </p>
                          <p className="text-sm leading-6 text-foreground">
                            <HighlightedEvidence
                              text={finding.evidencia}
                              needle={getHighlightNeedle(finding)}
                            />
                          </p>
                        </div>
                      ) : null}
                      {finding.termoBusca ? (
                        <div className="flex flex-col gap-2 rounded-md border bg-[var(--nexodoc-recessed)]/80 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <p className="min-w-0">
                            <span className="font-medium text-foreground">
                              Termo para localizar:
                            </span>{" "}
                            <span className="break-words text-foreground">
                              {finding.termoBusca}
                            </span>
                          </p>
                          <CopyTextButton value={finding.termoBusca}>
                            Copiar termo
                          </CopyTextButton>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <FindingSnapshotButton finding={finding} index={index} />
                        {finding.pdfUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPdfAtFinding(finding, pdfSources)}
                          >
                            <ExternalLink />
                            Abrir página provável
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {finding.pdfUrl
                            ? "O PDF abre na página provável. Use o termo de busca para localizar o trecho exato."
                            : "Use este registro como roteiro manual: documento, página provável, local e termo de busca."}
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

        {view === "route" ? (
          <SectionCard title="Roteiro de revisão" icon={Route}>
            {reviewRoute.length > 0 ? (
              <div className="space-y-4">
                {reviewRoute.map((documentGroup) => (
                  <section key={documentGroup.document} className="rounded-md border bg-card p-4">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <FileText className="size-4 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">
                        {documentGroup.document}
                      </h4>
                    </div>
                    <div className="mt-4 space-y-4">
                      {documentGroup.pages.map((pageGroup) => (
                        <div key={`${documentGroup.document}-${pageGroup.page}`} className="grid gap-3 md:grid-cols-[7rem_1fr]">
                          <div className="rounded-md border bg-[var(--nexodoc-recessed)] p-3 font-mono text-xs text-muted-foreground">
                            Página provável
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {pageGroup.page}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {pageGroup.items.map((finding, index) => (
                              <div
                                key={`${finding.raw}-route-${index}`}
                                className="rounded-md border bg-[var(--nexodoc-recessed)]/80 p-3"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex min-w-0 gap-2">
                                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border bg-card font-mono text-xs text-muted-foreground">
                                      {index + 1}
                                    </span>
                                    <p className="font-medium text-foreground">
                                      {finding.title}
                                    </p>
                                  </div>
                                  {finding.pdfUrl ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPdfAtFinding(finding, pdfSources)}
                                    >
                                      <ExternalLink />
                                      Abrir
                                    </Button>
                                  ) : null}
                                </div>
                                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                                  <p>
                                    <span className="text-muted-foreground">Local:</span>{" "}
                                    <span className="text-foreground">
                                      {finding.local || "não informado"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Buscar:</span>{" "}
                                    <span className="text-foreground">
                                      {finding.termoBusca || finding.evidencia || "-"}
                                    </span>
                                  </p>
                                </div>
                                {finding.acao ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {finding.acao}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p>Nenhum achado para revisar.</p>
            )}
          </SectionCard>
        ) : null}

        {view === "report" ? (
          <SectionCard title="Relatório da auditoria" icon={ClipboardList}>
            <div className="space-y-4 text-foreground">
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Projeto
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                  {report
                    ? [
                        `Arquivo: ${report.arquivo ?? "não informado"}`,
                        `Obra: ${report.obra}`,
                        `Projeto: ${report.codigo || "não identificado"}`,
                        `Documento: ${report.tipo_documento || "não identificado"}`,
                        `Volume: ${report.volume || "não identificado"}`,
                        `Data: ${report.data_documento || "não identificada"}`,
                        `Órgão: ${report.orgao || "não identificado"}`,
                      ].join("\n")
                    : parsed.project || "Não identificado na resposta."}
                </pre>
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Status
                </p>
                <p className="mt-1 text-sm">{status.label}</p>
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Achados
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {findingsText}
                </pre>
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Ações recomendadas
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {actionsText}
                </pre>
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
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
