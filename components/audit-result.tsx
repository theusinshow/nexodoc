"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  LayoutList,
  MapPin,
  MoreHorizontal,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { pinsDoDocumento } from "@/lib/pins-do-parecer";
import { EmptyState } from "@/components/ui/empty-state";
import { getAnalysisLevelLabel } from "@/lib/analysis-level";
import { MOLDURA_DE_SINAL, PONTO_DE_SINAL, statusDoVeredito } from "@/lib/audit-status";
import {
  classifyFindingDiscipline,
  classifyFindingErrorType,
  classifyFindingImpact,
  classifyFindingTier,
  getDisciplineLabel,
  getEmissionVerdict,
  getErrorTypeLabel,
  getFindingAssurance,
  getImpactLabel,
  groupFindingsByImpact,
  type AuditFinding,
  type AuditReport,
  type FindingDiscipline,
  type FindingErrorType,
  type FindingImpact,
  type FindingTier,
} from "@/lib/audit-report";
import { cn } from "@/lib/utils";

// Visor de PDF só no cliente (react-pdf não faz SSR).
const AuditPdfViewer = dynamic(() => import("@/components/audit-pdf-viewer-internal"), {
  ssr: false,
  loading: () => (
    <div className="p-3">
      <Skeleton className="h-[70vh] w-full" />
    </div>
  ),
});

type ActivePdf = {
  url: string;
  page: number;
  highlight?: string;
  label?: string;
  /** Gravidade do achado — pinta a marcação no documento. */
  severity?: StructuredFinding["severity"];
};

/**
 * A cor da marcação no PDF SEGUE A GRAVIDADE do achado.
 *
 * Amarelo para tudo tratava um erro que impede a emissão igual a um ponto de
 * atenção — e é no documento aberto, com o trecho na frente, que essa diferença
 * mais importa: é ali que o engenheiro decide se para a entrega ou anota para
 * depois. Fundo tingido com texto escuro para o trecho seguir legível.
 */
/**
 * A cor do pin na margem SEGUE A GRAVIDADE, pelos tokens canônicos.
 *
 * É status — o único lugar do sistema em que cor de sinal é obrigatória. A
 * margem inteira se lê num relance: três corais e um âmbar dizem o tamanho do
 * problema antes de qualquer texto ser lido.
 */
const COR_DO_PIN: Record<StructuredFinding["severity"], string> = {
  critical: "var(--status-critical)",
  warning: "var(--status-warning)",
  ok: "var(--status-ok)",
};

const MARCACAO_POR_GRAVIDADE: Record<StructuredFinding["severity"], string> = {
  critical: "[&_mark]:bg-[var(--status-critical)] [&_mark]:text-[#2b0a08]",
  warning: "[&_mark]:bg-[var(--status-warning)] [&_mark]:text-[#2b1d05]",
  ok: "[&_mark]:bg-[var(--status-ok)] [&_mark]:text-[#052b16]",
};

type AuditResultProps = {
  content: string;
  auditId?: string;
  elapsedMs?: number;
  report?: AuditReport;
  pdfSources?: AuditPdfSource[];
  /**
   * Achados que o engenheiro já corrigiu no memorial (por `refId`).
   *
   * Vem de fora porque é PROGRESSO DE TRABALHO, não conteúdo do parecer: mora
   * junto da conversa, sobrevive ao F5 e não altera o relatório — o achado
   * continua existindo, só sai do caminho de quem já resolveu.
   */
  resolvidos?: ReadonlySet<string>;
  onToggleResolvido?: (refId: string, resolvido: boolean) => void;
  /**
   * A vista, quando quem manda é de fora (a barra de vistas do palco).
   *
   * Ausente, o parecer continua dono da própria vista e desenha o controle
   * segmentado — é assim que ele funciona dentro do drawer do canvas, onde não
   * há barra por perto. Duas fontes para a mesma decisão criariam o clássico:
   * clicar na barra e a aba interna continuar mostrando outra coisa.
   */
  view?: AuditView;
  onViewChange?: (view: AuditView) => void;
  /**
   * Achado a mostrar em foco (`refId`): a vista vai para Achados, a lista rola
   * até ele e ele pisca uma vez. É o que liga o clique no card do canvas ao
   * cartão completo — sem isto, quem vê o problema na página tem de caçá-lo
   * numa lista de 45.
   */
  achadoEmFoco?: string;
};

export type AuditView = "summary" | "findings" | "report";

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
  origem?: "regra" | "ia";
  confianca?: "alta" | "media" | "baixa";
  tier?: FindingTier;
  assurance?: string;
  disciplina?: FindingDiscipline;
  tipoErro?: FindingErrorType;
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

/*
 * Seções do texto exportado, em ordem de decisão: primeiro o que IMPEDE emitir,
 * depois o que exige responsável técnico, depois o acabamento de texto.
 *
 * A lista era plana e numerada de 1 a N. Com a regra de pecar pelo excesso ela
 * cresce bastante, e sem separação o engenheiro lê "edição de norma divergente"
 * com o mesmo peso de "campo XXXX não preenchido". O agrupamento é o que torna
 * o excesso utilizável.
 */
const IMPACT_SECTIONS = [
  {
    key: "critico_documental" as const,
    title: "BLOQUEIA A EMISSÃO",
    hint: "Corrigir antes de gerar o documento.",
  },
  {
    key: "tecnico_contratual" as const,
    title: "EXIGE DECISÃO TÉCNICA",
    hint: "Não impede gerar, mas precisa de aceite do responsável antes de executar.",
  },
  {
    key: "revisao_editorial" as const,
    title: "REVISÃO DE TEXTO",
    hint: "Não muda decisão técnica.",
  },
];

function findingImpactBucket(finding: StructuredFinding) {
  if (finding.impacto) {
    return finding.impacto;
  }

  // Achado sem faixa declarada: severidade é o único sinal disponível.
  return finding.severity === "critical" ? "critico_documental" : "revisao_editorial";
}

function formatFindingBlock(finding: StructuredFinding, position: number) {
  return [
    `${position}. ${finding.title}`,
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
}

function buildFindingsText(findings: StructuredFinding[]) {
  if (findings.length === 0) {
    return "Nenhum achado encontrado.";
  }

  // Numeração contínua entre as seções: o achado 14 é o achado 14 em qualquer
  // lugar que se cite, inclusive na lista de ações.
  let position = 0;

  const sections = IMPACT_SECTIONS.map((section) => {
    const bucket = findings.filter((finding) => findingImpactBucket(finding) === section.key);

    if (bucket.length === 0) {
      return null;
    }

    const blocks = bucket.map((finding) => formatFindingBlock(finding, (position += 1)));

    return [`## ${section.title} (${bucket.length})`, section.hint, "", blocks.join("\n\n")].join(
      "\n",
    );
  }).filter(Boolean);

  return sections.join("\n\n");
}

/**
 * Ações na mesma ordem das seções: as que destravam a emissão primeiro.
 * Continua deduplicando, mas agora dentro da faixa — a mesma ação sugerida para
 * um bloqueador e para um ponto editorial fica no bloqueador.
 */
function buildActionsText(findings: StructuredFinding[]) {
  const seen = new Set<string>();
  const sections: string[] = [];
  let position = 0;

  for (const section of IMPACT_SECTIONS) {
    const actions: string[] = [];

    for (const finding of findings) {
      if (findingImpactBucket(finding) !== section.key) {
        continue;
      }

      const action = finding.acao?.trim();

      if (!action || seen.has(action)) {
        continue;
      }

      seen.add(action);
      actions.push(`${(position += 1)}. ${action}`);
    }

    if (actions.length > 0) {
      sections.push([`## ${section.title}`, actions.join("\n")].join("\n"));
    }
  }

  if (sections.length === 0) {
    return "Nenhuma ação recomendada identificada.";
  }

  return sections.join("\n\n");
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
  <text x="76" y="88" fill="#8A9490" font-family="'IBM Plex Mono', ui-monospace, monospace" font-size="18">Nexo | evidência de auditoria</text>
  ${lines
    .map((line, lineIndex) => {
      const isTitle = lineIndex === 0;
      const isFindingTitle = lineIndex === 2;
      const fill = isTitle ? "#8A9490" : isFindingTitle ? "#E6EBE9" : "#D4DBD8";
      const size = isFindingTitle ? 24 : 19;
      const weight = isTitle || isFindingTitle ? 700 : 400;

      return `<text x="76" y="${134 + lineIndex * lineHeight}" fill="${fill}" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="${size}" font-weight="${weight}">${escapeSvgText(line || " ")}</text>`;
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
    /*
     * FONTE ÚNICA da faixa. Era `finding.impacto ?? classify(...)`, que prefere
     * o valor gravado — enquanto o veredito passa por `groupFindingsByImpact`,
     * que sempre reclassifica. As duas contagens divergiam na mesma tela: o
     * cartão NÃO EMITIR dizia "3 incongruências críticas" e a matriz mostrava 2.
     * Numa tela que decide emissão, dois números para a mesma pergunta é pior
     * que qualquer um dos dois estar errado.
     * `classifyFindingImpact` já respeita a faixa declarada; o que ele acrescenta
     * são as sobreposições determinísticas que precisam vencê-la.
     */
    impacto: classifyFindingImpact(finding),
    origem: finding.origem,
    confianca: finding.confianca,
    tier: classifyFindingTier(finding),
    assurance: getFindingAssurance(finding),
    disciplina: classifyFindingDiscipline(finding),
    tipoErro: classifyFindingErrorType(finding),
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

function downloadMarkdown(result: string, fileName = "nexodoc-auditoria.md") {
  const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function AuditResult({
  content,
  auditId,
  elapsedMs,
  report,
  pdfSources = [],
  resolvidos = new Set<string>(),
  onToggleResolvido,
  view: viewDeFora,
  onViewChange,
  achadoEmFoco,
}: AuditResultProps) {
  const [viewLocal, setViewLocal] = useState<AuditView>("summary");
  // Controlado por fora (barra de vistas do palco) ou dono da própria vista
  // (drawer do canvas, onde o controle segmentado continua desenhado).
  const controlado = viewDeFora !== undefined;
  const view = controlado ? viewDeFora : viewLocal;
  const setView = (v: AuditView) => (controlado ? onViewChange?.(v) : setViewLocal(v));
  /*
   * O ACHADO PEDIDO DE FORA vira vista, DURANTE O RENDER.
   *
   * É o ajuste de estado por mudança de prop que o React documenta — e não um
   * efeito: `setState` dentro de efeito para isto renderiza a vista errada por
   * um quadro (e o lint do React Compiler barra, com razão).
   *
   * `focoAnterior` é o que torna a mudança um EVENTO e não uma trava: sem ele o
   * parecer voltaria para Achados a cada render enquanto o foco existisse, e
   * quem clicasse em Resumo não conseguiria sair de lá.
   */
  /*
   * Nasce VAZIO, e não com o valor atual: o parecer do drawer é montado JÁ com
   * o achado pedido, então iniciá-lo com o próprio foco fazia a comparação
   * empatar no primeiro render — a vista continuava em Resumo e o cartão nunca
   * aparecia. O clique abria um drawer que parecia ignorar o clique.
   */
  const [focoAnterior, setFocoAnterior] = useState<string | undefined>(undefined);
  if (achadoEmFoco !== focoAnterior) {
    setFocoAnterior(achadoEmFoco);
    // Só o caso NÃO controlado: o foco vem do clique no canvas, e ali o parecer
    // mora no drawer, dono da própria vista.
    if (achadoEmFoco && !controlado) setViewLocal("findings");
  }

  // A rolagem é sincronizar com o DOM — aí sim, efeito. Roda depois de a lista
  // existir, senão não há elemento a alcançar.
  useEffect(() => {
    if (!achadoEmFoco || view !== "findings") return;
    const alvo = document.querySelector(`[data-achado="${CSS.escape(achadoEmFoco)}"]`);
    /*
     * `start`, não `center`: centralizar deixava o CABEÇALHO do cartão — o
     * título, as etiquetas e o anel de foco — acima da dobra, e quem clicou caía
     * no meio dos campos sem enxergar em qual achado tinha chegado.
     */
    alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [achadoEmFoco, view]);

  const [feedbackByFinding, setFeedbackByFinding] = useState<Record<string, FeedbackVerdict>>({});
  const [feedbackSavingKey, setFeedbackSavingKey] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [missingFindingNote, setMissingFindingNote] = useState("");
  const [activePdf, setActivePdf] = useState<ActivePdf | null>(null);
  /**
   * Quantas páginas tem o documento aberto. Zero enquanto o PDF carrega — e aí
   * a régua não existe, o que é o certo: sem o tamanho, "página 12" não diz se
   * é o meio ou o fim.
   */
  const [paginasDoAberto, setPaginasDoAberto] = useState(0);
  /*
   * O portal precisa do `document`, que não existe no servidor.
   *
   * Basta a checagem direta, sem marca de "já montei": o visor só existe depois
   * de alguém CLICAR, e no servidor `activePdf` é sempre nulo — os dois lados
   * renderizam a mesma coisa (nada), então não há divergência de hidratação a
   * temer. Um `useState` + `useEffect` aqui seria um render a mais em toda
   * montagem do parecer para responder a uma pergunta que o ambiente já responde.
   */
  const temDocument = typeof document !== "undefined";
  const [disciplineFilter, setDisciplineFilter] = useState<Set<FindingDiscipline>>(new Set());
  const [errorTypeFilter, setErrorTypeFilter] = useState<Set<FindingErrorType>>(new Set());
  const parsed = parseAuditResult(content);
  const status = getStatusVariant(report?.status_geral ?? parsed.status);
  const StatusIcon = status.icon;
  const elapsed = formatElapsedTime(elapsedMs);
  const runtime = report?.runtime;
  const dualReview = runtime?.motor_auditoria === "dual" && runtime.segunda_ia?.ativa;
  const findings = report
    ? report.incongruencias.map(reportFindingToStructured)
    : splitFindings(parsed.findings);
  const findingsWithPdf = findings.map((finding) => ({
    ...finding,
    pdfUrl: findPdfSource(finding, pdfSources)?.url,
  }));
  // Item 2/4 — duas camadas: sólidos (principal) e sugestões da IA (recolhível).
  const principalFindingsWithPdf = findingsWithPdf.filter((finding) => finding.tier !== "sugestao");
  const suggestionFindings = findingsWithPdf.filter((finding) => finding.tier === "sugestao");

  // Filtros por disciplina e tipo de erro (só mostra os que existem no resultado).
  const disciplineOrder: FindingDiscipline[] = [
    "geral", "arquitetura", "estrutural", "hidrossanitario", "eletrico",
    "ppci", "cabeamento", "terraplenagem", "paisagismo", "acessibilidade",
  ];
  const findingDiscipline = (finding: StructuredFinding): FindingDiscipline => finding.disciplina ?? "geral";
  const findingErrorType = (finding: StructuredFinding): FindingErrorType => finding.tipoErro ?? "tecnico";
  const presentDisciplines = disciplineOrder.filter((discipline) =>
    principalFindingsWithPdf.some((finding) => findingDiscipline(finding) === discipline),
  );
  const presentErrorTypes = ([
    "identidade", "escopo", "norma", "quantitativo", "especificacao", "editorial", "tecnico",
  ] as FindingErrorType[]).filter((type) =>
    principalFindingsWithPdf.some((finding) => findingErrorType(finding) === type),
  );
  const filteredPrincipal = principalFindingsWithPdf.filter(
    (finding) =>
      (disciplineFilter.size === 0 || disciplineFilter.has(findingDiscipline(finding))) &&
      (errorTypeFilter.size === 0 || errorTypeFilter.has(findingErrorType(finding))),
  );
  /*
   * Agrupamento primário: FAIXA DE IMPACTO, não disciplina.
   *
   * A matriz agrupava por disciplina, e a faixa aparecia só como etiqueta dentro
   * do cartão. Quem abria a tela via "Geral / Documental (8)" primeiro e tinha
   * de garimpar os bloqueadores espalhados por todos os grupos. A primeira
   * pergunta de quem vai emitir não é "de que disciplina é", é "o que me impede
   * de entregar isto hoje" — e a lista tem de responder isso na ordem.
   *
   * Disciplina e tipo continuam existindo: como filtro (acima) e como etiqueta
   * no cartão, que é o papel natural deles. Nada de informação se perdeu; mudou
   * o eixo de leitura.
   *
   * Dentro da faixa, a ordem secundária continua sendo a disciplina, para que
   * achados do mesmo capítulo fiquem vizinhos e o engenheiro corrija em lote.
   */
  const impactOrder = IMPACT_SECTIONS.map((section) => section.key);
  const groupedPrincipal = [...filteredPrincipal].sort((a, b) => {
    const porFaixa =
      impactOrder.indexOf(findingImpactBucket(a)) - impactOrder.indexOf(findingImpactBucket(b));

    if (porFaixa !== 0) {
      return porFaixa;
    }

    return disciplineOrder.indexOf(findingDiscipline(a)) - disciplineOrder.indexOf(findingDiscipline(b));
  });
  const impactCount = (impact: FindingImpact) =>
    filteredPrincipal.filter((finding) => findingImpactBucket(finding) === impact).length;
  // Continua alimentando os chips de filtro por disciplina.
  const disciplineCount = (discipline: FindingDiscipline) =>
    filteredPrincipal.filter((finding) => findingDiscipline(finding) === discipline).length;
  const toggleFrom = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  };
  // Item 12 — veredito de emissão só a partir dos achados sólidos.
  const verdict = report
    ? getEmissionVerdict(
        report.incongruencias.filter((finding) => classifyFindingTier(finding) === "principal"),
        report.runtime?.passadas_incompletas ?? [],
      )
    : null;
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
        { label: "Motor", value: dualReview ? "2 IAs em consenso" : "IA única" },
        { label: "Provider", value: report.runtime?.provedor_principal || "openai" },
        { label: "Regras locais", value: report.runtime?.regras_locais_ativas ? "ativas" : "desligadas" },
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

  function openInlinePdf(finding: StructuredFinding) {
    const source = findPdfSource(finding, pdfSources);

    if (!source) {
      return;
    }

    // Trocar de documento zera a régua: o número de páginas é do PDF, e o
    // próximo `onNumPages` é quem a reconstrói.
    setPaginasDoAberto((atual) => (source.url === activePdf?.url ? atual : 0));
    setActivePdf({
      url: source.url,
      page: getFirstPageNumber(finding.pagina) ?? 1,
      highlight: getHighlightNeedle(finding),
      label: finding.title,
      severity: finding.severity,
    });
  }

  /*
   * OS ACHADOS DO DOCUMENTO ABERTO, na ordem das páginas.
   *
   * Só os deste documento: um parecer cruza memorial, pranchas e LD, e pin de
   * achado alheio apontaria para uma página que não é a dele. Achado sem página
   * provável não entra — ele existe e está no parecer; a margem apenas não sabe
   * onde pô-lo, e inventar uma posição seria afirmar o que ninguém apurou.
   */
  const pinsDaMargem = pinsDoDocumento(
    findingsWithPdf.map((f, i) => ({
      chave: f.refId ?? `achado-${i}`,
      pagina: f.pagina,
      pdfUrl: f.pdfUrl,
      severity: f.severity,
      title: f.title,
    })),
    activePdf?.url ?? "",
    paginasDoAberto,
  );

  return (
    <article className="nexodoc-result-in w-full rounded-sm border bg-card p-5 sm:p-6">
      {/*
        O VISOR VAI PARA O `body`, por portal.
        `position: fixed` promete a JANELA como referência, e qualquer ancestral
        com transform, filtro ou containment quebra essa promessa em silêncio —
        foi o que aconteceu com a animação de entrada do parecer, e voltaria a
        acontecer na primeira transição de shell que o palco ganhasse. No body
        não há ancestral a quebrar nada.
      */}
      {activePdf && temDocument
        ? createPortal(
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l bg-card shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                PDF · página {activePdf.page}
              </p>
              {activePdf.label ? (
                <p className="truncate text-xs text-foreground">{activePdf.label}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setActivePdf(null)}
              className="rounded-sm border p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring"
              aria-label="Fechar visor de PDF"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            {/*
              A MARGEM DE ACHADOS.

              O visor abria a página de UM achado e calava sobre o resto: com
              onze achados no mesmo memorial, conferir era voltar ao parecer,
              clicar no próximo, ler, voltar. A régua diz de uma vez quantos
              problemas o documento tem e onde estão — é o padrão de revisão que
              todo mundo já conhece, e ele existe porque funciona.

              12px de largura: é margem, não coluna. Só aparece quando há pin.
            */}
            {pinsDaMargem.length > 0 && (
              <div
                className="relative w-3 shrink-0 border-r bg-[var(--nexodoc-recessed)]"
                role="list"
                aria-label={`${pinsDaMargem.length} achado(s) neste documento`}
              >
                {pinsDaMargem.map((pin) => {
                  const atual = pin.page === activePdf.page;
                  return (
                    <button
                      key={pin.chave}
                      type="button"
                      role="listitem"
                      title={`Página ${pin.page} · ${pin.title}`}
                      aria-label={`Ir para a página ${pin.page}: ${pin.title}`}
                      onClick={() =>
                        setActivePdf((a) => (a ? { ...a, page: pin.page, severity: pin.severity } : a))
                      }
                      style={{ top: `${pin.top * 100}%` }}
                      className={cn(
                        "absolute left-0 h-[3px] w-full -translate-y-1/2 outline-none transition-all",
                        // O pin da página aberta cresce em vez de mudar de cor:
                        // a cor já está dizendo a gravidade, e dois significados
                        // na mesma cor é como um sinal deixa de significar.
                        atual && "h-[5px]",
                        "focus-visible:ring-1 focus-visible:ring-ring",
                      )}
                    >
                      <span
                        aria-hidden
                        className="block size-full"
                        style={{ background: COR_DO_PIN[pin.severity] }}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className={cn(
                "min-w-0 flex-1 overflow-auto bg-[var(--nexodoc-recessed)] p-3",
                MARCACAO_POR_GRAVIDADE[activePdf.severity ?? "warning"],
              )}
            >
              <AuditPdfViewer
                url={activePdf.url}
                page={activePdf.page}
                highlight={activePdf.highlight}
                onNumPages={setPaginasDoAberto}
              />
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
      {verdict ? (
        <div
          data-tour="veredito-parecer"
          className={cn(
            // Borda 1px completa + tint de fundo (sem side-stripe, sem emoji),
            // usando os tokens de status reais do sistema. A tradução do
            // veredito mora em lib/audit-status.ts — o canvas lê a mesma.
            "mb-5 flex flex-col gap-1 rounded-sm border px-4 py-3",
            MOLDURA_DE_SINAL[statusDoVeredito(verdict)],
          )}
        >
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                PONTO_DE_SINAL[statusDoVeredito(verdict)],
              )}
            />
            {verdict.label}
          </p>
          <p className="text-sm text-muted-foreground">
            {(report?.obra && report.obra !== "não identificada" ? `${report.obra} · ` : "") + verdict.detail}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          {/*
            O TÍTULO E AS ABAS SÓ EXISTEM SEM A BARRA DE VISTAS.
            Com ela na tela, "Resultado da auditoria" repetia o chip logo acima e
            o controle segmentado era um segundo seletor de vista a 12px, do lado
            de um de 14 — dois níveis para a mesma decisão, e o de baixo lido
            como filtro. A contagem continua aqui: ela informa, não navega.
          */}
          {!controlado && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Resultado da auditoria
            </p>
          )}
          <span className="mt-1 block font-mono text-xs text-muted-foreground">
            {findings.length} achado{findings.length !== 1 ? "s" : ""} em {uniqueDocumentCount || pdfSources.length || "?"} arquivo{pdfSources.length !== 1 ? "s" : ""}
            {elapsed ? ` · ${elapsed}` : ""}
          </span>

          {!controlado && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-sm bg-[var(--nexodoc-recessed)] p-0.5">
                {([
                  { value: "summary" as const, label: "Resumo" },
                  { value: "findings" as const, label: "Achados" },
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
          )}
        </div>

        <div className="flex flex-wrap items-start gap-2 sm:justify-end">
          <Dropdown
            align="end"
            trigger={({ open, toggle }) => (
              <Button type="button" variant="outline" size="sm" onClick={toggle} aria-expanded={open}>
                <Download />
                Exportar
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            )}
          >
            {({ close }) => (
              <>
                <DropdownItem
                  onClick={() => {
                    void navigator.clipboard.writeText(content);
                    close();
                  }}
                >
                  <Copy className="size-4" />
                  Copiar resposta
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    void navigator.clipboard.writeText(findingsText);
                    close();
                  }}
                >
                  <Copy className="size-4" />
                  Copiar achados
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    void navigator.clipboard.writeText(actionsText);
                    close();
                  }}
                >
                  <Copy className="size-4" />
                  Copiar ações
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    downloadMarkdown(content);
                    close();
                  }}
                >
                  <Download className="size-4" />
                  Baixar .md
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {dualReview ? (
        <section className="mt-4 rounded-sm border border-primary/30 bg-primary/8 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--nexodoc-accent)]">
                Consenso de duas IAs
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground">
                O modelo principal encontrou candidatos e a segunda IA revisou a lista final antes da emissão do relatório.
              </p>
            </div>
            <div className="grid gap-2 text-xs sm:min-w-[260px]">
              <div className="flex items-center justify-between gap-3 rounded-sm border bg-card px-3 py-2">
                <span className="text-muted-foreground">Principal</span>
                <span className="font-mono text-foreground">{runtime?.modelo_principal || "não informado"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-sm border bg-card px-3 py-2">
                <span className="text-muted-foreground">Segunda IA</span>
                <span className="font-mono text-foreground">{runtime?.segunda_ia?.modelo || runtime?.modelo_validacao || "não informado"}</span>
              </div>
            </div>
          </div>
          {runtime?.segunda_ia?.observacao ? (
            <p className="mt-3 border-t pt-3 text-xs leading-5 text-muted-foreground">
              {runtime.segunda_ia.observacao}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-5 grid gap-5">
        {view === "summary" ? (
          <>
            {/*
              Os cartões de métrica são CONTAGEM, não status: "7 achados" não é
              bom nem ruim, e a severidade já está dita no badge do cabeçalho e
              nas abas. Coloridos, eles competiam com o que realmente carrega
              status na tela e gastavam o vocabulário de alarme numa soma.
            */}
            <div className="grid divide-y rounded-sm border bg-[var(--nexodoc-recessed)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <p className="font-mono text-[11px] text-muted-foreground">Inconsistências críticas</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{criticalCount}</p>
              </div>
              <div className="px-4 py-3">
                <p className="font-mono text-[11px] text-muted-foreground">Pontos de revisão</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{warningCount}</p>
              </div>
            </div>

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

                {presentDisciplines.length > 1 || presentErrorTypes.length > 1 ? (
                  <div className="space-y-2 rounded-md border bg-[var(--nexodoc-recessed)] p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Disciplina</span>
                      {presentDisciplines.map((discipline) => (
                        <button
                          key={discipline}
                          type="button"
                          onClick={() => setDisciplineFilter((current) => toggleFrom(current, discipline))}
                          className={cn(
                            "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                            disciplineFilter.has(discipline)
                              ? "border-ring bg-card text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {getDisciplineLabel(discipline)} ({disciplineCount(discipline)})
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</span>
                      {presentErrorTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setErrorTypeFilter((current) => toggleFrom(current, type))}
                          className={cn(
                            "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                            errorTypeFilter.has(type)
                              ? "border-ring bg-card text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {getErrorTypeLabel(type)}
                        </button>
                      ))}
                      {disciplineFilter.size > 0 || errorTypeFilter.size > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDisciplineFilter(new Set());
                            setErrorTypeFilter(new Set());
                          }}
                          className="ml-1 rounded-full px-2 py-1 font-mono text-[11px] text-primary outline-none hover:underline focus-visible:underline"
                        >
                          limpar filtros
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4">
                  {groupedPrincipal.length === 0 ? (
                    <EmptyState
                      description="Nenhum achado com os filtros selecionados."
                      className="py-8"
                    />
                  ) : null}
                  {groupedPrincipal.map((finding, index) => {
                    const disciplina = findingDiscipline(finding);
                    const faixa = findingImpactBucket(finding);
                    const secao = IMPACT_SECTIONS.find((item) => item.key === faixa);
                    const showImpactHeader =
                      index === 0 || findingImpactBucket(groupedPrincipal[index - 1]) !== faixa;
                    return (
                    <Fragment key={`${finding.raw}-matrix-${index}`}>
                      {showImpactHeader && secao ? (
                        /*
                         * O cabeçalho da faixa é o marcador de leitura da tela.
                         * O bloqueador ganha o tom destrutivo porque é o único
                         * que interrompe a entrega; os outros dois ficam
                         * discretos de propósito, para não competirem com ele.
                         */
                        <div
                          data-faixa={faixa}
                          className="mt-4 first:mt-0 flex flex-col gap-1 border-l-2 pl-3"
                          style={{
                            borderColor:
                              faixa === "critico_documental"
                                ? "var(--destructive)"
                                : "var(--border)",
                          }}
                        >
                          <h5
                            className={cn(
                              "font-mono text-[11px] font-semibold uppercase tracking-wider",
                              faixa === "critico_documental"
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            {secao.title} ({impactCount(faixa)})
                          </h5>
                          <p className="text-xs text-muted-foreground">{secao.hint}</p>
                        </div>
                      ) : null}
                    {/*
                      ACHADO RESOLVIDO = tarefa riscada da lista.
                      O engenheiro trabalha com o software numa tela e o
                      memorial na outra, corrigindo um a um. Sem marcar o que já
                      foi, ele perde o lugar a cada rolagem — e relê achado que
                      já resolveu, que é o desperdício mais banal desta tela.
                      Verde + risco no título: some da leitura sem sumir da tela,
                      porque desfazer tem que continuar possível.
                    */}
                    <article
                      // Faixa no DOM: é o que permite provar a ORDEM da lista no
                      // navegador sem depender do texto do cabeçalho.
                      data-impacto={faixa}
                      // A âncora do achado: é por ela que o clique no canvas
                      // encontra este cartão para rolar até ele.
                      data-achado={finding.refId || undefined}
                      data-em-foco={finding.refId && finding.refId === achadoEmFoco ? "" : undefined}
                      data-resolvido={resolvidos.has(finding.refId ?? "") || undefined}
                      className={cn(
                        /*
                         * SEM `overflow-hidden`: o menu de ações deste achado é
                         * filho daqui, e o recorte o cortava INDEPENDENTEMENTE
                         * da posição na janela — o cartão é mais curto que o
                         * menu. O arredondamento que o `overflow` garantia
                         * agora é do cabeçalho, que é o único filho com fundo
                         * próprio encostando na borda.
                         */
                        /*
                         * `@container`: as duas grades internas decidiam o
                         * número de colunas por `xl:`, que mede a JANELA. Dentro
                         * do Nexo o parecer divide a tela com a conversa e fica
                         * com ~528px — mas a janela de 1440px acionava o `xl:`
                         * assim mesmo, e uma grade de 2 colunas com mínimo de
                         * 16rem forçava 922px de conteúdo numa caixa de 544px.
                         * O texto era cortado na borda direita.
                         *
                         * Medido antes: clientWidth 544 × scrollWidth 922.
                         * Breakpoint de container mede a caixa, que é o que
                         * manda aqui.
                         */
                        "@container rounded-md border bg-card transition-colors",
                        resolvidos.has(finding.refId ?? "")
                          ? "border-[var(--status-ok)]/40 bg-[var(--status-ok-bg)]/40"
                          : "",
                        /*
                         * VINDO DO CANVAS, o cartão precisa se identificar: a
                         * lista rola até aqui, e sem uma marca a pessoa cai no
                         * meio de 45 cartões iguais sem saber qual é o dela. O
                         * anel fica enquanto o foco durar, e sai no próximo
                         * clique — não é estado permanente.
                         */
                        "data-[em-foco]:ring-2 data-[em-foco]:ring-[var(--ring)] data-[em-foco]:ring-offset-2 data-[em-foco]:ring-offset-[var(--background)]",
                      )}
                    >
                      <div className="grid gap-4 rounded-t-md border-b bg-[var(--nexodoc-recessed)]/70 p-4 @min-[40rem]:grid-cols-[minmax(18rem,1fr)_auto] @min-[40rem]:items-start">
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
                            <span
                              title={finding.assurance}
                              className={cn(
                                "rounded-md border px-2 py-1 font-mono text-xs",
                                finding.origem === "regra"
                                  ? "border-[var(--status-ok)]/30 text-[var(--status-ok)]"
                                  : "text-muted-foreground",
                              )}
                            >
                              {finding.origem === "regra" ? "✔ Verificado" : "◻ Sugerido"}
                            </span>
                            <span className="rounded-md border border-primary/25 bg-primary/5 px-2 py-1 font-mono text-xs text-[var(--nexodoc-accent)]">
                              {getDisciplineLabel(disciplina)}
                            </span>
                            <span className="rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground">
                              {getErrorTypeLabel(findingErrorType(finding))}
                            </span>
                            {finding.refId ? (
                              <span className="rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground">
                                Ref. {finding.refId}
                              </span>
                            ) : null}
                          </div>
                          <h4
                            className={cn(
                              "text-base font-semibold leading-6 transition-colors",
                              resolvidos.has(finding.refId ?? "")
                                ? "text-muted-foreground line-through decoration-[var(--status-ok)]/60"
                                : "text-foreground",
                            )}
                          >
                            {finding.title}
                          </h4>
                        </div>

                        <div className="flex items-start gap-2 @min-[40rem]:justify-end">
                          {/*
                            O botão fica no CABEÇALHO do achado, ao lado do menu:
                            é a ação que se repete 22 vezes numa revisão, e ela
                            tem que estar sempre no mesmo lugar, sem rolar.
                          */}
                          {onToggleResolvido && finding.refId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={resolvidos.has(finding.refId) ? "secondary" : "outline"}
                              onClick={() =>
                                onToggleResolvido(
                                  finding.refId!,
                                  !resolvidos.has(finding.refId!),
                                )
                              }
                              className={
                                resolvidos.has(finding.refId)
                                  ? "border-[var(--status-ok)]/40 text-[var(--status-ok)]"
                                  : undefined
                              }
                            >
                              <Check />
                              {resolvidos.has(finding.refId) ? "Corrigido" : "Marcar corrigido"}
                            </Button>
                          ) : null}
                          <Dropdown
                            align="end"
                            trigger={({ open, toggle }) => (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                onClick={toggle}
                                aria-expanded={open}
                                aria-label="Ações do achado"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {finding.pdfUrl ? (
                                  <DropdownItem
                                    onClick={() => {
                                      openInlinePdf(finding);
                                      close();
                                    }}
                                  >
                                    <ExternalLink className="size-4" />
                                    Abrir PDF
                                  </DropdownItem>
                                ) : null}
                                {finding.termoBusca ? (
                                  <DropdownItem
                                    onClick={() => {
                                      void navigator.clipboard.writeText(finding.termoBusca ?? "");
                                      close();
                                    }}
                                  >
                                    <Copy className="size-4" />
                                    Copiar termo
                                  </DropdownItem>
                                ) : null}
                                <DropdownItem
                                  onClick={() => {
                                    void createFindingSnapshot(finding, index);
                                    close();
                                  }}
                                >
                                  <Eye className="size-4" />
                                  Print do achado
                                </DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        </div>
                      </div>

                      <div className="grid gap-4 p-4 @min-[40rem]:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)]">
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
                              {/*
                                VER NO DOCUMENTO fica AQUI, colado à evidência —
                                não escondido no menu "⋯". É a ação que fecha o
                                ciclo da auditoria: o achado deixa de ser uma
                                afirmação e vira algo que se confere na página.
                                Enterrada num kebab, ela simplesmente não existia
                                para quem usa.
                              */}
                              {finding.pdfUrl ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="ml-auto h-7"
                                  onClick={() => openInlinePdf(finding)}
                                >
                                  <ExternalLink className="size-3.5" />
                                  Ver no documento
                                </Button>
                              ) : null}
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
                    </Fragment>
                    );
                  })}
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
                        placeholder="Descreva o erro não identificado pelo Nexo."
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

                {suggestionFindings.length > 0 ? (
                  <details className="rounded-md border bg-[var(--nexodoc-recessed)]/40">
                    <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Sugestões da IA — confira ({suggestionFindings.length}) · menor confiança, não contam para o veredito
                    </summary>
                    <div className="grid gap-2 px-4 pb-4">
                      {suggestionFindings.map((finding, index) => (
                        <div key={`${finding.raw}-suggestion-${index}`} className="rounded-md border bg-card p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                              ◻ Sugerido
                            </span>
                            {finding.pagina ? (
                              <span className="font-mono text-[11px] text-muted-foreground">p.{finding.pagina}</span>
                            ) : null}
                            <span className="text-sm font-medium text-foreground">{finding.title}</span>
                            {finding.pdfUrl ? (
                              <button
                                type="button"
                                onClick={() => openInlinePdf(finding)}
                                className="ml-auto text-xs text-primary outline-none hover:underline focus-visible:underline"
                              >
                                Abrir PDF
                              </button>
                            ) : null}
                          </div>
                          {finding.conflito || finding.referencia ? (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {finding.conflito || finding.referencia}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <EmptyState description="Nenhum achado encontrado." className="py-8" />
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
