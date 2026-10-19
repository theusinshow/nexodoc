"use client";

import { rotuloDoAchado, textoComRotulos } from "@/lib/rotulo-do-achado";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  LayoutList,
  Mail,
  MapPin,
  Minus,
  MoreHorizontal,
  Plus,
  Info,
  Search,
  Send,
  SlidersHorizontal,
  ListChecks,
  MessageSquare,
  Wrench,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { CartaoDoMotor } from "@/components/achado/cartao-do-motor";
import { OQueFazer, type CorretorDoAchado } from "@/components/achado/o-que-fazer";
import { ConversaDoAchado } from "@/components/achado/conversa-do-achado";
import { findingCard } from "@/lib/audit-engine/finding-card";
import { parseEngineFinding } from "@/lib/audit-engine/report-contract";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { pinsDoDocumento } from "@/lib/pins-do-parecer";
import { resolverFonte, type FonteDoCatalogo } from "@/lib/fonte-da-evidencia";
import { linkDoAchado } from "@/lib/link-do-achado";
import { formatarEmBrasilia } from "@/lib/fuso-de-brasilia";
import { palavra, plural } from "@/lib/plural";
import { EmptyState } from "@/components/ui/empty-state";
import { Pop } from "@/components/ui/pop";
import { getAnalysisLevelLabel } from "@/lib/analysis-level";
import {
  MOLDURA_DE_SINAL,
  PONTO_DE_SINAL,
  statusDoVeredito,
} from "@/lib/audit-status";
import {
  classifyFindingDiscipline,
  classifyFindingErrorType,
  classifyFindingImpact,
  achadosConfirmados,
  classifyFindingTier,
  getDisciplineLabel,
  avaliarEmissao,
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
import {
  ehMultiPagina,
  paginasDoAchado,
  rotuloDePaginas,
} from "@/lib/paginas-do-achado";
import {
  GRUPOS_TECNICOS,
  grupoDaDisciplinaDoAchado,
} from "@/server/nexo/disciplinas";
/*
 * A MESMA função que pinta as folhas no canvas. Importada, e não reescrita: a
 * disciplina tem UMA cor no produto, e duas tabelas discordariam no primeiro
 * tom que alguém ajustasse.
 */
import { corDaDisciplina } from "@/modules/nexo/lib/disciplina-cor";
import { AvisoDeAuditoriaIncompleta } from "@/components/aviso-de-auditoria-incompleta";
import { incompletudeDoParecer } from "@/lib/auditoria-incompleta";
import { cn } from "@/lib/utils";
import { useSpotlight } from "@/lib/use-spotlight";
import { AVISO_DE_RESPONSABILIDADE } from "@/lib/aviso-de-responsabilidade";

// Visor de PDF só no cliente (react-pdf não faz SSR).
const AuditPdfViewer = dynamic(
  () => import("@/components/audit-pdf-viewer-internal"),
  {
    ssr: false,
    loading: () => (
      <div className="p-3">
        <Skeleton className="h-[70vh] w-full" />
      </div>
    ),
  },
);

type ActivePdf = {
  url: string;
  page: number;
  highlight?: string;
  label?: string;
  /** O arquivo aberto e como ele foi identificado (A03/A10). */
  arquivo?: string;
  criterio?: "revisao" | "nome" | "unico";
  /** Gravidade do achado — pinta a marcação no documento. */
  severity?: StructuredFinding["severity"];
  /** De qual achado da fila o visor está mostrando a evidência (A10). */
  achado?: string;
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

/*
 * O CHIP DE FILTRO da fila de achados — um desenho só para situação,
 * gravidade, disciplina e tipo. É a camada `.nx-edge-6` do sistema (§7): em
 * repouso a moldura é transparente e o miolo é o do cartão, OPACO, para que o
 * anel de foco vire anel e não um bloco teal; ligado, "selecionado/atual" da
 * matriz de estados — moldura teal e miolo elevado. `recuado` é para o chip que
 * mora no painel recuado (disciplina e tipo), onde o miolo de repouso é o dele.
 */
function classeDoFiltro(ativo: boolean, recuado = false) {
  return cn(
    "nx-edge-6 inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 font-mono text-xs outline-none transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] active:translate-y-px",
    ativo
      ? "text-foreground [--nx-edge:var(--ring)] [--nx-fill:var(--nexodoc-raised)]"
      : cn(
          "text-muted-foreground [--nx-edge:transparent] hover:text-foreground hover:[--nx-edge:var(--border)] hover:[--nx-fill:var(--nexodoc-raised)]",
          recuado ? "[--nx-fill:var(--nexodoc-recessed)]" : "[--nx-fill:var(--card)]",
        ),
  );
}

const ROTULO_DA_LINHA_DE_FILTRO =
  "mr-1 w-[5.5rem] shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

const MARCACAO_POR_GRAVIDADE: Record<StructuredFinding["severity"], string> = {
  critical: "[&_mark]:bg-[var(--status-critical)] [&_mark]:text-[var(--destructive-foreground)]",
  warning: "[&_mark]:bg-[var(--status-warning)] [&_mark]:text-[#2b1d05]",
  ok: "[&_mark]:bg-[var(--status-ok)] [&_mark]:text-[#052b16]",
};

type AuditResultProps = {
  content: string;
  /**
   * Fontes do MOTOR NOVO: quais revisões têm arquivo que se abre e como abrir a
   * página citada. Ausente = fontes mostradas como indisponíveis (nunca um link falso).
   */
  motorFonte?: {
    hasRevision: (revisionId: string, fileName?: string) => boolean;
    aoAbrir: (nav: { revisionId: string; fileName: string; page: number; highlight: string | null }) => void;
  };
  auditId?: string;
  elapsedMs?: number;
  report?: AuditReport;
  pdfSources?: AuditPdfSource[];
  /**
   * O CATÁLOGO DAS FONTES, com a identidade de cada revisão (A02/A03). Quando
   * vem, manda: achado legado e referência do motor resolvem por ele
   * (`lib/fonte-da-evidencia.ts`). Ausente, `pdfSources` vira catálogo sem hash.
   */
  fontes?: FonteDoCatalogo[];
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
  /**
   * O texto corrigido que acabou de ser gerado para um achado. O servidor já o
   * gravou no parecer; quem é dono do parecer na tela funde a cópia do
   * IndexedDB, para ele sobreviver ao F5 sem nova chamada.
   */
  onTextoCorrigido?: CorretorDoAchado["aoGerar"];
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

export type StructuredFinding = {
  title: string;
  refId?: string;
  /** `AuditFinding.motor`, quando o achado veio do motor novo. */
  motor?: AuditFinding["motor"];
  severity: "critical" | "warning" | "ok";
  documento?: string;
  pagina?: string;
  local?: string;
  evidencia?: string;
  termoBusca?: string;
  conflito?: string;
  acao?: string;
  categoria?: string;
  /**
   * O FATO OBSERVÁVEL. Existia no parecer (`descricao`) e a tela nunca o
   * mostrava: ele entrava só como reserva de `referencia`, e como
   * `referencia_comparada` quase sempre vem preenchida, a descrição não
   * aparecia em lugar nenhum. Agora é "O que está errado".
   */
  descricao?: string;
  referencia?: string;
  impacto?: FindingImpact;
  /**
   * Espelha `AuditFinding["origem"]`, e por isso inclui `"chat"`: o achado
   * nascido na conversa pós-parecer entra na MESMA lista, e o cartão precisa
   * saber distingui-lo — veio de uma pergunta, não da varredura.
   */
  origem?: AuditFinding["origem"];
  /** Veio do parecer anterior, de um capítulo idêntico. Ver `AuditFinding`. */
  herdado_de?: { auditId: string; quando: string };
  /** O texto corrigido já gravado no achado. Ver `lib/texto-corrigido.ts`. */
  textoCorrigido?: AuditFinding["texto_corrigido"];
  confianca?: "alta" | "media" | "baixa";
  tier?: FindingTier;
  assurance?: string;
  disciplina?: FindingDiscipline;
  tipoErro?: FindingErrorType;
  /** Por que esta faixa — ver `lib/severidade.ts`. */
  severityReason?: string;
  pdfUrl?: string;
  /** Por que não há fonte para abrir, quando há catálogo e ela não resolve. */
  semFonte?: string;
  raw: string;
};

type ProjectField = {
  label: string;
  value: string;
};

export type FeedbackVerdict =
  "CONFIRMED" | "FALSE_POSITIVE" | "WRONG_SEVERITY" | "MISSING_FINDING";

export type SavedFeedback = {
  id: string;
  findingId: string | null;
  /** Nulo quando a linha só registra "corrigido", sem julgar o achado. */
  verdict: FeedbackVerdict | null;
  /** Instante da correção; nulo = não corrigido. */
  resolvedAt: string | null;
  note: string;
  /** Com quem o achado está. Nulo = não foi enviado a ninguém. */
  assigneeEmail: string | null;
  /** O nome dessa pessoa, quando o escritório o conhece; senão, o e-mail. */
  assigneeName: string | null;
  /** COMO foi encerrado — ver [[lib/desfecho-do-achado.ts]]. */
  resolutionKind: DesfechoDoAchado | null;
  /** Quem encerrou, já resolvido em nome pela rota. */
  resolvedByName: string | null;
  /** E o e-mail dessa pessoa, em minúsculas — "fui eu que corrigi". */
  resolvedByEmail?: string | null;
  /** Com "gravidade errada": para onde quem revisou acha que devia ir. */
  severidadeSugerida?: "MAIS_GRAVE" | "MENOS_GRAVE" | null;
  /** Quantos comentários a conversa do achado tem (A08: a fila mostra sem abrir). */
  comentarios?: number;
  assignedAt?: string | null;
  notifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/** Como a fila de achados é ordenada (A04). */
type OrdemDaFila = "impacto" | "pagina" | "documento" | "referencia";
/** A situação operacional de um achado na fila (A04). */
type SituacaoDaFila = "todos" | "meus" | "sem-responsavel" | "pendentes" | "encerrados";
const SITUACOES_DA_FILA: { valor: SituacaoDaFila; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "meus", rotulo: "Meus pendentes" },
  { valor: "sem-responsavel", rotulo: "Sem responsável" },
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "encerrados", rotulo: "Encerrados" },
];
type AbaDoDetalhe = "evidencia" | "conversa" | "historico";

/** Texto comparável: sem acento, minúsculo — a busca da fila não exige grafia exata. */
function paraBusca(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type DesfechoDoAchado = "FIXED_IN_DOC" | "FALSE_POSITIVE" | "ACCEPTED_RISK";

/**
 * Alguém que recebeu achado nesta auditoria e ainda não foi avisado por e-mail.
 * Vem inteiro do servidor (`GET /api/audits/[id]/avisar`) — a tela não deduz
 * quem falta a partir das linhas de feedback, porque `convidado` depende do
 * status do membro no escritório, que a rota de feedback não devolve.
 */
type PessoaAAvisar = {
  email: string;
  nome: string;
  quantidade: number;
  convidado: boolean;
};

/**
 * O nome curto de cada veredito na etiqueta do cartão. Curto de propósito: ela
 * divide a linha com disciplina, tipo de erro e referência, e "Falso positivo
 * segundo o engenheiro" empurraria as outras para uma segunda linha.
 *
 * `MISSING_FINDING` não aparece: ele não avalia um achado da lista, avalia o
 * que a lista não tem — e por isso não pertence a cartão nenhum.
 */
const VEREDITO_LABEL: Record<FeedbackVerdict, string> = {
  CONFIRMED: "Procedente",
  FALSE_POSITIVE: "Falso positivo",
  WRONG_SEVERITY: "Severidade errada",
  MISSING_FINDING: "",
};

/**
 * O nome curto de cada desfecho. Curto pelo mesmo motivo do veredito: divide a
 * linha do cabeçalho com disciplina e tipo de erro.
 *
 * "Falso positivo" aparece nos DOIS mapas de propósito — como veredito, ele
 * julga a IA; como desfecho, ele encerra o trabalho. É a mesma palavra dita de
 * dois lugares diferentes, e o cartão nunca mostra as duas ao mesmo tempo
 * porque o desfecho já grava o veredito.
 */
const DESFECHO_LABEL: Record<DesfechoDoAchado, string> = {
  FIXED_IN_DOC: "Corrigido",
  FALSE_POSITIVE: "Falso positivo",
  ACCEPTED_RISK: "Decisão técnica",
};

/**
 * Os degraus de zoom da gaveta. Lista fixa em vez de um passo contínuo: são os
 * valores em que a página cai bem na largura de 560px, e um `+` que muda de
 * 100% para 103% é um controle que parece quebrado.
 *
 * O teto de 3× não é enfeite: a página é rasterizada na largura pedida, e um
 * memorial de 80 folhas com o canvas em 1560px de largura pesa na memória de
 * quem só queria ler uma linha.
 */
const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 3];

const zoomSeguinte = (atual: number) =>
  ZOOMS.find((z) => z > atual) ?? ZOOMS[ZOOMS.length - 1];
const zoomAnterior = (atual: number) =>
  [...ZOOMS].reverse().find((z) => z < atual) ?? ZOOMS[0];

export function getFeedbackEndpoint(auditId: string) {
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

/**
 * O RÓTULO do veredito geral, em português de gente.
 *
 * Devolvia também `className` (as três variantes do Badge, transcritas à mão) e
 * `icon`. Os dois estavam MORTOS: `className` ia para um campo `tone` de
 * `confidenceItems`, que ninguém renderizava, e `icon` para um `StatusIcon` que
 * ninguém usava. Quatro cópias das classes de status mantidas vivas por código
 * que não desenha nada — e que apareceriam numa busca por "quem usa âmbar" como
 * se fossem tela.
 */
function rotuloDoStatus(status: string) {
  const normalized = normalizeText(status);

  // Antes de tudo: sem este ramo, "auditoria incompleta" caía no fim e virava
  // "sem achados críticos" — a frase exatamente oposta.
  if (normalized.includes("incompleta")) {
    return "auditoria incompleta — não use para emitir";
  }

  if (
    normalized.includes("revisao obrigatoria") ||
    normalized.includes("inconsistencias criticas") ||
    normalized.includes("incongruencia relevante")
  ) {
    return "com inconsistências críticas";
  }

  if (
    normalized.includes("pontos de revisao") ||
    normalized.includes("ponto de atencao")
  ) {
    return "com pontos de revisão";
  }

  return "sem achados críticos";
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

/**
 * A faixa de severidade, no vocabulário de status do sistema.
 *
 * Devolvia as CLASSES à mão — `border-.../35 bg-...-bg text-...` — que são
 * exatamente as três variantes de `<Badge>`, copiadas. A DESIGN.md é explícita:
 * "o padrão canônico é `<Badge variant="ok|warning|critical">`. Use o
 * componente; não escreva as classes à mão." Com a cópia, ajustar o âmbar do
 * sistema deixaria esta tela para trás sem ninguém notar.
 */
function getSeverityVariant(
  severity: StructuredFinding["severity"],
): "critical" | "warning" | "ok" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "ok";
}

/**
 * A COR DA PÍLULA SEGUE O QUE ELA DIZ (teste real de 02/10/2026). A pílula
 * mostra a faixa de impacto, mas a cor vinha da severidade do modelo: um
 * "Técnico/contratual" de severidade alta saía no vermelho do bloqueio, ao lado
 * do trilho dizendo "exige decisão" em âmbar. Com faixa, a cor é da faixa.
 */
function getImpactVariant(impact: FindingImpact): "critical" | "warning" | "ok" {
  if (impact === "critico_documental") return "critical";
  if (impact === "risco_de_execucao" || impact === "tecnico_contratual") return "warning";
  return "ok";
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
    .filter((block) =>
      /Documento\s*:|Página provável\s*:|Pagina provavel\s*:/i.test(block),
    );

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
    key: "risco_de_execucao" as const,
    title: "RISCO NA EXECUÇÃO",
    hint: "Executado como está escrito, sai errado, inseguro ou mais caro.",
  },
  {
    key: "tecnico_contratual" as const,
    title: "EXIGE DECISÃO TÉCNICA",
    hint: "Premissa, norma ou dado que o responsável precisa demonstrar ou confirmar antes de executar.",
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
  return finding.severity === "critical"
    ? "critico_documental"
    : "revisao_editorial";
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
    const bucket = findings.filter(
      (finding) => findingImpactBucket(finding) === section.key,
    );

    if (bucket.length === 0) {
      return null;
    }

    const blocks = bucket.map((finding) =>
      formatFindingBlock(finding, (position += 1)),
    );

    return [
      `## ${section.title} (${bucket.length})`,
      section.hint,
      "",
      blocks.join("\n\n"),
    ].join("\n");
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

export function getFirstPageNumber(value?: string) {
  const match = value?.match(/\d+/);

  if (!match) {
    return null;
  }

  const page = Number(match[0]);

  return Number.isFinite(page) && page > 0 ? page : null;
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

export function getHighlightNeedle(finding: StructuredFinding) {
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
    ) ??
    candidates[0] ??
    ""
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
            /* Realce inline: forma só, corte 4. `rounded-sm` neste projeto
               resolve para 8px (`--radius-sm: var(--radius)`), o dobro do que
               o §5 tolera — ver o comentário da escala em `globals.css`. */
            className="nx-cut-4 border border-primary/30 bg-primary/20 px-1 py-0.5 font-medium text-foreground"
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

async function createFindingSnapshot(
  finding: StructuredFinding,
  index: number,
) {
  const rows = [
    `Achado ${index + 1}${finding.refId ? ` | ${rotuloDoAchado(finding.refId)}` : ""}`,
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
  /* cor-crua-ok: este SVG é uma IMAGEM que o parecer exporta, não uma tela.
     Ele sai do produto como arquivo e é aberto fora dele — `var()` não resolve
     num SVG solto, e um token que chegasse cru pintaria retângulo transparente.
     Mesma razão da paleta do e-mail em `lib/aviso-de-achados.ts`. */
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0B0D0E"/>
  <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="10" fill="#171B1D" stroke="rgba(230,235,233,0.14)"/>
  <text x="76" y="88" fill="#8A9490" font-family="'IBM Plex Mono', ui-monospace, monospace" font-size="18">Nexo | cartão do achado — texto do parecer, não captura do documento</text>
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
    image.onerror = () =>
      reject(new Error("Não foi possível gerar o print do achado."));
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
  link.download = `nexodoc-achado-${rotuloDoAchado(finding.refId) ?? index + 1}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export function reportFindingToStructured(finding: AuditFinding): StructuredFinding {
  const severity =
    finding.prioridade === "Alta" || finding.prioridade === "Media/Alta"
      ? "critical"
      : finding.prioridade === "Baixa"
        ? "ok"
        : "warning";

  /*
   * A SIGLA QUE SE LÊ É ACH, não INC — ver [[lib/rotulo-do-achado.ts]]. O
   * `refId` segue sendo o id GRAVADO (é chave de feedback, fila e filtros);
   * trocam os textos que o Nexo escreveu, onde a nota de consolidação cita
   * outro achado ("consolidada no INC-019"). A evidência e o termo de busca
   * NÃO: são citação do memorial, e lá "INC" pode ser a prancha de incêndio.
   */
  return {
    title: textoComRotulos(finding.tipo),
    refId: finding.id,
    severity,
    documento: finding.arquivo,
    pagina: finding.pagina,
    local: finding.local,
    evidencia: finding.evidencia,
    termoBusca: finding.termo_busca ?? finding.evidencia,
    conflito: textoComRotulos(finding.conflito),
    acao: textoComRotulos(finding.sugestao_correcao),
    categoria: finding.categoria ?? finding.capitulo,
    /*
     * OS DOIS CAMPOS SEPARADOS, e não um caindo no outro.
     *
     * Era `referencia_comparada ?? descricao`, e o `??` escondia a descrição
     * sempre que houvesse referência — que é quase sempre, porque as regras a
     * preenchem. A tela mostrava um só texto onde o parecer traz dois, e o fato
     * observável não aparecia em canto nenhum.
     */
    descricao: textoComRotulos(finding.descricao),
    referencia: finding.referencia_comparada,
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
    // A frase que explica a faixa. Vazia em parecer gravado antes da matriz —
    // a etiqueta simplesmente não ganha explicação, em vez de inventar uma.
    severityReason: finding.severity_reason,
    origem: finding.origem,
    /*
     * Herdado da auditoria anterior, de um capítulo que não mudou. Atravessa a
     * conversão porque é do MESMO tipo de informação que `origem`: diz de onde
     * o achado veio, e é isso que permite conferir um parecer em vez de
     * acreditar nele.
     */
    herdado_de: finding.herdado_de,
    textoCorrigido: finding.texto_corrigido,
    // Contrato do motor novo (opcional): quando existe, o cartão usa `findingCard`.
    // Só o contrato VÁLIDO vira cartão do motor; corrompido cai no texto legado
    // (e o veredito já bloqueia a emissão por integridade).
    motor: parseEngineFinding(finding.motor).kind === "engine" ? finding.motor : undefined,
    confianca: finding.confianca,
    tier: classifyFindingTier(finding),
    assurance: getFindingAssurance(finding),
    disciplina: classifyFindingDiscipline(finding),
    tipoErro: classifyFindingErrorType(finding),
    raw: [
      `${rotuloDoAchado(finding.id)}: ${textoComRotulos(finding.tipo)}`,
      `Prioridade: ${finding.prioridade}`,
      finding.severity_reason
        ? `Motivo da severidade: ${finding.severity_reason}`
        : "",
      `Página: ${finding.pagina}`,
      `Capítulo: ${finding.capitulo}`,
      `Local: ${finding.local}`,
      `Evidência: ${finding.evidencia}`,
      `Termo de busca: ${finding.termo_busca ?? finding.evidencia}`,
      `Conflito: ${finding.conflito}`,
      `Ação recomendada: ${finding.sugestao_correcao}`,
      `Impacto: ${getImpactLabel(finding.impacto ?? classifyFindingImpact(finding))}`,
      `Confiança: ${finding.confianca}`,
    ]
      // Parecer antigo não tem motivo de severidade: sem o filtro, a cópia do
      // achado sairia com uma linha em branco no meio.
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Um dos três textos do achado.
 *
 * Eles ganharam RÓTULO PRÓPRIO — "O que está errado", "Por que importa", "O que
 * fazer" — no lugar do nome técnico do campo. O leitor não precisa saber que o
 * banco chama aquilo de `conflito`; precisa saber que pergunta aquele parágrafo
 * responde. Ver `docs/superpowers/specs/2026-08-14-tela-de-achados-design.md`.
 */
/**
 * O TEXTO DOS ACHADOS NA VISTA PARECER. Ele é o mesmo de "Copiar achados", e lá
 * as seções vêm marcadas com `## ` para quem cola num e-mail ou num editor. Na
 * tela, o `## ` aparecia cru ("## BLOQUEIA A EMISSÃO (7)" — achado no teste
 * real de 02/10/2026): aqui a linha marcada vira título, e o resto fica texto.
 */
function TextoDoRelatorio({ texto }: { texto: string }) {
  return (
    <div className="nx-relatorio mt-1 break-words text-sm leading-6">
      {texto.split("\n").map((linha, i) =>
        linha.startsWith("## ") ? (
          <h3 key={i} className="nx-relatorio-secao">
            {linha.slice(3)}
          </h3>
        ) : (
          <p key={i} className={linha.trim() ? "nx-relatorio-linha" : "nx-relatorio-vazia"}>
            {linha}
          </p>
        ),
      )}
    </div>
  );
}

function BlocoDeTexto({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-1">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </p>
      <p className="max-w-[70ch] text-sm leading-6 text-foreground">
        {children}
      </p>
    </section>
  );
}

/**
 * OS TRECHOS DE CADA PÁGINA, recolhidos.
 *
 * Só aparece no achado que vive em mais de um lugar. A lista de achados precisa
 * ser varrível: numa auditoria de 30 achados, quatro linhas de trecho em cada um
 * viram 120 linhas e ninguém acha nada. O trecho é para depois que a pessoa já
 * escolheu aquele achado.
 *
 * HOJE O TRECHO DE CADA PÁGINA NÃO EXISTE no parecer — o motor devolve UMA
 * evidência por achado, não uma por ocorrência. Então o que se abre é honesto
 * sobre isso: mostra a evidência que existe e diz onde estão as outras, em vez
 * de inventar quatro citações que ninguém escreveu.
 */
function TrechosDoAchado({
  paginas,
  evidencia,
  termo,
  aoAbrirPagina,
}: {
  paginas: number[];
  evidencia?: string;
  termo?: string;
  aoAbrirPagina?: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  if (paginas.length <= 1) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-fit items-center gap-2 font-mono text-[11px] tracking-[0.04em] text-primary hover:text-[var(--nexodoc-accent)]"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform",
            aberto ? "rotate-90" : "",
          )}
        />
        {aberto ? "esconder os trechos" : "ver os trechos de cada página"}
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-[var(--duration-base)] ease-[var(--ease-entrance)]"
        style={{
          gridTemplateRows: aberto ? "1fr" : "0fr",
          opacity: aberto ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="nx-cut-7 bg-[var(--nexodoc-recessed)] px-3.5 py-1">
            <div className="flex items-baseline gap-3.5 border-b border-border/60 py-2.5">
              <span className="w-14 shrink-0 font-mono text-[11px] tracking-[0.04em] text-primary">
                pág. {paginas[0]}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
                <HighlightedEvidence text={evidencia} needle={termo} />
              </span>
            </div>
            <p className="py-2.5 text-xs leading-5 text-muted-foreground">
              O mesmo problema aparece também nas páginas{" "}
              <span className="font-mono text-foreground">
                {paginas.slice(1).join(", ")}
              </span>
              . O parecer guarda uma evidência por achado, não uma por página
              {aoAbrirPagina
                ? " — abra o documento para conferir cada uma."
                : "."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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

function FindingField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 py-2">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 break-words text-sm",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value || "não informado"}
      </dd>
    </div>
  );
}

function downloadMarkdown(result: string, fileName = "nexodoc-auditoria.md") {
  const blob = new Blob([`${result}\n\n---\n\n${AVISO_DE_RESPONSABILIDADE}\n`], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * O PARECER EM PAPEL — abre numa aba, para conferir antes de mandar.
 *
 * A rota devolve `inline`, então o navegador mostra o PDF em vez de baixar: o
 * engenheiro entrega esse papel à prefeitura, e entregar sem ler é o erro que
 * este produto inteiro existe para evitar. Baixar continua a um clique, no
 * visualizador.
 *
 * Devolve a mensagem de erro em vez de lançar: quem chama põe no pop, e uma
 * promessa rejeitada num `onClick` morreria no console.
 */
export async function abrirParecerEmPdf(report: AuditReport): Promise<string | null> {
  try {
    const res = await fetch("/api/nexo/parecer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report }),
    });
    if (!res.ok) {
      const corpo = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return corpo?.error ?? "Não foi possível gerar o parecer em PDF.";
    }
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank", "noopener");
    /*
     * O `revoke` espera: revogar na linha seguinte mata a URL antes de a aba
     * nova terminar de carregar, e o PDF abre em branco. Um minuto é folga
     * larga para qualquer leitura inicial.
     */
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  } catch (err) {
    return err instanceof Error
      ? err.message
      : "Não foi possível gerar o parecer em PDF.";
  }
}

/**
 * O HISTÓRICO DE UM ACHADO — auditoria UX/UI, A05/A07.
 *
 * Sai da linha de feedback que o servidor já devolve (atribuição, aviso,
 * encerramento, nota), com data e autor quando o banco os tem. Não inventa o
 * que não foi gravado: o veredito não guarda autor, e a frase diz isso.
 */
function HistoricoDoAchado({
  registro,
  herdadoDe,
  desfecho,
}: {
  registro?: SavedFeedback;
  herdadoDe?: string;
  desfecho?: { kind: DesfechoDoAchado; por: string | null };
}) {
  const quando = (iso?: string | null) =>
    iso ? formatarEmBrasilia(iso, { dateStyle: "short", timeStyle: "short" }) : null;
  const eventos: { chave: string; texto: string; data?: string | null }[] = [];
  if (herdadoDe) {
    eventos.push({ chave: "herdado", texto: `Herdado da auditoria de ${herdadoDe}: o capítulo não mudou desde lá.` });
  }
  if (registro?.verdict && registro.verdict !== "MISSING_FINDING") {
    eventos.push({
      chave: "validade",
      texto: `Validade: ${VEREDITO_LABEL[registro.verdict]} (o autor do julgamento não é registrado).`,
      data: registro.updatedAt,
    });
  }
  if (registro?.assigneeEmail) {
    eventos.push({
      chave: "atribuido",
      texto: `Atribuído a ${registro.assigneeName ?? registro.assigneeEmail}.`,
      data: registro.assignedAt,
    });
  }
  if (registro?.notifiedAt) {
    eventos.push({ chave: "avisado", texto: "Aviso por e-mail enviado a quem recebeu.", data: registro.notifiedAt });
  }
  if (registro?.resolvedAt || desfecho) {
    const tipo = desfecho?.kind ?? registro?.resolutionKind ?? null;
    const por = desfecho?.por ?? registro?.resolvedByName ?? null;
    const rotulo =
      tipo === "ACCEPTED_RISK"
        ? "Decisão técnica registrada"
        : tipo === "FALSE_POSITIVE"
          ? "Encerrado como falso positivo"
          : "Correção informada";
    eventos.push({
      chave: "encerrado",
      texto: `${rotulo}${por ? ` por ${por}` : ""}.${registro?.note ? ` Motivo: ${registro.note}` : ""}`,
      data: registro?.resolvedAt,
    });
  }

  return (
    <div className="grid gap-2 p-4" data-historico-do-achado>
      {eventos.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          Nada registrado ainda. Julgamento, atribuição, aviso e encerramento aparecem aqui com data.
        </p>
      ) : (
        <ol className="m-0 grid list-none gap-2 p-0">
          {eventos.map((e) => (
            <li key={e.chave} className="flex flex-wrap gap-x-3 text-sm leading-6">
              <span className="min-w-[8.5rem] font-mono text-xs leading-6 text-muted-foreground">
                {quando(e.data) ?? "—"}
              </span>
              <span className="min-w-0 flex-1 text-foreground">{e.texto}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="m-0 text-xs text-muted-foreground">
        Encerramentos e reaberturas também entram na aba Conversa, com o nome de quem fez.
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
  resolvidos = new Set<string>(),
  onToggleResolvido,
  view: viewDeFora,
  onViewChange,
  achadoEmFoco,
  motorFonte: motorFonteDeFora,
  fontes,
  onTextoCorrigido,
}: AuditResultProps) {
  const [viewLocal, setViewLocal] = useState<AuditView>("summary");
  /*
   * O TEXTO CORRIGIDO de cada achado: quem pode pedir é decidido lá dentro
   * (`podeGerarTextoCorrigido`); aqui só se entrega o achado como o parecer o
   * tem. Sem `refId` não há como gravar, e o botão não aparece.
   */
  const corretorDo = (finding: StructuredFinding): CorretorDoAchado | undefined =>
    finding.refId
      ? {
          auditId,
          findingId: finding.refId,
          achado: {
            evidencia: finding.evidencia,
            descricao: finding.descricao,
            conflito: finding.conflito,
            sugestao_correcao: finding.acao,
          },
          inicial: finding.textoCorrigido,
          aoGerar: onTextoCorrigido,
        }
      : undefined;
  /*
   * A luz dos cartões. Um handler só para os 45 — ele escreve `--mx`/`--my` no
   * elemento que recebeu o evento, sem passar pelo React.
   */
  const moverLuz = useSpotlight();
  // Controlado por fora (barra de vistas do palco) ou dono da própria vista
  // (drawer do canvas, onde o controle segmentado continua desenhado).
  const controlado = viewDeFora !== undefined;
  const view = controlado ? viewDeFora : viewLocal;
  const setView = (v: AuditView) =>
    controlado ? onViewChange?.(v) : setViewLocal(v);
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
  const [focoAnterior, setFocoAnterior] = useState<string | undefined>(
    undefined,
  );
  /*
   * FILA + DETALHE (A04/A07/A08). `escolhido` é a chave do achado aberto no
   * detalhe; `vistaEstreita` decide o que aparece quando a coluna não comporta
   * os dois; o rascunho de comentário mora aqui para sobreviver à troca de
   * achado e de aba.
   */
  const [escolhido, setEscolhido] = useState<string | undefined>(achadoEmFoco);
  const [vistaEstreita, setVistaEstreita] = useState<"lista" | "detalhe">(
    achadoEmFoco ? "detalhe" : "lista",
  );
  const [abaDoDetalhe, setAbaDoDetalhe] = useState<AbaDoDetalhe>("evidencia");
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [comentariosPorAchado, setComentariosPorAchado] = useState<Record<string, number>>({});
  const [historicoPorAchado, setHistoricoPorAchado] = useState<Record<string, SavedFeedback>>({});
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoDaFila>("todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("");
  const [ordem, setOrdem] = useState<OrdemDaFila>("impacto");
  if (achadoEmFoco !== focoAnterior) {
    setFocoAnterior(achadoEmFoco);
    // Só o caso NÃO controlado: o foco vem do clique no canvas, e ali o parecer
    // mora no drawer, dono da própria vista.
    if (achadoEmFoco && !controlado) setViewLocal("findings");
    // O achado pedido vira o DETALHE (A07), e em coluna estreita o detalhe
    // aparece no lugar da fila.
    if (achadoEmFoco) {
      setEscolhido(achadoEmFoco);
      setVistaEstreita("detalhe");
    }
  }

  // A rolagem é sincronizar com o DOM — aí sim, efeito. Roda depois de a lista
  // existir, senão não há elemento a alcançar.
  useEffect(() => {
    if (!achadoEmFoco || view !== "findings") return;
    const alvo = document.querySelector(
      `[data-achado="${CSS.escape(achadoEmFoco)}"]`,
    );
    /*
     * `start`, não `center`: centralizar deixava o CABEÇALHO do cartão — o
     * título, as etiquetas e o anel de foco — acima da dobra, e quem clicou caía
     * no meio dos campos sem enxergar em qual achado tinha chegado.
     */
    alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [achadoEmFoco, view]);

  const [feedbackByFinding, setFeedbackByFinding] = useState<
    Record<string, FeedbackVerdict>
  >({});
  /*
   * OS CORRIGIDOS QUE O BANCO CONHECE.
   *
   * O `resolvidos` que chega por prop vem da conversa, no IndexedDB desta
   * máquina — e era a única memória que a marcação tinha. Quem revisasse metade
   * do parecer no escritório e abrisse em casa recomeçava do zero.
   *
   * Os dois se somam em vez de um sobrescrever o outro, e a razão é a ordem dos
   * fatos: a prop já está lá na primeira pintura, a resposta do banco chega
   * depois. Deixar o servidor mandar apagaria a marca local durante o voo da
   * requisição; deixar o local mandar ignoraria o que veio da outra máquina.
   * Somar acerta os dois, e a marcação mantém as duas pontas em dia.
   */
  const [resolvidosNoServidor, setResolvidosNoServidor] = useState<
    ReadonlySet<string>
  >(new Set<string>());
  /**
   * Com quem cada achado está, enquanto não é resolvido.
   *
   * Guarda `souEu` junto do nome, e não só o nome: "com Milton" é informação
   * sobre um terceiro, e quem lê isso na PRÓPRIA tela precisa de "com você".
   * Descobrir isso comparando o nome exibido não daria — dois Miltons no
   * escritório, ou o e-mail no lugar do nome, e a tarja mente.
   */
  const [atribuidoPor, setAtribuidoPor] = useState<
    Record<string, { nome: string; souEu: boolean }>
  >({});
  /**
   * O e-mail de quem está lendo, como o SERVIDOR o vê (ver a rota de feedback).
   *
   * Vazio até a primeira carga: enquanto for vazio, nenhuma tarja diz "com
   * você" — e errar para o lado de mostrar o nome é o lado certo de errar.
   */
  const [euSou, setEuSou] = useState("");
  /** Sobe de um a cada envio, para o efeito abaixo reler o que o servidor gravou. */
  const [releituras, setReleituras] = useState(0);
  /** Como cada achado foi encerrado, e por quem. */
  const [desfechoPorAchado, setDesfechoPorAchado] = useState<
    Record<string, { kind: DesfechoDoAchado; por: string | null }>
  >({});
  /*
   * A nota da decisão técnica, por achado, enquanto está sendo escrita. O
   * servidor recusa sem ela (`lib/desfecho-do-achado.ts`); o campo aqui é o que
   * torna possível escrevê-la sem sair do cartão.
   */
  const [notaDoRisco, setNotaDoRisco] = useState<Record<string, string>>({});
  const [escrevendoRisco, setEscrevendoRisco] = useState<string>("");
  /*
   * A SELEÇÃO EM LOTE, no mesmo padrão de `/admin/users`: caixa por linha, barra
   * de ação que só aparece com seleção, e nada de diálogo por cima. Quem revê o
   * memorial marca os cinco erros de PPCI e manda todos de uma vez — mandar um
   * a um seriam cinco viagens e cinco chances de metade chegar.
   */
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(
    new Set<string>(),
  );
  const [destinatario, setDestinatario] = useState("");
  /*
   * O RECADO do encaminhamento — "olha o item 14".
   *
   * Vira a primeira fala da conversa de CADA achado enviado: uma linha por
   * achado, e não uma compartilhada pelo lote. Cada achado tem a sua conversa, e
   * quem abrir um deles daqui a uma semana precisa do recado ali, não num lugar
   * que fala de outros trinta.
   */
  const [recado, setRecado] = useState("");
  const [membros, setMembros] = useState<
    {
      email: string;
      name: string | null;
      status: string;
      grupo?: string | null;
    }[]
  >([]);
  const [enviando, setEnviando] = useState(false);
  const [feedbackSavingKey, setFeedbackSavingKey] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  /**
   * O DESFECHO DO ENVIO, no pop — separado do `feedbackNotice` de propósito.
   *
   * `feedbackNotice` é compartilhado por quatro ações (desfecho, avaliação,
   * erro ausente, envio) e é renderizado num só lugar: dentro da seção
   * "Registrar erro ausente". O resultado de mandar vinte e dois achados
   * aparecia, em mono cinza, encostado numa seção que não tem nada com isso.
   * Aqui o envio ganha o próprio canal, e ele nasce onde a barra de envio
   * estava.
   */
  const [pop, setPop] = useState<{ tom: "ok" | "falha"; texto: string } | null>(
    null,
  );
  /*
   * `useCallback` e não uma seta inline: o pop de sucesso se apaga por
   * `setTimeout`, e o efeito que o arma depende desta função. Uma função nova a
   * cada render reiniciaria o relógio a cada render — num componente que relê o
   * parecer, o aviso nunca sairia sozinho.
   */
  const fecharPop = useCallback(() => setPop(null), []);
  /** O parecer em papel está sendo desenhado. Sem token: é PDF determinístico. */
  const [gerandoParecer, setGerandoParecer] = useState(false);

  /*
   * O AVISO POR E-MAIL, em quatro estados que não se sobrepõem.
   *
   * `pendentesDeAviso` é a lista de quem receberia e-mail se o botão fosse
   * apertado agora. Ela também é o que DECIDE se o botão existe: lista vazia,
   * botão nenhum. Não há botão desabilitado aqui de propósito — um "avisar"
   * cinza no cabeçalho de todo parecer sem atribuição seria um controle que
   * nunca faz nada em 90% das telas.
   */
  const [pendentesDeAviso, setPendentesDeAviso] = useState<PessoaAAvisar[]>([]);
  /** O painel de confirmação está aberto. Clicar no botão NÃO manda e-mail:
   *  abre isto. Ver o comentário no painel. */
  const [confirmandoAviso, setConfirmandoAviso] = useState(false);
  const [avisando, setAvisando] = useState(false);
  /** O que aconteceu no último envio, já em português de gente. Separado de
   *  `feedbackNotice` porque os dois avisos vivem em cantos diferentes da tela
   *  e um sobrescreveria o outro. */
  const [avisoNotice, setAvisoNotice] = useState("");
  const [missingFindingNote, setMissingFindingNote] = useState("");
  const [activePdf, setActivePdf] = useState<ActivePdf | null>(null);
  /**
   * Quantas páginas tem o documento aberto. Zero enquanto o PDF carrega — e aí
   * a régua não existe, o que é o certo: sem o tamanho, "página 12" não diz se
   * é o meio ou o fim.
   */
  const [paginasDoAberto, setPaginasDoAberto] = useState(0);
  /*
   * O ZOOM DA GAVETA. Mora aqui, e não dentro do visor, porque quem desenha os
   * controles é o cabeçalho da gaveta — e porque ele tem de sobreviver à troca
   * de página: quem aumentou para ler um trecho miúdo quer continuar em 150%
   * ao pular para o achado seguinte, senão o controle vira trabalho repetido.
   */
  const [zoomDoPdf, setZoomDoPdf] = useState(1);
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
  const [disciplineFilter, setDisciplineFilter] = useState<
    Set<FindingDiscipline>
  >(new Set());
  const [errorTypeFilter, setErrorTypeFilter] = useState<Set<FindingErrorType>>(
    new Set(),
  );
  /*
   * GRAVIDADE era o filtro que faltava dos três. Disciplina responde "de quem é
   * isto" e tipo responde "que espécie de erro é" — nenhum dos dois responde a
   * primeira pergunta de quem vai emitir, que é "o que me impede de entregar
   * hoje". As faixas já organizavam a lista em seções; o que não havia era como
   * ficar só com uma delas num parecer de quarenta achados.
   */
  const [impactFilter, setImpactFilter] = useState<Set<FindingImpact>>(
    new Set(),
  );
  const parsed = parseAuditResult(content);
  const status = rotuloDoStatus(report?.status_geral ?? parsed.status);
  const elapsed = formatElapsedTime(elapsedMs);
  const runtime = report?.runtime;
  const dualReview =
    runtime?.motor_auditoria === "dual" && runtime.segunda_ia?.ativa;
  const findings = report
    ? report.incongruencias.map(reportFindingToStructured)
    : splitFindings(parsed.findings);
  /*
   * UMA REGRA PARA A FONTE DE TODO ACHADO (A02/A03). `findPdfSource` caía no
   * único PDF disponível mesmo quando o achado citava OUTRO arquivo; agora o
   * achado que não tem fonte diz por quê (`semFonte`), em vez de abrir a errada.
   */
  const catalogo: FonteDoCatalogo[] =
    fontes ??
    pdfSources.map((s) => ({ nome: s.name, url: s.url, checksum: null, origem: "local" as const }));
  const fonteDoAchado = (finding: StructuredFinding) =>
    resolverFonte({ arquivo: finding.documento }, catalogo);
  const findingsWithPdf = findings.map((finding) => {
    const fonte = fonteDoAchado(finding);
    return {
      ...finding,
      pdfUrl: fonte.tipo === "arquivo" ? fonte.fonte.url : undefined,
      semFonte: fonte.tipo === "ausente" && catalogo.length > 0 ? fonte.frase : undefined,
    };
  });
  // Item 2/4 — duas camadas: sólidos (principal) e sugestões da IA (recolhível).
  const principalFindingsWithPdf = findingsWithPdf.filter(
    (finding) => finding.tier !== "sugestao",
  );
  const suggestionFindings = findingsWithPdf.filter(
    (finding) => finding.tier === "sugestao" && !finding.motor,
  );
  /*
   * QUESTÕES EM ABERTO DO MOTOR NOVO. O contrato põe o inconclusivo do motor na
   * camada "sugestão", mas ele não é palpite rebaixado: é verificação que parou
   * por falta de informação, com premissas e fontes — e a de prioridade Alta
   * impede a emissão (`avaliarEmissao`). Por isso fica fora do bloco recolhido
   * que diz "não contam para o veredito", visível e com o cartão do motor.
   */
  const RANK_DA_SEVERIDADE: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
  const openEngineFindings = findingsWithPdf
    .filter((finding) => finding.tier === "sugestao" && !!finding.motor)
    // A que bloqueia a emissão vem primeiro.
    .sort((a, b) => (RANK_DA_SEVERIDADE[a.severity] ?? 3) - (RANK_DA_SEVERIDADE[b.severity] ?? 3));

  // Filtros por disciplina e tipo de erro (só mostra os que existem no resultado).
  /*
   * A ORDEM DOS CHIPS DE DISCIPLINA — e a lista de quais existem.
   *
   * PRECISA CONTER TODAS. Disciplina fora daqui não é só desordenada: ela some
   * de `presentDisciplines`, e o chip de filtro dela nunca é desenhado. Um
   * parecer com trinta achados de climatização não teria como filtrá-los.
   */
  const disciplineOrder: FindingDiscipline[] = [
    "geral",
    "arquitetura",
    "estrutural",
    "hidrossanitario",
    "eletrico",
    "ppci",
    "cabeamento",
    "climatizacao",
    "gases_medicinais",
    "terraplenagem",
    "drenagem",
    "pavimentacao",
    "sinalizacao",
    "urbanizacao",
    "paisagismo",
    "acessibilidade",
  ];
  const findingDiscipline = (finding: StructuredFinding): FindingDiscipline =>
    finding.disciplina ?? "geral";
  const findingErrorType = (finding: StructuredFinding): FindingErrorType =>
    finding.tipoErro ?? "tecnico";
  const presentDisciplines = disciplineOrder.filter((discipline) =>
    principalFindingsWithPdf.some(
      (finding) => findingDiscipline(finding) === discipline,
    ),
  );
  const presentErrorTypes = (
    [
      "identidade",
      "escopo",
      "norma",
      "quantitativo",
      "especificacao",
      "editorial",
      "tecnico",
    ] as FindingErrorType[]
  ).filter((type) =>
    principalFindingsWithPdf.some(
      (finding) => findingErrorType(finding) === type,
    ),
  );
  const presentImpacts = IMPACT_SECTIONS.map((s) => s.key).filter((impact) =>
    principalFindingsWithPdf.some(
      (finding) => findingImpactBucket(finding) === impact,
    ),
  );
  /*
   * SITUAÇÃO OPERACIONAL (A04). Encerrado = corrigido aqui, corrigido noutra
   * máquina, ou com desfecho gravado — a mesma soma de `estaResolvido`, mais o
   * desfecho. "Meus pendentes" é o que está COM quem lê e ainda não fechou.
   */
  const encerradoNaFila = (refId?: string) =>
    Boolean(refId) &&
    (resolvidos.has(refId!) || resolvidosNoServidor.has(refId!) || Boolean(desfechoPorAchado[refId!]));
  const rotuloDoResponsavel = (refId?: string) => {
    const r = refId ? atribuidoPor[refId] : undefined;
    return r ? (r.souEu ? "você" : r.nome) : "";
  };
  const casaSituacao = (finding: StructuredFinding, s: SituacaoDaFila) => {
    const fechado = encerradoNaFila(finding.refId);
    const dono = finding.refId ? atribuidoPor[finding.refId] : undefined;
    if (s === "todos") return true;
    if (s === "encerrados") return fechado;
    if (fechado) return false;
    if (s === "meus") return Boolean(dono?.souEu);
    if (s === "sem-responsavel") return !dono;
    return true;
  };
  const termo = paraBusca(busca.trim());
  const casaBusca = (finding: StructuredFinding) =>
    !termo ||
    paraBusca(
      [
        // As duas formas: quem digita a sigla que lê (ACH-014) e quem cola o
        // id de um link antigo (INC-014) acham o mesmo achado.
        finding.refId,
        rotuloDoAchado(finding.refId),
        finding.title,
        finding.descricao,
        finding.evidencia,
        finding.documento,
        finding.local,
        finding.conflito,
        finding.acao,
        finding.pagina ? `pagina ${finding.pagina} pag ${finding.pagina} p.${finding.pagina}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    ).includes(termo);
  const semSituacao = principalFindingsWithPdf.filter(
    (finding) =>
      (disciplineFilter.size === 0 ||
        disciplineFilter.has(findingDiscipline(finding))) &&
      (errorTypeFilter.size === 0 ||
        errorTypeFilter.has(findingErrorType(finding))) &&
      (impactFilter.size === 0 ||
        impactFilter.has(findingImpactBucket(finding))) &&
      casaBusca(finding) &&
      (!responsavelFiltro || rotuloDoResponsavel(finding.refId) === responsavelFiltro),
  );
  const filteredPrincipal = semSituacao.filter((finding) => casaSituacao(finding, situacao));
  const contagemDaSituacao = (s: SituacaoDaFila) =>
    semSituacao.filter((finding) => casaSituacao(finding, s)).length;
  const responsaveisPresentes = [
    ...new Set(
      principalFindingsWithPdf
        .map((f) => (encerradoNaFila(f.refId) ? "" : rotuloDoResponsavel(f.refId)))
        .filter(Boolean),
    ),
  ].sort((a, b) => (a === "você" ? -1 : b === "você" ? 1 : a.localeCompare(b, "pt-BR")));
  const filtrosAtivos =
    disciplineFilter.size > 0 ||
    errorTypeFilter.size > 0 ||
    impactFilter.size > 0 ||
    Boolean(termo) ||
    Boolean(responsavelFiltro) ||
    situacao !== "todos";
  /*
   * DISCIPLINA E TIPO FICAM ATRÁS DE UM BOTÃO. São recortes de consulta — "o
   * que é da elétrica?" —, não de trabalho: quem revisa decide pela situação e
   * pela gravidade, e as duas linhas de etiquetas empurravam o primeiro achado
   * para baixo da dobra em toda visita. Abrem sozinhas quando há filtro delas
   * ativo, para que um recorte nunca fique aplicado e invisível.
   */
  const recortesAtivos =
    disciplineFilter.size +
    errorTypeFilter.size +
    impactFilter.size +
    (responsavelFiltro ? 1 : 0);
  const [recortesAbertos, setRecortesAbertos] = useState(false);
  /** Faixas recolhidas na fila agrupada por impacto. */
  const [faixasRecolhidas, setFaixasRecolhidas] = useState<Set<FindingImpact>>(
    () => new Set(),
  );
  const bloqueiamNaFila = principalFindingsWithPdf.filter(
    (f) => findingImpactBucket(f) === "critico_documental",
  ).length;
  const julgadosNaFila = principalFindingsWithPdf.filter(
    (f) => f.refId && feedbackByFinding[f.refId],
  ).length;
  const mostrarRecortes = recortesAbertos || recortesAtivos > 0;
  const limparFiltros = () => {
    setDisciplineFilter(new Set());
    setErrorTypeFilter(new Set());
    setImpactFilter(new Set());
    setBusca("");
    setResponsavelFiltro("");
    setSituacao("todos");
  };
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
  const primeiraPagina = (f: StructuredFinding) =>
    getFirstPageNumber(f.pagina) ?? Number.MAX_SAFE_INTEGER;
  const numeroDaRef = (f: StructuredFinding) =>
    Number.parseInt((f.refId ?? "").replace(/[^0-9]+/g, ""), 10) || Number.MAX_SAFE_INTEGER;
  const groupedPrincipal = [...filteredPrincipal].sort((a, b) => {
    if (ordem === "pagina") {
      return primeiraPagina(a) - primeiraPagina(b) || numeroDaRef(a) - numeroDaRef(b);
    }
    if (ordem === "documento") {
      return (
        (a.documento ?? "").localeCompare(b.documento ?? "", "pt-BR") ||
        primeiraPagina(a) - primeiraPagina(b)
      );
    }
    if (ordem === "referencia") return numeroDaRef(a) - numeroDaRef(b);
    const porFaixa =
      impactOrder.indexOf(findingImpactBucket(a)) -
      impactOrder.indexOf(findingImpactBucket(b));

    if (porFaixa !== 0) {
      return porFaixa;
    }

    return (
      disciplineOrder.indexOf(findingDiscipline(a)) -
      disciplineOrder.indexOf(findingDiscipline(b))
    );
  });
  /*
   * O GRUPO TÉCNICO DOS ACHADOS SELECIONADOS — para a lista de quem recebe
   * começar por quem responde pela disciplina.
   *
   * SÓ QUANDO OS SELECIONADOS CONCORDAM. Enviar em lote é comum, e quatro
   * achados de disciplinas diferentes não têm um dono só: sugerir o grupo do
   * primeiro seria palpite disfarçado de ajuda, e o palpite erraria em três dos
   * quatro. Discordando, a lista fica na ordem normal.
   */
  const grupoDoEnvio = (() => {
    if (selecionados.size === 0) return undefined;

    const grupos = new Set(
      [...filteredPrincipal, ...openEngineFindings, ...suggestionFindings]
        .filter((f) => f.refId && selecionados.has(f.refId))
        .map((f) => grupoDaDisciplinaDoAchado(findingDiscipline(f))),
    );

    if (grupos.size !== 1) return undefined;

    return [...grupos][0];
  })();

  const membrosDoGrupo = grupoDoEnvio
    ? membros.filter((m) => m.grupo === grupoDoEnvio)
    : [];
  /*
   * GRUPO SEM NINGUÉM NÃO VIRA CABEÇALHO.
   *
   * `terraplenagem` responde ao grupo `externo`, e o escritório NÃO TEM ninguém
   * nesse grupo — a disciplina é terceirizada. O seletor abria um `<optgroup>`
   * rotulado "Externo", vazio, e jogava o escritório inteiro em "Resto do
   * escritório": um cabeçalho que promete a lista curta e entrega zero é pior
   * do que não agrupar, porque quem lê acha que a pessoa certa não existe.
   *
   * Medido em 21/08: 57 dos 229 achados dos dois memoriais de referência caem
   * em terraplenagem. Um quarto dos envios via esse cabeçalho vazio.
   */
  const agrupar = membrosDoGrupo.length > 0;
  const membrosDeFora = agrupar
    ? membros.filter((m) => m.grupo !== grupoDoEnvio)
    : membros;

  const impactCount = (impact: FindingImpact) =>
    filteredPrincipal.filter(
      (finding) => findingImpactBucket(finding) === impact,
    ).length;
  // Continua alimentando os chips de filtro por disciplina.
  const disciplineCount = (discipline: FindingDiscipline) =>
    filteredPrincipal.filter(
      (finding) => findingDiscipline(finding) === discipline,
    ).length;
  const toggleFrom = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  };
  // Item 12 — veredito de emissão: a regra única (`avaliarEmissao`), a mesma do
  // texto exportado, do cartão e do grafo.
  const emissao = report ? avaliarEmissao(report) : null;
  const verdict = emissao?.veredito ?? null;
  const avisoCobreOVeredito = Boolean(
    report && emissao?.estado === "incompleto" && incompletudeDoParecer(report).incompleta,
  );
  const groupedReportFindings = report
    ? groupFindingsByImpact(achadosConfirmados(report.incongruencias))
    : null;
  const groupedStructuredFindings = {
    critico_documental: findingsWithPdf.filter(
      (finding) =>
        finding.impacto === "critico_documental" ||
        (!finding.impacto && finding.severity === "critical"),
    ),
    risco_de_execucao: findingsWithPdf.filter(
      (finding) => finding.impacto === "risco_de_execucao",
    ),
    tecnico_contratual: findingsWithPdf.filter(
      (finding) => finding.impacto === "tecnico_contratual",
    ),
    revisao_editorial: findingsWithPdf.filter(
      (finding) =>
        finding.impacto === "revisao_editorial" ||
        (!finding.impacto && finding.severity !== "critical"),
    ),
  };
  /*
   * O TEXTO DO PARECER conta e lista só os confirmados (`camada-do-achado.ts`),
   * como o PDF. Somava as sugestões: "BLOQUEIA A EMISSÃO (7) · EXIGE DECISÃO
   * (41) · REVISÃO (14)" dava 62 ao lado do "56 achados".
   */
  const findingsText = buildFindingsText(principalFindingsWithPdf);
  const actionsText = buildActionsText(principalFindingsWithPdf);
  const uniqueDocumentCount = countUniqueDocuments(findingsWithPdf);
  const evidenceLinkCount = findingsWithPdf.filter(
    (finding) => finding.pdfUrl,
  ).length;
  const criticalCount = groupedReportFindings
    ? groupedReportFindings.critico_documental.length
    : findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter(
    (finding) => finding.severity === "warning",
  ).length;
  const firstAction = getFirstAction(findingsWithPdf);
  const nextStep =
    firstAction ??
    (criticalCount > 0
      ? "Revisar achados críticos antes da emissão."
      : "Validar pontos de revisão e registrar aceite técnico.");
  const projectFields = report
    ? [
        { label: "Arquivo", value: report.arquivo ?? "não informado" },
        { label: "Obra", value: report.obra || "não identificada" },
        { label: "Código", value: report.codigo || "não identificado" },
        { label: "Município", value: report.municipio || "não identificado" },
        { label: "Data", value: report.data_documento || "não identificada" },
        {
          label: "Nível",
          value: getAnalysisLevelLabel(
            report.runtime?.nivel_analise ?? "standard",
          ),
        },
        {
          label: "Motor",
          value: dualReview ? "2 IAs em consenso" : "IA única",
        },
        {
          label: "Provider",
          value: report.runtime?.provedor_principal || "openai",
        },
        {
          label: "Regras locais",
          value: report.runtime?.regras_locais_ativas ? "ativas" : "desligadas",
        },
        {
          label: "Modelo",
          value: report.runtime?.modelo_principal || "não informado",
        },
        {
          label: "Validação",
          value:
            report.runtime?.modelo_validacao ||
            report.runtime?.modelo_principal ||
            "não informado",
        },
        {
          label: "Total de achados",
          value: String(achadosConfirmados(report.incongruencias).length),
        },
      ]
    : parseProjectFields(parsed.project);

  /**
   * O QUE O SERVIDOR SABE sobre cada achado — veredito, desfecho e com quem está.
   *
   * `releituras` existe para ENVIAR poder pedir esta carga de novo: a tela
   * adivinhava a tarja com o valor cru do seletor e escrevia "com
   * milton@prosul.com" onde o servidor já sabia dizer "com Milton". Um contador,
   * e não uma função exportada do efeito, porque o React Compiler barra
   * `setState` chamado direto do corpo de um efeito — e a barra tem razão: o que
   * muda aqui é a intenção de reler, não a chamada.
   */
  useEffect(() => {
    if (!auditId) {
      return;
    }

    async function loadFeedback() {
      try {
        const response = await fetch(getFeedbackEndpoint(auditId!), {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          feedback?: SavedFeedback[];
          euSou?: string;
        };

        if (payload.euSou) {
          setEuSou(payload.euSou.toLowerCase());
        }

        const linhas = (payload.feedback ?? []).filter(
          (item) => item.findingId,
        );
        const saved = Object.fromEntries(
          linhas
            .filter((item) => item.verdict)
            .map((item) => [
              item.findingId as string,
              item.verdict as FeedbackVerdict,
            ]),
        );

        setFeedbackByFinding(saved);
        setComentariosPorAchado(
          Object.fromEntries(linhas.map((item) => [item.findingId as string, item.comentarios ?? 0])),
        );
        setHistoricoPorAchado(
          Object.fromEntries(linhas.map((item) => [item.findingId as string, item])),
        );
        setAtribuidoPor(
          Object.fromEntries(
            linhas
              // Com quem ESTÁ é diferente de quem resolveu: assim que o achado
              // fecha, ele deixa de estar com alguém e passa a ter desfecho.
              .filter((item) => item.assigneeEmail && !item.resolvedAt)
              .map((item) => [
                item.findingId as string,
                {
                  nome: item.assigneeName ?? (item.assigneeEmail as string),
                  souEu:
                    Boolean(payload.euSou) &&
                    (item.assigneeEmail as string).toLowerCase() ===
                      (payload.euSou as string).toLowerCase(),
                },
              ]),
          ),
        );
        setDesfechoPorAchado(
          Object.fromEntries(
            linhas
              .filter((item) => item.resolutionKind)
              .map((item) => [
                item.findingId as string,
                {
                  kind: item.resolutionKind as DesfechoDoAchado,
                  por: item.resolvedByName,
                },
              ]),
          ),
        );
        setResolvidosNoServidor(
          new Set(
            linhas
              .filter((item) => item.resolvedAt)
              .map((item) => item.findingId as string),
          ),
        );
      } catch {
        // O relatório continua utilizável mesmo sem carregar avaliação.
      }
    }

    void loadFeedback();
  }, [auditId, releituras]);

  /*
   * QUEM ESTÁ ESPERANDO AVISO.
   *
   * Consulta própria, e não um campo a mais na carga de feedback acima: ela
   * depende do STATUS do membro no escritório (para marcar quem é convidado e
   * nunca entrou), e a rota de feedback existe para responder outra pergunta.
   * Misturar as duas faria a rota do parecer consultar a tabela de membros por
   * um dado que só este botão usa.
   *
   * Reage a `releituras` pelo mesmo motivo que a carga de feedback: ENVIAR
   * acabou de criar pendências, e o botão precisa aparecer sem recarregar a
   * página. É o caminho normal — distribuir e avisar acontecem no mesmo minuto.
   */
  useEffect(() => {
    if (!auditId) return;

    let cancelado = false;

    async function carregarPendentes() {
      try {
        const response = await fetch(
          `/api/audits/${encodeURIComponent(auditId!)}/avisar`,
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const payload = (await response.json()) as {
          pendentes?: PessoaAAvisar[];
        };

        if (!cancelado) setPendentesDeAviso(payload.pendentes ?? []);
      } catch {
        // Sem a lista o botão não aparece, e o parecer segue utilizável. É a
        // degradação certa: o e-mail é acessório do trabalho, não o trabalho.
      }
    }

    void carregarPendentes();

    return () => {
      cancelado = true;
    };
  }, [auditId, releituras]);

  const achadosAAvisar = pendentesDeAviso.reduce(
    (soma, p) => soma + p.quantidade,
    0,
  );

  /**
   * AVISAR — o único lugar do produto que manda e-mail para pessoa de verdade.
   *
   * Só é chamado do painel de confirmação, nunca do botão do cabeçalho. E-mail
   * não tem desfazer, e um clique de mira errada no cabeçalho de um parecer não
   * pode alcançar a caixa de entrada de doze pessoas.
   */
/**
 * QUEM FALHOU, E POR QUÊ — o motivo junto do endereço.
 *
 * A frase dizia só os e-mails: "Não foi possível avisar ninguém.
 * fulano@prosul.com". O servidor manda o motivo em `falharam[].erro` desde
 * sempre, e a tela o jogava fora — então a única forma de descobrir por que o
 * envio falhou era abrir o painel de rede do navegador.
 *
 * Custou uma investigação inteira: em produção o erro era `Invalid \`from\`
 * field`, um remetente malformado, e a tela não tinha como dizer isso. Motivo
 * escondido transforma um ajuste de variável de ambiente numa caça.
 *
 * AGRUPA POR MOTIVO. Cinco pessoas que falharam pela mesma razão são uma frase,
 * não cinco — repetir o mesmo texto cinco vezes esconde o que ele diz.
 */
function porQue(falharam: readonly { email: string; erro?: string }[]): string {
  const porMotivo = new Map<string, string[]>();
  for (const f of falharam) {
    const motivo = f.erro?.trim() || "motivo não informado";
    const lista = porMotivo.get(motivo);
    if (lista) lista.push(f.email);
    else porMotivo.set(motivo, [f.email]);
  }
  return [...porMotivo.entries()]
    .map(([motivo, emails]) => `${emails.join(", ")} (${motivo})`)
    .join("; ");
}

  async function avisarOsEnvolvidos() {
    if (!auditId || pendentesDeAviso.length === 0) return;

    setAvisando(true);
    setAvisoNotice("");

    try {
      const response = await fetch(
        `/api/audits/${encodeURIComponent(auditId)}/avisar`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );

      const payload = (await response.json().catch(() => null)) as {
        estado?: string;
        avisados?: PessoaAAvisar[];
        falharam?: { email: string; erro: string }[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível avisar.");
      }

      const avisados = payload?.avisados ?? [];
      const falharam = payload?.falharam ?? [];

      /*
       * CADA ESTADO TEM A FRASE DELE, e nenhuma delas é "pronto!".
       *
       * `gravado` é o que acontece na máquina de desenvolvimento, e é o estado
       * que mais precisa de texto próprio: se ele dissesse "avisados", quem
       * testa aqui concluiria que o e-mail funciona — e descobriria o contrário
       * no dia em que a produção não avisasse ninguém.
       */
      if (payload?.estado === "nada-a-avisar") {
        setAvisoNotice("Todo mundo já foi avisado.");
      } else if (payload?.estado === "nao-configurado") {
        setAvisoNotice(
          "O envio de e-mail não está configurado neste ambiente. Ninguém foi avisado, e nada foi marcado como avisado.",
        );
      } else if (payload?.estado === "gravado") {
        setAvisoNotice(
          `Modo de desenvolvimento: ${plural(avisados.length, "aviso gravado", "avisos gravados")} em scratchpad/qa/correio.jsonl. Nenhum e-mail saiu.`,
        );
      } else if (avisados.length === 0) {
        setAvisoNotice(`Não foi possível avisar ninguém. ${porQue(falharam)}`);
      } else {
        const base = `${plural(avisados.length, "pessoa avisada", "pessoas avisadas")} por e-mail.`;
        setAvisoNotice(
          falharam.length > 0
            ? `${base} ${plural(falharam.length, "não chegou", "não chegaram")}: ${porQue(falharam)} — o botão continua ali para tentar de novo.`
            : base,
        );
      }

      setConfirmandoAviso(false);
      // A verdade do servidor por cima: é ela que sabe quem ficou pendente
      // depois de uma falha parcial, e é ela que faz o botão sumir.
      setReleituras((n) => n + 1);
    } catch (error) {
      setAvisoNotice(
        error instanceof Error ? error.message : "Não foi possível avisar.",
      );
    } finally {
      setAvisando(false);
    }
  }

  /** Corrigido aqui OU corrigido em outra máquina — ver `resolvidosNoServidor`. */
  const estaResolvido = (refId: string | undefined) =>
    Boolean(refId) &&
    (resolvidos.has(refId!) || resolvidosNoServidor.has(refId!));

  /** A chave estável de um achado na fila — a referência, ou o texto cru. */
  const chaveDoAchado = (f: StructuredFinding) => f.refId ?? `raw:${f.raw.slice(0, 120)}`;
  /*
   * O DETALHE: o escolhido, se ainda existir; senão o primeiro da fila. Um
   * escolhido que o filtro escondeu continua aberto — tirar o achado da frente
   * de quem o está lendo porque mexeu num filtro seria perder o lugar.
   */
  const achadoDoDetalhe =
    groupedPrincipal.find((f) => chaveDoAchado(f) === escolhido) ??
    principalFindingsWithPdf.find((f) => chaveDoAchado(f) === escolhido) ??
    groupedPrincipal[0];
  const chaveDoDetalhe = achadoDoDetalhe ? chaveDoAchado(achadoDoDetalhe) : undefined;
  const indiceDoDetalhe = achadoDoDetalhe
    ? Math.max(0, groupedPrincipal.indexOf(achadoDoDetalhe))
    : 0;
  function abrirNoDetalhe(chave: string) {
    setEscolhido(chave);
    setVistaEstreita("detalhe");
    requestAnimationFrame(() => {
      const alvo = document.querySelector<HTMLElement>("[data-detalhe-do-achado]");
      alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
      document
        .querySelector<HTMLElement>(`[data-item-da-fila="${CSS.escape(chave)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }
  /**
   * O status da linha da fila, em uma ou duas palavras à direita: como fechou,
   * se foi descartado, ou com quem está. Sem nada a dizer (pendente e sem
   * ninguém), cala — o losango vazado já diz "ainda por julgar". A frase
   * completa segue em `situacaoLegivel`, no `title` e para leitor de tela.
   */
  const statusCurto = (
    finding: StructuredFinding,
  ): { texto: string; tom: "ok" | "seu" | "descartado" | "neutro" } | null => {
    const ref = finding.refId;
    if (!ref) return null;
    const d = desfechoPorAchado[ref];
    if (d) return { texto: DESFECHO_LABEL[d.kind], tom: d.kind === "FALSE_POSITIVE" ? "descartado" : "ok" };
    if (estaResolvido(ref)) return { texto: "Corrigido", tom: "ok" };
    if (feedbackByFinding[ref] === "FALSE_POSITIVE") return { texto: "Falso positivo", tom: "descartado" };
    const com = atribuidoPor[ref];
    if (com) return com.souEu ? { texto: "com você", tom: "seu" } : { texto: com.nome, tom: "neutro" };
    return null;
  };
  /** Tratamento em uma frase: com quem está, ou como fechou (A05). */
  const situacaoLegivel = (finding: StructuredFinding) => {
    const ref = finding.refId;
    if (ref && desfechoPorAchado[ref]) {
      const d = desfechoPorAchado[ref];
      const rotulo = d.kind === "FIXED_IN_DOC" ? "Correção informada" : DESFECHO_LABEL[d.kind];
      return `${rotulo}${d.por ? ` · ${d.por}` : ""}`;
    }
    if (estaResolvido(ref)) return "Correção informada";
    if (ref && atribuidoPor[ref]) {
      return atribuidoPor[ref].souEu ? "Pendente · com você" : `Pendente · com ${atribuidoPor[ref].nome}`;
    }
    return "Pendente · sem responsável";
  };

  /**
   * Marca (ou desmarca) o achado como corrigido nos DOIS lugares.
   *
   * A conversa continua sendo quem responde na hora — é local, não espera rede,
   * e é dela que sai o risco no título. O banco é o que faz a decisão
   * sobreviver a trocar de máquina. Se a gravação falhar, a marca local fica de
   * pé: perder o trabalho da sessão por causa de uma rede instável seria pior
   * que ficar sem a cópia durável, e o aviso diz o que aconteceu.
   */
  async function alternarResolvido(
    finding: StructuredFinding,
    resolvido: boolean,
  ) {
    const refId = finding.refId;
    if (!refId) return;

    onToggleResolvido?.(refId, resolvido);
    setResolvidosNoServidor((atual) => {
      const proximo = new Set(atual);
      if (resolvido) proximo.add(refId);
      else proximo.delete(refId);
      return proximo;
    });

    if (!auditId) return;

    try {
      const response = await fetch(getFeedbackEndpoint(auditId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: refId,
          findingLabel: finding.title,
          page: finding.pagina,
          resolved: resolvido,
        }),
      });

      if (!response.ok) {
        throw new Error("marcação não gravada");
      }
    } catch {
      setFeedbackNotice(
        "Corrigido marcado nesta máquina, mas não foi possível gravar no histórico.",
      );
    }
  }

  /*
   * QUEM PODE RECEBER: os membros do escritório, inclusive quem foi convidado e
   * nunca entrou. Mandar trabalho a quem ainda não logou é o caso do primeiro
   * dia, e esconder essa pessoa da lista tornaria o convite inútil justamente
   * quando ele mais serve.
   */
  useEffect(() => {
    let vivo = true;

    fetch("/api/organizacao/membros")
      .then((r) => (r.ok ? r.json() : { membros: [] }))
      .then((d) => {
        /*
         * QUEM FOI DESLIGADO SAI DA LISTA.
         *
         * A rota lista o vínculo com o status, e está certa — o painel de
         * membros precisa ver quem está fora para poder religar. Aqui a
         * pergunta é outra: "para quem dá para mandar trabalho". O servidor já
         * recusa (ver [[lib/fila-de-achados]]); tirar do seletor evita oferecer
         * um caminho que só termina em erro.
         *
         * INVITED FICA, com o rótulo "(convidado)" que a opção já traz: dá para
         * atribuir a quem nunca entrou, e é assim de propósito.
         */
        if (vivo) {
          setMembros(
            (d.membros ?? []).filter(
              (m: { status?: string }) => m.status !== "DISABLED",
            ),
          );
        }
      })
      .catch(() => {
        if (vivo) setMembros([]);
      });

    return () => {
      vivo = false;
    };
  }, []);

  function alternarSelecao(refId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(refId)) proximo.delete(refId);
      else proximo.add(refId);
      return proximo;
    });
  }

  /*
   * SELEÇÃO EM MASSA — 22 cliques viravam um.
   *
   * O envio em lote já existia: a etiqueta "Ref. INC-00x" é caixa de seleção e
   * a barra do rodapé manda todos numa requisição só. O que faltava era MARCAR
   * rápido — quem revisa um memorial inteiro marca vinte e dois achados um a
   * um antes de chegar à barra.
   *
   * O ALVO É O FILTRO ATUAL, e é por isso que ele sai de `groupedPrincipal`:
   * "todos os críticos" e "todos de hidrossanitário" não precisam de controle
   * próprio, porque os filtros da tela já sabem fazer isso. Um segundo jeito de
   * dizer "quais" seria uma segunda regra, e as duas discordariam.
   *
   * ACHADO FECHADO FICA DE FORA. Mandar para alguém um achado já corrigido é
   * pedir trabalho que não existe — e é a MESMA condição do botão "Enviar" de
   * cada cartão, de propósito: dois critérios diferentes para a mesma ação
   * fariam a contagem do botão mentir sobre o que ele marca.
   *
   * As sugestões da IA também ficam de fora: elas vivem noutra lista, dobrada,
   * e não contam para o veredito.
   */
  const enviaveisDoFiltro = groupedPrincipal.filter(
    (f) => f.refId && !estaResolvido(f.refId),
  );
  const todosDoFiltroMarcados =
    enviaveisDoFiltro.length > 0 &&
    enviaveisDoFiltro.every((f) => selecionados.has(f.refId!));

  function alternarTodosDoFiltro() {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      for (const f of enviaveisDoFiltro) {
        if (todosDoFiltroMarcados) proximo.delete(f.refId!);
        else proximo.add(f.refId!);
      }
      return proximo;
    });
  }

  const nomeDoDestinatario =
    membros.find((m) => m.email === destinatario)?.name ?? destinatario;

  async function enviarSelecionados() {
    if (!auditId || !destinatario || selecionados.size === 0) {
      return;
    }

    setEnviando(true);
    setPop(null);

    try {
      const response = await fetch(
        `/api/audits/${encodeURIComponent(auditId)}/atribuir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            findingIds: [...selecionados],
            assigneeEmail: destinatario,
            assigneeNome:
              membros.find((m) => m.email === destinatario)?.name ?? "",
            recado,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        atribuidos?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível enviar.");
      }

      /*
       * A TARJA APARECE NA HORA, com o nome que o seletor já mostrava — e não
       * com o e-mail cru, que era o defeito antigo ("com milton@prosul.com"
       * numa lista em que a pessoa se chama Milton).
       *
       * Otimista E confirmada logo abaixo: só recarregar deixaria o achado sem
       * tarja nenhuma se a releitura falhasse, e sumir depois de um envio que
       * DEU CERTO é o pior dos dois erros.
       */
      const recebeu = membros.find((m) => m.email === destinatario);
      const rotulo = {
        nome: recebeu?.name ?? destinatario,
        souEu: destinatario === euSou,
      };

      setAtribuidoPor((atual) => {
        const proximo = { ...atual };
        for (const id of selecionados) proximo[id] = rotulo;
        return proximo;
      });
      setSelecionados(new Set());
      setDestinatario("");
      // O recado é DAQUELE envio. Mantê-lo faria o próximo lote sair com o
      // bilhete do anterior, para outra pessoa e sobre outros achados.
      setRecado("");
      // E a versão do servidor por cima: é ela que sabe o nome de quem foi
      // convidado e nunca entrou, e quem o `euSou` de verdade é.
      setReleituras((n) => n + 1);
      /*
       * O NOME DE QUEM RECEBEU ENTRA NO AVISO. A frase antiga dizia só quantos
       * foram; quem manda em lote manda para pessoas diferentes na mesma
       * sessão, e "22 achados enviados" não diz se foram para o Milton ou para
       * o Victor. `rotulo.nome` é o mesmo texto que o seletor mostrava.
       */
      const pedidos = selecionados.size;
      const feitos = payload?.atribuidos ?? 0;
      setPop({
        tom: feitos === pedidos ? "ok" : "falha",
        texto:
          feitos === pedidos
            ? `${plural(feitos, "achado atribuído", "achados atribuídos")} a ${rotulo.nome}. ${palavra(feitos, "Aparece", "Aparecem")} na home de quem recebeu; ninguém recebeu e-mail ainda.`
            : `${feitos} de ${pedidos} achados atribuídos a ${rotulo.nome}. ${pedidos - feitos} não ${palavra(pedidos - feitos, "entrou", "entraram")} — confira a situação na fila.`,
      });
    } catch (error) {
      // A falha FICA na tela: a seleção não foi zerada, e o motivo é a única
      // coisa que explica por que os achados continuam marcados.
      setPop({
        tom: "falha",
        texto:
          error instanceof Error ? error.message : "Não foi possível enviar.",
      });
    } finally {
      setEnviando(false);
    }
  }

  /**
   * O DESFECHO, na mesma rota do veredito — porque é a mesma linha do banco.
   *
   * A regra que vale é a do SERVIDOR (`lib/desfecho-do-achado.ts`): decisão
   * técnica sem nota é recusada lá. O botão desabilitado aqui é cortesia, e não
   * garantia — quem chamar a rota à mão encontra a mesma recusa.
   */
  async function salvarDesfecho(
    finding: StructuredFinding,
    index: number,
    resolutionKind: DesfechoDoAchado,
    note?: string,
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
          resolutionKind,
          note,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? "Não foi possível registrar o desfecho.",
        );
      }

      /*
       * A tela reflete o que acabou de acontecer sem recarregar tudo: o achado
       * deixa de estar COM alguém e passa a ter desfecho. O nome de quem
       * resolveu fica nulo até a próxima leitura — é você, e a tela não precisa
       * dizer o seu nome de volta para você.
       */
      setAtribuidoPor((atual) => {
        const proximo = { ...atual };
        delete proximo[findingId];
        return proximo;
      });
      setDesfechoPorAchado((atual) => ({
        ...atual,
        [findingId]: { kind: resolutionKind, por: null },
      }));
      setResolvidosNoServidor((atual) => new Set([...atual, findingId]));
      setEscrevendoRisco("");
      setFeedbackNotice("Desfecho registrado.");
    } catch (error) {
      setFeedbackNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o desfecho.",
      );
    } finally {
      setFeedbackSavingKey("");
    }
  }

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
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a avaliação.",
      );
    } finally {
      setFeedbackSavingKey("");
    }
  }

  /*
   * J / K PERCORREM A FILA, C / F JULGAM — os gestos que se repetem vinte vezes numa revisão, e
   * que pedia mirar "Próximo" a cada achado. É a convenção de leitor de fila
   * (e-mail, revisão de código). Calado enquanto se digita, com modificador
   * (Ctrl+K é a busca de ações) e com o visor do PDF aberto, que tem o seu
   * próprio anterior/próximo.
   *
   * DEPOIS de `saveFindingFeedback`, e não junto do detalhe: o efeito a chama,
   * e o React Compiler recusa uso antes da declaração (react-hooks/immutability).
   */
  useEffect(() => {
    if (view !== "findings" || activePdf) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const tecla = event.key.toLowerCase();
      if (!["j", "k", "c", "f"].includes(tecla)) return;
      const alvo = event.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='dialog']")) return;
      // C e F julgam o achado aberto (Validade). Reversível: o outro botão troca.
      if (tecla === "c" || tecla === "f") {
        if (!auditId || !achadoDoDetalhe?.refId || feedbackSavingKey === achadoDoDetalhe.refId) return;
        event.preventDefault();
        void saveFindingFeedback(
          achadoDoDetalhe,
          indiceDoDetalhe,
          tecla === "c" ? "CONFIRMED" : "FALSE_POSITIVE",
        );
        return;
      }
      const posicao = groupedPrincipal.findIndex((f) => chaveDoAchado(f) === chaveDoDetalhe);
      const destino = groupedPrincipal[posicao + (tecla === "j" ? 1 : -1)];
      if (!destino) return;
      event.preventDefault();
      abrirNoDetalhe(chaveDoAchado(destino));
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  });

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
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o erro ausente.",
      );
    } finally {
      setFeedbackSavingKey("");
    }
  }

  /*
   * O LINK DE UM ACHADO, copiado — G04. Mesmo contrato do e-mail e da home
   * (`lib/link-do-achado.ts`), com a origem desta janela. A confirmação vai no
   * pop, que é o canal de resultado desta tela; falha de área de transferência
   * (permissão negada) também aparece, e com o link para copiar à mão.
   */
  async function copiarLinkDoAchado(findingId: string) {
    if (!auditId) return;
    const link = linkDoAchado({ base: window.location.origin, auditId, findingId });
    try {
      await navigator.clipboard.writeText(link);
      setPop({ tom: "ok", texto: `Link do achado ${rotuloDoAchado(findingId)} copiado.` });
    } catch {
      setPop({ tom: "falha", texto: `Não deu para copiar. O link é: ${link}` });
    }
  }

  /*
   * `pagina` opcional: a fita de páginas manda o número EXATO em que clicaram.
   * Sem ela, o visor continua abrindo na primeira do achado, que é o que todo
   * o resto da tela faz — a fita é o único lugar que conhece as outras.
   */
  function openInlinePdf(finding: StructuredFinding, pagina?: number) {
    const resolvida = fonteDoAchado(finding);

    if (resolvida.tipo !== "arquivo") {
      return;
    }
    const source = resolvida.fonte;

    // Trocar de documento zera a régua: o número de páginas é do PDF, e o
    // próximo `onNumPages` é quem a reconstrói.
    setPaginasDoAberto((atual) => (source.url === activePdf?.url ? atual : 0));
    setActivePdf({
      url: source.url,
      page: pagina ?? getFirstPageNumber(finding.pagina) ?? 1,
      highlight: getHighlightNeedle(finding),
      label: finding.title,
      severity: finding.severity,
      arquivo: source.nome,
      criterio: resolvida.criterio,
      achado: chaveDoAchado(finding),
    });
  }

  /*
   * A SEQUÊNCIA DO VISOR (A10): os achados da fila FILTRADA que têm documento,
   * na ordem da fila. Anterior/próximo abrem o documento do vizinho sem fechar
   * o visor, preservam zoom e filtro, e levam o detalhe junto.
   */
  const sequenciaDoVisor = groupedPrincipal.filter((f) => Boolean(f.pdfUrl));
  const posicaoNoVisor = activePdf?.achado
    ? sequenciaDoVisor.findIndex((f) => chaveDoAchado(f) === activePdf.achado)
    : -1;
  function irNoVisor(delta: number) {
    const alvo = sequenciaDoVisor[posicaoNoVisor + delta];
    if (!alvo) return;
    setEscolhido(chaveDoAchado(alvo));
    openInlinePdf(alvo);
  }

  /*
   * A FONTE DO MOTOR NOVO, ligada de verdade (A03). `motorFonte` era prop sem
   * chamador: os cartões recebiam `hasRevision: () => false` e diziam "arquivo
   * indisponível" com o arquivo guardado. Agora a disponibilidade e a abertura
   * saem do MESMO catálogo do visor — revisão pelo hash; nome só sem hash.
   */
  const motorFonte = motorFonteDeFora ?? {
    hasRevision: (revisionId: string, fileName?: string) =>
      resolverFonte({ revisao: revisionId, arquivo: fileName }, catalogo).tipo === "arquivo",
    aoAbrir: (nav: {
      revisionId: string;
      fileName: string;
      page: number;
      highlight: string | null;
    }) => {
      const r = resolverFonte({ revisao: nav.revisionId, arquivo: nav.fileName }, catalogo);
      if (r.tipo !== "arquivo") {
        setPop({ tom: "falha", texto: r.frase });
        return;
      }
      setPaginasDoAberto((atual) => (r.fonte.url === activePdf?.url ? atual : 0));
      setActivePdf({
        url: r.fonte.url,
        page: nav.page,
        highlight: nav.highlight ?? undefined,
        label: nav.fileName,
        arquivo: r.fonte.nome,
        criterio: r.criterio,
        achado: chaveDoDetalhe,
      });
    },
  };

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
                  <p
                    className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
                    title={activePdf.arquivo}
                  >
                    {activePdf.arquivo ?? "PDF"} · página {activePdf.page}
                    {activePdf.criterio === "nome"
                      ? " · identificado pelo nome"
                      : activePdf.criterio === "revisao"
                        ? " · revisão auditada"
                        : ""}
                  </p>
                  {activePdf.label ? (
                    <p className="truncate text-xs text-foreground">
                      {activePdf.label}
                    </p>
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
              {posicaoNoVisor >= 0 ? (
                <div
                  className="flex items-center justify-between gap-2 border-b px-3 py-1.5"
                  data-sequencia-do-visor
                >
                  <span className="font-mono text-[11px] text-muted-foreground" aria-live="polite">
                    Achado {posicaoNoVisor + 1} de {sequenciaDoVisor.length}
                    {activePdf.achado && !activePdf.achado.startsWith("raw:") ? ` · ${activePdf.achado}` : ""}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={posicaoNoVisor <= 0}
                      onClick={() => irNoVisor(-1)}
                    >
                      <ChevronLeft aria-hidden />
                      Achado anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={posicaoNoVisor >= sequenciaDoVisor.length - 1}
                      onClick={() => irNoVisor(1)}
                    >
                      Próximo achado
                      <ChevronRight aria-hidden />
                    </Button>
                  </span>
                </div>
              ) : null}
              {/*
            A BARRA DE NAVEGAÇÃO DO DOCUMENTO.

            O visor abria a página do achado e o resto do documento não existia:
            os únicos destinos eram os pins da margem, um por achado. Medido num
            memorial de 12 páginas com 3 achados — NOVE PÁGINAS INALCANÇÁVEIS.
            E ler a página anterior é metade do trabalho de conferir um achado:
            um trecho contraditório quase sempre se explica no parágrafo de
            antes, que mora na folha de antes.

            O zoom pela mesma razão prática: a página inteira cabe na gaveta a
            520px, o que responde "onde está o trecho" e não responde "o que ele
            diz" — corpo 10 numa A4 reduzida a 87% é conferência a olho apertado.
          */}
              <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Página anterior"
                    disabled={activePdf.page <= 1}
                    onClick={() =>
                      setActivePdf((a) =>
                        a ? { ...a, page: Math.max(1, a.page - 1) } : a,
                      )
                    }
                    className="rounded-sm border p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  {/*
                Campo e não só setas: num memorial de 80 folhas, chegar à página
                47 com o botão de "próxima" é quarenta e seis cliques. O `form`
                existe para o Enter valer — é como se digita número de página em
                qualquer leitor, e sem ele o campo pareceria quebrado.
              */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const campo =
                        e.currentTarget.elements.namedItem("pagina");
                      const alvo = Number.parseInt(
                        campo instanceof HTMLInputElement ? campo.value : "",
                        10,
                      );
                      if (!Number.isFinite(alvo)) return;
                      const limite = paginasDoAberto || alvo;
                      setActivePdf((a) =>
                        a
                          ? { ...a, page: Math.min(Math.max(1, alvo), limite) }
                          : a,
                      );
                    }}
                    className="flex items-center gap-1"
                  >
                    {/*
                  `key` na página, e o campo é NÃO CONTROLADO de propósito. Ele
                  precisa mostrar a página atual quando ela muda por outro
                  caminho (as setas, um pin da margem) e, ao mesmo tempo, deixar
                  digitar "1" antes de "12" sem saltar para a folha 1 no meio da
                  digitação. Remontar quando a página muda resolve os dois sem um
                  efeito de sincronia — que é onde este tipo de campo costuma
                  ganhar um defeito de piscar.
                */}
                    <input
                      key={activePdf.page}
                      name="pagina"
                      defaultValue={String(activePdf.page)}
                      onFocus={(e) => e.currentTarget.select()}
                      inputMode="numeric"
                      aria-label="Ir para a página"
                      className="w-12 rounded-sm border bg-transparent px-1 py-0.5 text-center font-mono text-xs outline-none focus-visible:border-ring"
                    />
                  </form>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    de {paginasDoAberto || "?"}
                  </span>
                  <button
                    type="button"
                    aria-label="Próxima página"
                    disabled={
                      paginasDoAberto > 0 && activePdf.page >= paginasDoAberto
                    }
                    onClick={() =>
                      setActivePdf((a) =>
                        a
                          ? {
                              ...a,
                              page: Math.min(
                                paginasDoAberto || a.page + 1,
                                a.page + 1,
                              ),
                            }
                          : a,
                      )
                    }
                    className="rounded-sm border p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Diminuir zoom"
                    disabled={zoomDoPdf <= ZOOMS[0]}
                    onClick={() => setZoomDoPdf((z) => zoomAnterior(z))}
                    className="rounded-sm border p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  {/*
                O número é BOTÃO: clicar volta a 100%. É o gesto de desfazer de
                quem se perdeu no zoom, e ele não merece um controle próprio.
              */}
                  <button
                    type="button"
                    onClick={() => setZoomDoPdf(1)}
                    aria-label="Zoom de 100%"
                    className="min-w-12 rounded-sm px-1 py-0.5 text-center font-mono text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring"
                  >
                    {Math.round(zoomDoPdf * 100)}%
                  </button>
                  <button
                    type="button"
                    aria-label="Aumentar zoom"
                    disabled={zoomDoPdf >= ZOOMS[ZOOMS.length - 1]}
                    onClick={() => setZoomDoPdf((z) => zoomSeguinte(z))}
                    className="rounded-sm border p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring disabled:opacity-30"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
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
                    aria-label={`${plural(pinsDaMargem.length, "achado", "achados")} neste documento`}
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
                            setActivePdf((a) =>
                              a
                                ? {
                                    ...a,
                                    page: pin.page,
                                    severity: pin.severity,
                                  }
                                : a,
                            )
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
                    zoom={zoomDoPdf}
                    onNumPages={setPaginasDoAberto}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {/*
        O AVISO VEM ANTES DO VEREDITO E DE QUALQUER NÚMERO. Em 14/09/2026 o
        117_25 saiu com 10 achados só de regra e a contagem foi lida como o total.
        Ver [[lib/auditoria-incompleta.ts]].
      */}
      <AvisoDeAuditoriaIncompleta report={report} className="mb-3" />
      {/* No palco do Nexo o veredito mora no trilho da direita (Resultado E); aqui, só fora dele (gaveta do canvas). */}
      {verdict && !controlado ? (
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
          {/*
            SEM REPETIR O AVISO. Com a auditoria incompleta, o detalhe do
            veredito é "Pendências: <o título do aviso logo acima>" — a mesma
            frase duas vezes, em dois blocos âmbar empilhados, antes de qualquer
            achado. O aviso já explica; o veredito fica com o que só ele diz: a
            decisão e a obra.
          */}
          <p className="text-sm text-muted-foreground">
            {[
              report?.obra && report.obra !== "não identificada" ? report.obra : "",
              avisoCobreOVeredito ? "" : verdict.detail,
            ]
              .filter(Boolean)
              .join(" · ")}
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
          {/*
            A CONTAGEM PASSOU A SER A MESMA DO VEREDITO.

            Esta linha somava `findings.length` — sólidos MAIS sugestões da IA —
            enquanto a aba do palco (`PalcoDoNexo.tsx:224`), os três cartões de
            severidade e o próprio veredito contam só os sólidos. Na tela, lado a
            lado: "Achados 4" e "5 achados em 1 arquivo". Dois números para a
            mesma coisa, a 40px um do outro, num produto cuja proposta é contagem
            confiável.

            A soma era pior do que divergência de display: ela apresentava como
            achado uma sugestão que a validação REBAIXOU de propósito — a mesma
            que não acende o semáforo e mora na seção recolhível. Contar as duas
            juntas desfazia, no rótulo, a separação de duas camadas que o resto
            do arquivo constrói.

            As sugestões não sumiram do rótulo: ganharam o nome delas, e só
            aparecem quando existem.
          */}
          <span className="mt-1 block font-mono text-xs text-muted-foreground">
            {principalFindingsWithPdf.length} achado
            {principalFindingsWithPdf.length !== 1 ? "s" : ""} em{" "}
            {uniqueDocumentCount || pdfSources.length || "?"} arquivo
            {(uniqueDocumentCount || pdfSources.length) !== 1 ? "s" : ""}
            {openEngineFindings.length > 0
              ? ` · ${openEngineFindings.length} quest${openEngineFindings.length !== 1 ? "ões" : "ão"} em aberto`
              : ""}
            {suggestionFindings.length > 0
              ? ` · ${suggestionFindings.length} sugest${suggestionFindings.length !== 1 ? "ões" : "ão"} da IA`
              : ""}
            {elapsed ? ` · ${elapsed}` : ""}
            {report && incompletudeDoParecer(report).incompleta ? (
              <span className="font-semibold text-[var(--status-critical)]">
                {" "}· contagem INCOMPLETA
              </span>
            ) : null}
          </span>

          {!controlado && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-sm bg-[var(--nexodoc-recessed)] p-0.5">
                {[
                  { value: "summary" as const, label: "Resumo" },
                  { value: "findings" as const, label: "Achados" },
                  { value: "report" as const, label: "Relatório" },
                ].map((tab) => (
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
          {/*
            AVISAR OS ENVOLVIDOS — o fim da distribuição.

            Vive ao lado do EXPORTAR e não na barra de envio do rodapé, e a
            distância entre os dois é o desenho: a barra do rodapé é o gesto
            REPETIDO (marcar quatro achados, mandar para o Milton; marcar dois,
            mandar para a Carla), e este é o gesto ÚNICO que fecha a rodada.
            Colar o aviso na barra teria feito cada distribuição parcial
            perguntar "avisar agora?" — e a resposta certa é "não, ainda estou
            distribuindo", cinco vezes seguidas.

            SÓ EXISTE QUANDO HÁ ALGUÉM A AVISAR. Ver `pendentesDeAviso`.
          */}
          {pendentesDeAviso.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmandoAviso((aberto) => !aberto)}
              aria-expanded={confirmandoAviso}
            >
              <Mail />
              Notificar por e-mail ({pendentesDeAviso.length})
            </Button>
          ) : null}
          <Dropdown
            align="end"
            trigger={({ open, toggle }) => (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggle}
                aria-expanded={open}
              >
                <Download />
                Exportar
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            )}
          >
            {({ close }) => (
              <>
                {/*
                  PRIMEIRO DA LISTA, e acima dos "copiar".

                  Os outros itens entregam texto para colar noutro lugar; este
                  entrega a PEÇA. É o que sai do produto e chega à mesa do
                  fiscal, e por isso é o único do menu que vale o topo.

                  Só existe com parecer estruturado em mãos: sem `report` não há
                  achado, página nem evidência para imprimir, e um PDF com o
                  texto corrido da resposta seria o print de tela com outro
                  nome.
                */}
                {report ? (
                  <DropdownItem
                    onClick={() => {
                      setGerandoParecer(true);
                      void abrirParecerEmPdf(report)
                        .then((erro) => {
                          if (erro) setPop({ tom: "falha", texto: erro });
                        })
                        .finally(() => setGerandoParecer(false));
                      close();
                    }}
                  >
                    <FileText className="size-4" />
                    {gerandoParecer ? "Gerando o parecer…" : "Parecer em PDF"}
                  </DropdownItem>
                ) : null}
                <DropdownItem
                  onClick={() => {
                    // O texto GRAVADO de parecer antigo cita INC-xxx: sai com a sigla que se lê.
                    void navigator.clipboard.writeText(textoComRotulos(content));
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
                    downloadMarkdown(textoComRotulos(content));
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

      {/*
        O PAINEL DE CONFIRMAÇÃO — os nomes ANTES do envio.

        Em FLUXO, e não sobreposto. É a mesma escolha da barra de envio do
        rodapé, pelo mesmo motivo declarado lá: um diálogo por cima tira da
        vista justamente o que se precisa conferir. Aqui o que se confere são
        pessoas de verdade, e o custo de errar não é uma linha no banco — é um
        e-mail na caixa de alguém, que não volta.

        Por isso o botão do cabeçalho ABRE isto em vez de enviar. Um clique
        direto seria um controle irreversível a 8px do "Exportar".

        `.nx-elev` como pai e a forma chanfrada dentro: `box-shadow` morre no
        recorte, e elevação de painel vem de `drop-shadow` num pai não
        recortado (§5 da DESIGN.md — a mesma dívida que a barra de envio pagou).
      */}
      {confirmandoAviso && pendentesDeAviso.length > 0 ? (
        <div className="nx-elev mt-4">
          <div className="nx-cut-8 bg-card p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
              <span className="text-sm font-semibold normal-case tracking-normal text-foreground">
                {pendentesDeAviso.length}
              </span>{" "}
              {palavra(
                pendentesDeAviso.length,
                "pessoa será avisada",
                "pessoas serão avisadas",
              )}{" "}
              por e-mail
            </p>

            <ul className="mt-3 grid gap-1.5">
              {pendentesDeAviso.map((pessoa) => (
                <li
                  key={pessoa.email}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/50 pb-1.5 last:border-0"
                >
                  <span className="text-sm text-foreground">
                    {pessoa.nome}
                    {/*
                      QUEM NUNCA ENTROU FICA MARCADO, e é a informação mais
                      útil do painel. Para essa pessoa o e-mail não é cortesia:
                      é o único caminho pelo qual ela pode descobrir que existe
                      trabalho esperando por ela. Sem a marca, quem confirma não
                      tem como saber que está diante do caso que mais importa.
                    */}
                    {pessoa.convidado ? (
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                        convidado — ainda não entrou
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {plural(pessoa.quantidade, "achado", "achados")}
                  </span>
                </li>
              ))}
            </ul>

            {/*
              O QUE VAI NO E-MAIL, dito antes de sair. Quem aperta está mandando
              uma mensagem em nome do escritório, e tem direito de saber que ela
              não carrega o teor do memorial — é a diferença entre avisar um
              colega e encaminhar documento de cliente.
            */}
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              O e-mail leva a contagem, o projeto e o link para o parecer. O
              conteúdo dos achados não sai do sistema.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                loading={avisando}
                onClick={() => void avisarOsEnvolvidos()}
              >
                <Mail aria-hidden />
                Notificar {plural(pendentesDeAviso.length, "pessoa", "pessoas")} por e-mail
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmandoAviso(false)}
                aria-label="Cancelar a notificação por e-mail"
              >
                Cancelar
              </Button>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                {plural(achadosAAvisar, "achado", "achados")} no total
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        O RESULTADO DO ENVIO fica DEPOIS do painel e sobrevive a ele: o painel
        fecha quando o envio dá certo, e uma frase que sumisse junto não teria
        dito nada. É aqui que "o correio não está configurado" e "dois dos três
        não chegaram" aparecem.
      */}
      {avisoNotice ? (
        <p className="mt-3 font-mono text-xs leading-5 text-muted-foreground">
          {avisoNotice}
        </p>
      ) : null}

      {dualReview ? (
        <section className="mt-4 rounded-sm border border-primary/30 bg-primary/8 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--nexodoc-accent)]">
                Consenso de duas IAs
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground">
                O modelo principal encontrou candidatos e a segunda IA revisou a
                lista final antes da emissão do relatório.
              </p>
            </div>
            <div className="grid gap-2 text-xs sm:min-w-[260px]">
              <div className="flex items-center justify-between gap-3 rounded-sm border bg-card px-3 py-2">
                <span className="text-muted-foreground">Principal</span>
                <span className="font-mono text-foreground">
                  {runtime?.modelo_principal || "não informado"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-sm border bg-card px-3 py-2">
                <span className="text-muted-foreground">Segunda IA</span>
                <span className="font-mono text-foreground">
                  {runtime?.segunda_ia?.modelo ||
                    runtime?.modelo_validacao ||
                    "não informado"}
                </span>
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
              AS TRÊS FAIXAS, e não duas contagens.

              O resumo mostrava "Inconsistências críticas" e "Pontos de revisão"
              — DUAS caixas, enquanto a lista de achados sempre separou o parecer
              em TRÊS faixas. Quem lia o resumo e descia para a lista encontrava
              uma seção que o resumo não havia mencionado, e as contagens não
              fechavam com nada.

              São CONTAGEM, e não status: continuam sem cor de alarme, com uma
              exceção declarada — o bloqueador, que é o único que interrompe a
              entrega, e é a resposta à única pergunta que o resumo precisa
              responder ("dá para emitir hoje?").

              E cada faixa LEVA para a lista já filtrada: era informação sem
              saída, e a pessoa tinha que descer e refazer o filtro à mão.
            */}
            <div className="grid gap-2 sm:grid-cols-3">
              {IMPACT_SECTIONS.map((secao) => {
                const quantos = impactCount(secao.key);
                const bloqueia = secao.key === "critico_documental";

                return (
                  <button
                    key={secao.key}
                    type="button"
                    data-faixa-resumo={secao.key}
                    disabled={quantos === 0}
                    onClick={() => {
                      setImpactFilter(new Set([secao.key]));
                      setView("findings");
                    }}
                    className={cn(
                      "nx-cut-6 flex flex-col gap-1 bg-[var(--nexodoc-recessed)] p-4 text-left transition-colors",
                      quantos > 0
                        ? "cursor-pointer hover:bg-[var(--nexodoc-raised)]"
                        : "cursor-default opacity-60",
                    )}
                  >
                    <p
                      className={cn(
                        "font-mono text-[11px] font-semibold uppercase tracking-[0.1em]",
                        bloqueia && quantos > 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {secao.title}
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-semibold tabular-nums",
                        bloqueia && quantos > 0
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {quantos}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {secao.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            {/*
              REAUDITORIA: o que foi relido e o que veio de antes.

              O parecer sustenta uma decisão de emitir projeto. Um documento em
              que a maior parte dos capítulos não passou pelo modelo NESTA
              corrida é uma coisa diferente de um que passou — mesmo sendo, as
              duas, análises íntegras. Esconder a diferença seria afirmar um
              trabalho que não houve, que é exatamente o defeito que o bloco de
              "análise não completou" acima existe para não repetir.

              A ausência deste bloco significa leitura completa, nunca "não sei":
              `runtime.reauditoria` só é gravado quando houve reuso de verdade.
            */}
            {runtime?.reauditoria ? (
              <div className="nx-cut-6 bg-[var(--nexodoc-recessed)] p-4">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Reauditoria
                </p>
                <p className="mt-1.5 text-sm leading-6 text-foreground">
                  {plural(
                    runtime.reauditoria.capitulos_lidos,
                    "capítulo relido",
                    "capítulos relidos",
                  )}
                  {" nesta análise. "}
                  {plural(
                    runtime.reauditoria.capitulos_herdados,
                    "capítulo estava idêntico",
                    "capítulos estavam idênticos",
                  )}
                  {" ao parecer anterior, e "}
                  {plural(
                    runtime.reauditoria.achados_herdados,
                    "achado foi herdado",
                    "achados foram herdados",
                  )}
                  {"."}
                </p>
                {runtime.reauditoria.promovidos_sem_ancora.length > 0 ? (
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {plural(
                      runtime.reauditoria.promovidos_sem_ancora.length,
                      "capítulo foi relido",
                      "capítulos foram relidos",
                    )}{" "}
                    por não ter sido possível localizar os achados anteriores no
                    texto novo:{" "}
                    {runtime.reauditoria.promovidos_sem_ancora.join(", ")}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {/*
                O ARQUIVO VIRA FICHA, e deixa de ser uma linha com barras.
                `nome | tipo | 12 páginas | 48000 caracteres` obrigava a pessoa a
                separar quatro dados com o olho. Aqui o nome é o título, os
                números são etiquetas e o resumo é o parágrafo — a mesma
                informação, sem trabalho de leitura.
              */}
              <SectionCard title="Arquivos analisados" icon={FileText}>
                {report && report.arquivos_analisados.length > 0 ? (
                  <ul className="grid gap-3">
                    {report.arquivos_analisados.map((item, i) => (
                      <li
                        key={`${item.arquivo}-${i}`}
                        className="grid gap-1.5 border-b pb-3 last:border-0 last:pb-0"
                      >
                        <p className="font-mono text-sm text-foreground [overflow-wrap:anywhere]">
                          {item.arquivo}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant="secondary"
                            className="font-mono text-[11px]"
                          >
                            {item.tipo_documento}
                          </Badge>
                          {item.paginas ? (
                            <Badge
                              variant="secondary"
                              className="font-mono text-[11px]"
                            >
                              {item.paginas}{" "}
                              {item.paginas === 1 ? "página" : "páginas"}
                            </Badge>
                          ) : null}
                          {item.caracteres_extraidos ? (
                            <Badge
                              variant="secondary"
                              className="font-mono text-[11px]"
                            >
                              {item.caracteres_extraidos.toLocaleString(
                                "pt-BR",
                              )}{" "}
                              caracteres
                            </Badge>
                          ) : null}
                        </div>
                        {item.resumo ? (
                          <p className="text-sm leading-6 text-muted-foreground">
                            {item.resumo}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {parsed.files || "Sem informação específica."}
                  </p>
                )}
              </SectionCard>

              {/*
                COMPARAÇÃO É LISTA, e era um `pre` com hífens no começo da linha
                — um marcador desenhado à mão, que não quebra alinhado quando o
                texto passa de uma linha.
              */}
              <SectionCard title="Comparações" icon={LayoutList}>
                {report && report.comparacoes.length > 0 ? (
                  <ul className="grid gap-2">
                    {report.comparacoes.map((item, i) => (
                      <li
                        key={`${item.slice(0, 24)}-${i}`}
                        className="flex gap-2.5"
                      >
                        <span
                          aria-hidden
                          className="nx-cut-4 mt-2 size-1.5 shrink-0 bg-primary"
                        />
                        <span className="text-sm leading-6 text-foreground">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {parsed.comparisons || "Sem comparação específica."}
                  </p>
                )}
              </SectionCard>
            </div>

            {/*
              A CONCLUSÃO É PROSA, e `pre` a renderizava em bloco travado, com as
              quebras do modelo virando quebras de tela. Largura de leitura
              limitada: linha de 140 caracteres ninguém lê até o fim.
            */}
            <SectionCard title="Conclusão objetiva" icon={CheckCircle2}>
              <div className="grid max-w-[75ch] gap-3">
                {(
                  report?.conclusao ||
                  parsed.conclusion ||
                  "Sem conclusão identificada."
                )
                  .split(/\n{2,}/)
                  .map((paragrafo, i) => (
                    <p
                      key={`conclusao-${i}`}
                      className="text-sm leading-6 text-foreground"
                    >
                      {paragrafo.trim()}
                    </p>
                  ))}
              </div>
            </SectionCard>
          </>
        ) : null}

        {view === "findings" ? (
          <SectionCard title="Matriz de achados" icon={MapPin}>
            {/*
              O ACHADO PEDIDO QUE NÃO ESTÁ AQUI — auditoria UX/UI, G04.
              Um link antigo pode apontar para um achado que a reauditoria
              removeu. Sem esta faixa a lista abria sem destaque nenhum, e a
              pessoa não sabia se o link falhou ou se o achado sumiu.
            */}
            {achadoEmFoco && !findingsWithPdf.some((f) => f.refId === achadoEmFoco) ? (
              <p
                role="status"
                data-achado-ausente={achadoEmFoco}
                className="mb-4 nx-cut-6 bg-[var(--status-warning-bg)] px-3 py-2 text-sm leading-6 text-foreground"
              >
                O achado <span className="font-mono">{achadoEmFoco}</span> não está neste
                parecer — pode ter sido removido numa reauditoria. A auditoria inteira
                continua abaixo.
              </p>
            ) : null}
            {findings.length > 0 ? (
              <div className="space-y-4">
                {/*
                  COMO LER vira pergunta que se abre, e não parágrafo fixo. Era
                  um bloco de três linhas acima da fila em TODA visita — útil na
                  primeira, ruído da segunda em diante, e empurrava o primeiro
                  achado para baixo da dobra. O texto é o mesmo.
                */}
                <details className="group" data-como-ler>
                  <summary className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
                    <Info className="size-3.5" aria-hidden />
                    Como ler esta tela
                    <ChevronDown
                      className="size-3.5 transition-transform duration-[var(--duration-fast)] group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-2 max-w-[75ch] text-sm leading-6 text-foreground">
                    A fila resume cada achado: o que é, onde e com quem está.
                    O detalhe mostra a evidência primeiro, com a conversa e o
                    histórico em abas. <strong className="font-medium">Validade</strong>{" "}
                    diz se o achado está certo; <strong className="font-medium">Tratamento</strong>{" "}
                    diz o que foi feito na obra — um não implica o outro.
                  </p>
                </details>

                {/*
                  FILA + DETALHE — auditoria UX/UI, A07 (28/09/2026); coluna da
                  fila redesenhada na passada de 28/09 a partir da proposta do
                  Claude Design.

                  A fila carrega os PRÓPRIOS controles no topo — progresso,
                  busca, situação, filtros —, e o detalhe começa na altura da
                  fila em vez de embaixo de uma barra de largura inteira. Lado a
                  lado quando a coluna tem 52rem; abaixo disso, em sequência,
                  com "Voltar à lista". `@container` porque quem aperta é a
                  coluna (o palco do Nexo, o drawer), não a janela.
                */}
                <div className="@container">
                  <div className="grid items-start gap-5 @min-[52rem]:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
                    <nav
                      aria-label="Fila de achados"
                      data-fila-de-achados
                      className={cn(
                        "min-w-0 @min-[52rem]:sticky @min-[52rem]:top-2 @min-[52rem]:max-h-[calc(100dvh-6rem)] @min-[52rem]:overflow-y-auto",
                        vistaEstreita === "detalhe" && "hidden @min-[52rem]:block",
                      )}
                    >
                      <div
                        className="grid gap-2.5 bg-card pb-3 @min-[52rem]:sticky @min-[52rem]:top-0 @min-[52rem]:z-10"
                        data-organizar-fila
                      >
                        {/*
                          O PROGRESSO DA REVISÃO: quantos bloqueiam e quantos já
                          foram julgados. "Julgado" é ter Validade registrada —
                          é o trabalho que esta tela existe para fazer, e sem o
                          número ninguém sabe quanto falta.
                        */}
                        <div className="grid gap-1.5">
                          <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted-foreground">
                            {bloqueiamNaFila > 0 ? (
                              <span className="font-semibold text-destructive">
                                {bloqueiamNaFila} {bloqueiamNaFila === 1 ? "bloqueia" : "bloqueiam"}
                              </span>
                            ) : null}
                            <span data-julgados={julgadosNaFila}>
                              <span className="tabular-nums text-foreground">{julgadosNaFila}</span> de{" "}
                              {principalFindingsWithPdf.length} julgados
                            </span>
                          </p>
                          <div
                            aria-hidden
                            className="h-0.5 w-full overflow-hidden bg-[var(--nexodoc-recessed)]"
                          >
                            <div
                              className="h-full bg-[var(--nexodoc-accent)] transition-[width] duration-[var(--duration-base)]"
                              style={{
                                width: `${principalFindingsWithPdf.length ? (julgadosNaFila / principalFindingsWithPdf.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        <label htmlFor="busca-de-achados" className="sr-only">
                          Buscar achado
                        </label>
                        <Input
                          id="busca-de-achados"
                          type="search"
                          value={busca}
                          onChange={(event) => setBusca(event.target.value)}
                          placeholder="Buscar por texto, referência ou página"
                        />

                        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Situação">
                          {SITUACOES_DA_FILA.map((s) => (
                            <button
                              key={s.valor}
                              type="button"
                              data-filtro-situacao={s.valor}
                              aria-pressed={situacao === s.valor}
                              onClick={() => setSituacao(s.valor)}
                              className={cn(classeDoFiltro(situacao === s.valor), "min-h-7 px-2")}
                            >
                              {s.rotulo} <span className="tabular-nums opacity-80">{contagemDaSituacao(s.valor)}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            aria-expanded={mostrarRecortes}
                            aria-controls="recortes-da-fila"
                            onClick={() => {
                              if (recortesAtivos === 0) setRecortesAbertos((aberto) => !aberto);
                            }}
                            aria-disabled={recortesAtivos > 0 || undefined}
                            title={
                              recortesAtivos > 0
                                ? "Fica aberto enquanto houver filtro aplicado"
                                : "Responsável, ordem, gravidade, disciplina e tipo"
                            }
                            className={cn(classeDoFiltro(false), "min-h-7 px-2")}
                          >
                            <SlidersHorizontal className="size-3.5" aria-hidden />
                            Filtros e ordem
                            {recortesAtivos > 0 ? (
                              <span className="tabular-nums text-foreground">· {recortesAtivos}</span>
                            ) : null}
                            <ChevronDown
                              aria-hidden
                              className={cn(
                                "size-3.5 transition-transform duration-[var(--duration-fast)]",
                                mostrarRecortes && "rotate-180",
                              )}
                            />
                          </button>
                          {filtrosAtivos ? (
                            <button
                              type="button"
                              onClick={limparFiltros}
                              className={cn(classeDoFiltro(false), "min-h-7 px-2")}
                            >
                              <X className="size-3.5" aria-hidden />
                              Limpar filtros
                            </button>
                          ) : null}
                          {enviaveisDoFiltro.length > 0 ? (
                            <button
                              type="button"
                              onClick={alternarTodosDoFiltro}
                              aria-pressed={todosDoFiltroMarcados}
                              aria-label={
                                todosDoFiltroMarcados
                                  ? `Desmarcar os ${enviaveisDoFiltro.length} ${filtrosAtivos ? "filtrados" : "pendentes"}`
                                  : `Selecionar os ${enviaveisDoFiltro.length} ${filtrosAtivos ? "filtrados" : "pendentes"} para atribuir`
                              }
                              title={
                                todosDoFiltroMarcados
                                  ? `Desmarcar os ${enviaveisDoFiltro.length} ${filtrosAtivos ? "filtrados" : "pendentes"}`
                                  : `Selecionar os ${enviaveisDoFiltro.length} ${filtrosAtivos ? "filtrados" : "pendentes"} para atribuir`
                              }
                              className={cn(classeDoFiltro(todosDoFiltroMarcados), "ml-auto min-h-7 px-2")}
                            >
                              <ListChecks className="size-3.5" aria-hidden />
                              <span className="tabular-nums">{enviaveisDoFiltro.length}</span>
                            </button>
                          ) : null}
                        </div>

                        {mostrarRecortes ? (
                          <div
                            id="recortes-da-fila"
                            className="nx-cut-8 grid gap-2.5 bg-[var(--nexodoc-recessed)] p-2.5"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <label className="grid gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                                Responsável
                                <Select
                                  value={responsavelFiltro}
                                  onChange={(event) => setResponsavelFiltro(event.target.value)}
                                  selectClassName="normal-case tracking-normal text-foreground"
                                >
                                  <option value="">qualquer</option>
                                  {responsaveisPresentes.map((nome) => (
                                    <option key={nome} value={nome}>
                                      {nome}
                                    </option>
                                  ))}
                                </Select>
                              </label>
                              <label className="grid gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                                Ordem
                                <Select
                                  value={ordem}
                                  onChange={(event) => setOrdem(event.target.value as OrdemDaFila)}
                                  selectClassName="normal-case tracking-normal text-foreground"
                                >
                                  <option value="impacto">por impacto</option>
                                  <option value="pagina">por página</option>
                                  <option value="documento">por documento</option>
                                  <option value="referencia">por referência</option>
                                </Select>
                              </label>
                            </div>
                            {presentImpacts.length > 1 || impactFilter.size > 0 ? (
                              <div className="grid gap-1">
                                <span className={ROTULO_DA_LINHA_DE_FILTRO}>Gravidade</span>
                                <div className="flex flex-wrap gap-1">
                                  {presentImpacts.map((impact) => (
                                    <button
                                      key={impact}
                                      type="button"
                                      data-filtro-gravidade={impact}
                                      aria-pressed={impactFilter.has(impact)}
                                      onClick={() =>
                                        setImpactFilter((current) =>
                                          toggleFrom(current, impact),
                                        )
                                      }
                                      className={cn(classeDoFiltro(impactFilter.has(impact), true), "min-h-7 px-2")}
                                    >
                                      {getImpactLabel(impact)} ({impactCount(impact)})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {presentDisciplines.length > 1 ? (
                              <div className="grid gap-1">
                                <span className={ROTULO_DA_LINHA_DE_FILTRO}>Disciplina</span>
                                <div className="flex flex-wrap gap-1">
                                  {presentDisciplines.map((discipline) => (
                                    <button
                                      key={discipline}
                                      type="button"
                                      aria-pressed={disciplineFilter.has(discipline)}
                                      onClick={() =>
                                        setDisciplineFilter((current) =>
                                          toggleFrom(current, discipline),
                                        )
                                      }
                                      className={cn(classeDoFiltro(disciplineFilter.has(discipline), true), "min-h-7 px-2")}
                                    >
                                      {getDisciplineLabel(discipline)} ({disciplineCount(discipline)})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {presentErrorTypes.length > 1 ? (
                              <div className="grid gap-1">
                                <span className={ROTULO_DA_LINHA_DE_FILTRO}>Tipo</span>
                                <div className="flex flex-wrap gap-1">
                                  {presentErrorTypes.map((type) => (
                                    <button
                                      key={type}
                                      type="button"
                                      aria-pressed={errorTypeFilter.has(type)}
                                      onClick={() =>
                                        setErrorTypeFilter((current) =>
                                          toggleFrom(current, type),
                                        )
                                      }
                                      className={cn(classeDoFiltro(errorTypeFilter.has(type), true), "min-h-7 px-2")}
                                    >
                                      {getErrorTypeLabel(type)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <p
                          className="font-mono text-[11px] text-muted-foreground"
                          aria-live="polite"
                          data-mostrando={groupedPrincipal.length}
                        >
                          Mostrando {groupedPrincipal.length} de{" "}
                          {plural(principalFindingsWithPdf.length, "achado", "achados")}
                        </p>
                      </div>

                      {groupedPrincipal.length === 0 ? (
                        <EmptyState
                          description="Nenhum achado com os filtros selecionados."
                          className="py-8"
                        />
                      ) : null}
                      <ol className="m-0 grid list-none gap-0.5 p-0">
                        {groupedPrincipal.map((finding, index) => {
                          const faixa = findingImpactBucket(finding);
                          const secao = IMPACT_SECTIONS.find((item) => item.key === faixa);
                          const cabecalho =
                            ordem === "impacto" &&
                            (index === 0 || findingImpactBucket(groupedPrincipal[index - 1]) !== faixa);
                          const recolhida = ordem === "impacto" && faixasRecolhidas.has(faixa);
                          const chave = chaveDoAchado(finding);
                          const atual = chave === chaveDoDetalhe;
                          const paginas = paginasDoAchado({
                            pagina: finding.pagina,
                            referencia: finding.referencia,
                          });
                          const comentarios = finding.refId ? comentariosPorAchado[finding.refId] ?? 0 : 0;
                          const julgado = Boolean(finding.refId && feedbackByFinding[finding.refId]);
                          const status = statusCurto(finding);
                          const daFaixa = cabecalho
                            ? groupedPrincipal.filter((f) => findingImpactBucket(f) === faixa)
                            : [];
                          return (
                            <Fragment key={`${chave}-fila`}>
                              {cabecalho && secao ? (
                                /*
                                  O GRUPO SE RECOLHE. Rótulo + fio, e não tarja
                                  lateral (proibida, DESIGN.md §4); a cor do
                                  bloqueador fica no texto. "x/y julgados" diz o
                                  quanto da faixa já passou pela Validade.
                                */
                                <li data-faixa={faixa} className="mt-3 first:mt-0">
                                  <button
                                    type="button"
                                    aria-expanded={!recolhida}
                                    onClick={() =>
                                      setFaixasRecolhidas((atuais) => {
                                        const nova = new Set(atuais);
                                        if (nova.has(faixa)) nova.delete(faixa);
                                        else nova.add(faixa);
                                        return nova;
                                      })
                                    }
                                    title={secao.hint}
                                    className="flex w-full items-center gap-1.5 py-1 text-left font-mono text-[11px] uppercase tracking-wider outline-none focus-visible:underline"
                                  >
                                    <ChevronDown
                                      aria-hidden
                                      className={cn(
                                        "size-3.5 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-fast)]",
                                        recolhida && "-rotate-90",
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "font-semibold",
                                        faixa === "critico_documental"
                                          ? "text-destructive"
                                          : faixa === "risco_de_execucao" || faixa === "tecnico_contratual"
                                            ? "text-[var(--status-warning)]"
                                            : "text-muted-foreground",
                                      )}
                                    >
                                      {secao.title}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">{daFaixa.length}</span>
                                    <span className="ml-auto normal-case tracking-normal text-muted-foreground">
                                      {
                                        daFaixa.filter((f) => f.refId && feedbackByFinding[f.refId]).length
                                      }
                                      /{daFaixa.length} julgados
                                    </span>
                                  </button>
                                </li>
                              ) : null}
                              {recolhida ? null : (
                              <li
                                data-item-da-fila={finding.refId || chave}
                                data-impacto={faixa}
                                data-atual={atual || undefined}
                                data-pagina={getFirstPageNumber(finding.pagina) ?? undefined}
                                className={cn(
                                  "group/item nx-edge-6 flex items-start gap-2 px-2 py-2",
                                  atual
                                    ? "[--nx-edge:var(--ring)] [--nx-fill:var(--nexodoc-raised)]"
                                    : "[--nx-edge:transparent] [--nx-fill:var(--card)] hover:[--nx-fill:var(--nexodoc-raised)]",
                                )}
                              >
                                {/*
                                  A CAIXA DE SELEÇÃO APARECE QUANDO SERVE: ao
                                  passar o ponteiro, no foco do teclado, ou
                                  quando já há seleção em curso. Continua no
                                  Tab — opacidade não tira do teclado.
                                */}
                                {finding.refId && !estaResolvido(finding.refId) ? (
                                  <input
                                    type="checkbox"
                                    checked={selecionados.has(finding.refId)}
                                    onChange={() => alternarSelecao(finding.refId!)}
                                    aria-label={`Selecionar ${rotuloDoAchado(finding.refId)} para atribuir`}
                                    className={cn(
                                      "mt-0.5 size-4 shrink-0 accent-primary transition-opacity",
                                      selecionados.size > 0
                                        ? "opacity-100"
                                        : "opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100",
                                    )}
                                  />
                                ) : (
                                  <span aria-hidden className="w-4 shrink-0" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => abrirNoDetalhe(chave)}
                                  aria-current={atual ? "true" : undefined}
                                  className="min-w-0 flex-1 text-left outline-none"
                                >
                                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                                    {/*
                                      O LOSANGO: cor = severidade; cheio =
                                      julgado, vazado = ainda sem Validade.
                                    */}
                                    <span
                                      aria-hidden
                                      className="inline-block size-1.5 shrink-0 rotate-45 border"
                                      style={{
                                        borderColor: COR_DO_PIN[finding.severity],
                                        background: julgado ? COR_DO_PIN[finding.severity] : "transparent",
                                      }}
                                    />
                                    <span className="text-foreground">{rotuloDoAchado(finding.refId) ?? `Achado ${index + 1}`}</span>
                                    {/* Agrupada por impacto, a faixa já está no cabeçalho do grupo. */}
                                    {ordem !== "impacto" ? <span className="truncate">· {getImpactLabel(faixa)}</span> : null}
                                    <span className="shrink-0">{rotuloDePaginas(paginas, finding.pagina)}</span>
                                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                                      {comentarios > 0 ? (
                                        <span
                                          className="inline-flex items-center gap-0.5"
                                          title={plural(comentarios, "comentário", "comentários")}
                                        >
                                          <MessageSquare className="size-3" aria-hidden />
                                          <span className="tabular-nums">{comentarios}</span>
                                          <span className="sr-only">{comentarios === 1 ? "comentário" : "comentários"}</span>
                                        </span>
                                      ) : null}
                                      {status ? (
                                        <span
                                          className={cn(
                                            "max-w-[8rem] truncate uppercase tracking-wider",
                                            status.tom === "seu" && "text-[var(--status-warning)]",
                                            status.tom === "ok" && "text-[var(--status-ok)]",
                                            status.tom === "descartado" && "line-through",
                                          )}
                                          title={situacaoLegivel(finding)}
                                        >
                                          {status.texto}
                                        </span>
                                      ) : null}
                                    </span>
                                  </span>
                                  <span
                                    className={cn(
                                      "mt-1 block text-sm leading-5 [overflow-wrap:anywhere]",
                                      estaResolvido(finding.refId)
                                        ? "text-muted-foreground line-through decoration-[var(--status-ok)]/60"
                                        : "text-foreground",
                                    )}
                                  >
                                    {finding.title}
                                  </span>
                                  {/* A frase inteira, para leitor de tela e para quem busca por ela. */}
                                  <span data-situacao-do-item className="sr-only">
                                    {situacaoLegivel(finding)}
                                  </span>
                                </button>
                              </li>
                              )}
                            </Fragment>
                          );
                        })}
                      </ol>
                    </nav>

                    <div
                      data-detalhe-do-achado
                      className={cn("min-w-0", vistaEstreita === "lista" && "hidden @min-[52rem]:block")}
                    >
                      {(() => {
                        const finding = achadoDoDetalhe;
                        if (!finding) return null;
                        const index = indiceDoDetalhe;
                        const disciplina = findingDiscipline(finding);
                        const paginas = paginasDoAchado({
                          pagina: finding.pagina,
                          referencia: finding.referencia,
                        });
                        const faixa = findingImpactBucket(finding);
                        const posicao = groupedPrincipal.findIndex((f) => chaveDoAchado(f) === chaveDoDetalhe);
                        const comentarios = finding.refId ? comentariosPorAchado[finding.refId] ?? 0 : 0;
                        const registro = finding.refId ? historicoPorAchado[finding.refId] : undefined;
                        // A mesma página que `openInlinePdf` abre sem argumento.
                        const paginaDaEvidencia = getFirstPageNumber(finding.pagina);
                        return (
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="@min-[52rem]:hidden"
                                onClick={() => setVistaEstreita("lista")}
                              >
                                <ChevronLeft aria-hidden />
                                Voltar à lista
                              </Button>
                              {/*
                                ONDE ESTOU: a faixa do achado e a posição na fila.
                                A faixa na cor dela, como no cabeçalho do grupo.
                              */}
                              <span
                                className={cn(
                                  "font-mono text-[11px] font-semibold uppercase tracking-wider",
                                  faixa === "critico_documental"
                                    ? "text-destructive"
                                    : faixa === "risco_de_execucao" || faixa === "tecnico_contratual"
                                      ? "text-[var(--status-warning)]"
                                      : "text-muted-foreground",
                                )}
                              >
                                {IMPACT_SECTIONS.find((s) => s.key === faixa)?.title}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground" data-posicao-do-achado>
                                {posicao >= 0
                                  ? `Achado ${posicao + 1} de ${groupedPrincipal.length}`
                                  : "Fora da lista filtrada"}
                              </span>
                              <span className="ml-auto flex items-center gap-1">
                                <span
                                  aria-hidden
                                  className="mr-1 hidden font-mono text-[11px] text-muted-foreground @min-[52rem]:inline"
                                >
                                  K / J
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="w-8 px-0"
                                  disabled={posicao <= 0}
                                  onClick={() => abrirNoDetalhe(chaveDoAchado(groupedPrincipal[posicao - 1]))}
                                  aria-label="Anterior"
                                  aria-keyshortcuts="K"
                                  title="Achado anterior (K)"
                                >
                                  <ChevronLeft aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="w-8 px-0"
                                  disabled={posicao < 0 || posicao >= groupedPrincipal.length - 1}
                                  onClick={() => abrirNoDetalhe(chaveDoAchado(groupedPrincipal[posicao + 1]))}
                                  aria-label="Próximo"
                                  aria-keyshortcuts="J"
                                  title="Próximo achado (J)"
                                >
                                  <ChevronRight aria-hidden />
                                </Button>
                              </span>
                            </div>
                        <article
                          // Faixa no DOM: é o que permite provar a ORDEM da lista no
                          // navegador sem depender do texto do cabeçalho.
                          data-impacto={faixa}
                          // A âncora do achado: é por ela que o clique no canvas
                          // encontra este cartão para rolar até ele.
                          data-achado={finding.refId || undefined}
                          data-em-foco={
                            finding.refId && finding.refId === achadoEmFoco
                              ? ""
                              : undefined
                          }
                          data-resolvido={
                            estaResolvido(finding.refId) || undefined
                          }
                          onPointerMove={moverLuz}
                          className={cn(
                            /*
                             * SEM `overflow-hidden`, e a razão MUDOU (21/08/2026).
                             *
                             * Era pelo menu de ações: filho daqui, o recorte o
                             * cortava INDEPENDENTEMENTE da posição na janela, porque
                             * o cartão é mais curto que o menu. Isso deixou de valer
                             * — o `Dropdown` agora vai para o `<body>` por portal.
                             *
                             * A regra fica assim mesmo, porque a alternativa não
                             * ganha nada: o arredondamento que o `overflow` garantiria
                             * já é do cabeçalho, que é o único filho com fundo próprio
                             * encostando na borda. Pôr `overflow-hidden` de volta
                             * seria criar um contêiner de rolagem por nada.
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
                            /*
                             * `nx-spot`: a luz que segue o ponteiro. Só o cartão do
                             * achado a recebe nesta tela — é a superfície que a
                             * pessoa percorre uma a uma numa revisão, e é onde a
                             * reação sob o cursor vira sensação de material. Pôr o
                             * mesmo brilho em toda caixa da tela transformaria luz
                             * em ruído, e o §5 já diz que movimento é mudança de
                             * estado, não decoração distribuída.
                             */
                            /*
                             * O ÚNICO `rounded-md` QUE FICA, e agora por UM motivo só.
                             *
                             * Eram dois. O `Dropdown` de ações era filho daqui e não
                             * era portalizado — isso caiu: o primitivo agora vai para
                             * o `<body>`, e o menu deixou de depender da geometria
                             * deste cartão.
                             *
                             * O que sobrou é o REALCE VINDO DO CANVAS
                             * (`data-[em-foco]:ring-2 ring-offset-2`): `outline` e
                             * `box-shadow` externo são cortados pelo `clip-path`, e o
                             * cartão ficaria sem a marca que faz quem clica no canvas
                             * se achar no meio de 45 iguais. Recortar exige primeiro
                             * trocar esse realce por um que viva POR DENTRO — decisão
                             * de afordância, não de geometria, e por isso não entra
                             * junto.
                             */
                            "@container nx-spot relative rounded-md border bg-card transition-colors duration-[var(--duration-base)] ease-[var(--ease-feedback)]",
                            estaResolvido(finding.refId)
                              ? "border-[var(--status-ok)]/40 bg-[var(--status-ok-bg)]/40"
                              : "",
                            /*
                             * MARCADO COMO FALSO POSITIVO: o cartão inteiro fica
                             * âmbar.
                             *
                             * A tarja sozinha não bastava. Quem revisa 45 achados
                             * rola a lista de cima a baixo várias vezes, e o que
                             * ele precisa responder a cada passada é "este eu já
                             * descartei?" — uma etiqueta de 11px no meio do
                             * cabeçalho não responde isso de relance. A cor do
                             * cartão responde.
                             *
                             * DEPOIS do resolvido na ordem das classes, e de
                             * propósito: um achado pode estar marcado como
                             * corrigido E depois ser julgado falso positivo, e aí é
                             * o julgamento que manda. `cn` faz a última vencer.
                             */
                            finding.refId &&
                              feedbackByFinding[finding.refId] ===
                                "FALSE_POSITIVE"
                              ? "border-[var(--status-warning)]/50 bg-[var(--status-warning-bg)]"
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
                          {/*
                        O SINAL DE CUIDADO TOMANDO O CARTÃO, em transparência.
                        Marca-d'água, não ícone: ele não informa nada que a cor
                        já não informe — ele dá ao estado um PESO que a cor
                        sozinha não tem, e some da leitura assim que o olho
                        passa para o texto.

                        `pointer-events-none` porque o cartão continua
                        interativo por baixo: o achado descartado ainda se abre,
                        ainda rola, e o julgamento ainda se desfaz.
                        `aria-hidden` porque a tarja de veredito, logo abaixo,
                        já diz isto em texto — para o leitor de tela o selo
                        seria a mesma frase repetida.
                      */}
                          {finding.refId &&
                          feedbackByFinding[finding.refId] ===
                            "FALSE_POSITIVE" ? (
                            <div
                              aria-hidden
                              data-selo-de-cuidado=""
                              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-md"
                            >
                              <AlertTriangle
                                /*
                              A ALTURA É DO CARTÃO, não um número fixo. `max-h-40`
                              dava um triângulo de 160px num cartão de 775 — um
                              ícone grande no meio, não uma marca-d'água. O
                              `max-w` existe porque o glifo é quadrado: num
                              cartão alto e estreito é a LARGURA que estoura
                              primeiro, e sem o teto ele vazaria pelas laterais.
                            */
                                className="h-[65%] w-auto max-w-[60%] text-[var(--status-warning)] opacity-[0.10]"
                                strokeWidth={1.25}
                              />
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-start gap-4 border-b px-4 pb-3 pt-4">
                            <div className="min-w-0 flex-1">
                              <h4
                                className={cn(
                                  "mb-2 max-w-[60ch] text-lg font-semibold leading-7 tracking-[-0.01em] text-balance transition-colors",
                                  estaResolvido(finding.refId)
                                    ? "text-muted-foreground line-through decoration-[var(--status-ok)]/60"
                                    : "text-foreground",
                                )}
                              >
                                {finding.title}
                              </h4>
                              {/*
                                A IDENTIDADE DO ACHADO EM UMA LINHA DE DADO.
                                Eram oito etiquetas do mesmo peso: "Achado 2"
                                (repetindo o "Achado 2 de 9" da navegação),
                                "Ref. INC-002", disciplina e tipo ao lado da
                                gravidade e de "com Milton". Referência,
                                disciplina e tipo DIZEM O QUE O ACHADO É; as
                                etiquetas abaixo dizem EM QUE PÉ ELE ESTÁ. A
                                disciplina mantém a cor da escala (a mesma do
                                canvas), agora no texto.
                              */}
                              <p className="mb-2.5 flex flex-wrap items-center gap-x-1.5 font-mono text-xs text-muted-foreground">
                                {finding.refId ? (
                                  <span className="text-foreground">{rotuloDoAchado(finding.refId)}</span>
                                ) : (
                                  <span className="text-foreground">Achado {index + 1}</span>
                                )}
                                <span aria-hidden>·</span>
                                <span
                                  style={
                                    corDaDisciplina(disciplina)
                                      ? { color: corDaDisciplina(disciplina) as string }
                                      : undefined
                                  }
                                >
                                  {getDisciplineLabel(disciplina)}
                                </span>
                                {getErrorTypeLabel(findingErrorType(finding)).toLowerCase() !==
                                (finding.title ?? "").trim().toLowerCase() ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{getErrorTypeLabel(findingErrorType(finding))}</span>
                                  </>
                                ) : null}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {/*
                              O MOTIVO DA SEVERIDADE VIAJA COM A ETIQUETA.

                              A faixa é derivada de consequência × certeza
                              (`lib/severidade.ts`), e um critério que ninguém
                              consegue ler é um critério que ninguém consegue
                              contestar — foi assim que quatro regras de calar
                              sobreviveram até agosto. A frase fica no `title`
                              porque ela explica uma decisão já tomada: quem
                              concorda não precisa lê-la, e quem estranha a
                              alcança sem sair do cartão.
                            */}
                                <Badge
                                  variant={finding.impacto ? getImpactVariant(finding.impacto) : getSeverityVariant(finding.severity)}
                                  title={finding.severityReason}
                                  data-motivo-severidade={
                                    finding.severityReason || undefined
                                  }
                                  className={
                                    finding.severityReason
                                      ? "cursor-help"
                                      : undefined
                                  }
                                >
                                  {finding.impacto
                                    ? getImpactLabel(finding.impacto)
                                    : getSeverityLabel(finding.severity)}
                                </Badge>
                                {/*
                              O GLIFO VIROU ÍCONE. Era "✔ Verificado" e "◻
                              Sugerido" — dois caracteres de texto fazendo trabalho
                              de ícone, e o ◻ não simbolizava nada: era enchimento
                              para as duas etiquetas ficarem do mesmo tamanho.
                              `lucide` é a única iconografia do sistema (§7), e o
                              que não significa nada sai em vez de virar ícone.
                            */}
                                <Badge
                                  variant={
                                    finding.origem === "regra"
                                      ? "ok"
                                      : "secondary"
                                  }
                                  title={finding.assurance}
                                >
                                  {finding.origem === "regra" ? (
                                    <>
                                      <Check aria-hidden />
                                      Verificado
                                    </>
                                  ) : (
                                    "Sugerido"
                                  )}
                                </Badge>
                                {/*
                              HERDADO: este achado não nasceu nesta corrida.

                              Veio do parecer anterior, de um capítulo byte a
                              byte idêntico, com a página reancorada para o
                              documento novo. Quem confere um parecer precisa
                              poder distinguir o que o modelo acabou de ler do
                              que foi carregado de antes — e a data é o que
                              permite ir buscar a corrida de origem.
                            */}
                                {finding.herdado_de ? (
                                  <Badge
                                    variant="secondary"
                                    title={`Herdado da auditoria de ${finding.herdado_de.quando}: o capítulo não mudou desde lá.`}
                                  >
                                    herdado · {finding.herdado_de.quando}
                                  </Badge>
                                ) : null}
                                {/*
                              COM QUEM ESTÁ. Aparece enquanto o achado é
                              pendência de alguém, e sai quando ele fecha —
                              trocado pela tarja do desfecho, logo abaixo.

                              DUAS TARJAS, E NÃO UMA COM TEXTO TROCADO. "com
                              Milton" e "com você" respondem a perguntas
                              diferentes, e agora a cor diz qual é qual pelo
                              vocabulário do sistema (§2) em vez de por peso:

                               · ÂMBAR é Atenção — algo espera ação de quem lê.
                                 É o que "com você" quer dizer, e é o único
                                 sentido de âmbar no produto;
                               · AZUL é `--signal-info`, o contexto que o sistema
                                 oferece sem pedir nada. "com Milton" é
                                 exatamente isso: notícia sobre um terceiro.

                              A primeira versão pintou "com você" de TEAL SÓLIDO,
                              e estava errada: teal é o acento do interativo, e a
                              regra do acento único proíbe usá-lo em status. Pior,
                              ficava irmã da etiqueta de disciplina, que também
                              era teal — o defeito que a troca acima resolve.

                              A INVERSÃO É O PONTO. Antes, TODA tarja era âmbar,
                              e o âmbar não distinguia "é seu" de "é de alguém".
                              Trocar o alheio para azul devolve o âmbar ao seu
                              trabalho: num parecer de 45 achados, o que é seu é
                              a única coisa alaranjada da fila.
                            */}
                                {finding.refId &&
                                atribuidoPor[finding.refId] ? (
                                  atribuidoPor[finding.refId].souEu ? (
                                    <Badge variant="warning">com você</Badge>
                                  ) : (
                                    <Badge variant="info">
                                      com {atribuidoPor[finding.refId].nome}
                                    </Badge>
                                  )
                                ) : null}
                                {/*
                              O DESFECHO FICA, e é a tarja que mais importa para
                              quem NÃO está com o achado.

                              É aqui que quem enviou descobre o que aconteceu:
                              não existe lista "enviados por mim" em lugar
                              nenhum, de propósito. Se a tarja de "com fulano"
                              apenas sumisse ao resolver, quem delegou ficaria
                              sem resposta e perguntaria por fora do sistema.
                            */}
                                {finding.refId &&
                                desfechoPorAchado[finding.refId] ? (
                                  <Badge variant="ok">
                                    {
                                      DESFECHO_LABEL[
                                        desfechoPorAchado[finding.refId].kind
                                      ]
                                    }
                                    {desfechoPorAchado[finding.refId].por
                                      ? ` · ${desfechoPorAchado[finding.refId].por}`
                                      : ""}
                                  </Badge>
                                ) : null}
                                {/*
                              O VEREDITO, quando já houver um.

                              Ele era gravado e só reaparecia como um botão
                              aceso lá embaixo, dentro do bloco de avaliação —
                              e quem rolava a lista relia como pendente um
                              achado que já tinha julgado falso positivo. A
                              etiqueta fica junto das outras porque a pergunta
                              "isto ainda me diz respeito?" se responde no
                              cabeçalho, antes de abrir o cartão.

                              "Corrigido" NÃO entra aqui: ele já se anuncia no
                              risco do título e na moldura verde, e repetir a
                              mesma informação numa terceira marca só rouba
                              espaço das que não têm outro lugar.
                            */}
                                {finding.refId &&
                                feedbackByFinding[finding.refId] ? (
                                  <Badge
                                    data-veredito={
                                      feedbackByFinding[finding.refId]
                                    }
                                    variant={
                                      feedbackByFinding[finding.refId] ===
                                      "FALSE_POSITIVE"
                                        ? "secondary"
                                        : "ok"
                                    }
                                    /*
                                  O RISCO FICA no falso positivo: ele diz que a
                                  etiqueta ao lado (a faixa de severidade) foi
                                  RECUSADA, e nenhuma cor sozinha diz isso — um
                                  cinza quieto lê como "sem informação", que é o
                                  oposto de "alguém julgou e discordou".
                                */
                                    className={
                                      feedbackByFinding[finding.refId] ===
                                      "FALSE_POSITIVE"
                                        ? "line-through"
                                        : undefined
                                    }
                                  >
                                    {
                                      VEREDITO_LABEL[
                                        feedbackByFinding[finding.refId]
                                      ]
                                    }
                                  </Badge>
                                ) : null}
                            {/*
                          "4 PÁGINAS" NO LUGAR DE "PÁGINA 8".

                          É a mudança mais barata desta tela e a que mais muda o
                          comportamento de quem lê: avisa, ANTES de qualquer
                          texto, que corrigir um lugar não encerra o assunto. As
                          outras páginas já eram calculadas pelas regras e
                          morriam num `||` — ver [[../lib/paginas-do-achado]].

                          Achado de um lugar só continua dizendo "página 8", em
                          cinza: sem isso, 90% dos cartões ganhariam um enfeite.
                        */}
                            <Badge
                              variant={
                                ehMultiPagina(paginas) ? "ok" : "secondary"
                              }
                              className="gap-1.5 font-mono text-xs"
                            >
                              <FileText className="size-3.5" />
                              {rotuloDePaginas(paginas, finding.pagina)}
                            </Badge>
                              </div>
                            </div>

                          </div>

                          {/*
                            AS ABAS DO DETALHE — Evidência, Conversa (n), Histórico.
                            A conversa só carrega quando a aba abre (A08): a fila
                            mostra a contagem que vem do feedback, e 100 achados
                            não disparam 100 conversas.
                          */}
                          <div
                            role="tablist"
                            aria-label="Partes do achado"
                            className="relative z-20 flex gap-1 border-b px-4 pt-2"
                            onKeyDown={(event) => {
                              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                              const ordemDasAbas: AbaDoDetalhe[] = ["evidencia", "conversa", "historico"];
                              // A partir da aba FOCADA, não da selecionada (padrão ARIA de abas).
                              const focada = (event.target as HTMLElement).id.replace("aba-", "") as AbaDoDetalhe;
                              const i = Math.max(0, ordemDasAbas.indexOf(focada));
                              const proxima =
                                ordemDasAbas[(i + (event.key === "ArrowRight" ? 1 : 2)) % 3];
                              setAbaDoDetalhe(proxima);
                              queueMicrotask(() =>
                                document.getElementById(`aba-${proxima}`)?.focus(),
                              );
                            }}
                          >
                            {(
                              [
                                { valor: "evidencia", rotulo: "Evidência" },
                                {
                                  valor: "conversa",
                                  rotulo: `Conversa (${comentarios})`,
                                },
                                { valor: "historico", rotulo: "Histórico" },
                              ] as { valor: AbaDoDetalhe; rotulo: string }[]
                            ).map((aba) => (
                              <button
                                key={aba.valor}
                                id={`aba-${aba.valor}`}
                                type="button"
                                role="tab"
                                aria-selected={abaDoDetalhe === aba.valor}
                                aria-controls={`painel-${aba.valor}`}
                                tabIndex={abaDoDetalhe === aba.valor ? 0 : -1}
                                onClick={() => setAbaDoDetalhe(aba.valor)}
                                className={cn(
                                  "-mb-px border-b-2 px-3 py-1.5 font-mono text-xs outline-none transition-colors focus-visible:text-foreground",
                                  abaDoDetalhe === aba.valor
                                    ? "border-[var(--ring)] text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {aba.rotulo}
                              </button>
                            ))}
                          </div>

                          <div
                            id={`painel-${abaDoDetalhe}`}
                            role="tabpanel"
                            aria-labelledby={`aba-${abaDoDetalhe}`}
                            className="relative z-20"
                          >
                            {abaDoDetalhe === "evidencia" ? (
                              <>
                          {/*
                        A EXPLICAÇÃO OCUPA A COLUNA LARGA, e os metadados vão
                        para a lateral. Era o contrário: `Documento / Página /
                        Local / Categoria` ficavam na coluna da esquerda e o
                        texto que a pessoa precisa LER ficava espremido à
                        direita. Organização do desenho "Nexo - Achados".

                        A ordem dos três textos responde três perguntas
                        diferentes, nesta sequência: o que é o fato, o que ele
                        custa, e o que fazer com ele.
                      */}
                          <div className="grid gap-4 p-4 @min-[46rem]:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.6fr)]">
                            <div className="grid content-start gap-4">
                              {finding.motor ? (
                                /*
                                  ACHADO DO MOTOR NOVO: o cartão vem pronto de
                                  `findingCard` (ordem, fontes por lado, estado e
                                  limites) e substitui os três textos e os trechos.
                                  Navegação por revisão só quando a persistência
                                  trouxer revisão → arquivo (P7); até lá, a fonte
                                  mostra a citação e a indisponibilidade.
                                */
                                <CartaoDoMotor
                                  modelo={findingCard(
                                    {
                                      descricao: finding.descricao ?? "",
                                      conflito: finding.conflito ?? "",
                                      evidencia: finding.evidencia ?? "",
                                      sugestao_correcao: finding.acao ?? "",
                                      pagina: finding.pagina ?? "",
                                      motor: finding.motor,
                                    },
                                    motorFonte ?? { hasRevision: () => false },
                                  )}
                                  aoAbrir={motorFonte?.aoAbrir}
                                  corretor={corretorDo(finding)}
                                />
                              ) : (
                              <>
                              <BlocoDeTexto titulo="O que está errado">
                                {finding.descricao ||
                                  finding.title ||
                                  "Fato não detalhado no resultado."}
                              </BlocoDeTexto>

                              <BlocoDeTexto titulo="Por que importa">
                                {finding.conflito ||
                                  finding.referencia ||
                                  "Consequência não detalhada no resultado."}
                              </BlocoDeTexto>

                              {/*
                            "O QUE FAZER" É O ÚNICO COM FUNDO PRÓPRIO. Os outros
                            dois descrevem; este pede uma ação, e é o que a
                            pessoa procura quando volta ao cartão pela segunda
                            vez.
                          */}
                              <OQueFazer
                                acao={finding.acao || "Ação recomendada não identificada."}
                                corretor={corretorDo(finding)}
                              />

                              <TrechosDoAchado
                                paginas={paginas}
                                evidencia={finding.evidencia}
                                termo={getHighlightNeedle(finding)}
                                aoAbrirPagina={
                                  finding.pdfUrl
                                    ? () => openInlinePdf(finding)
                                    : undefined
                                }
                              />

                              </>
                              )}

                            </div>

                            <div className="grid content-start gap-3">
                              {/*
                            ONDE APARECE — a fita de páginas. Cada número abre o
                            documento. Some no achado de uma página só: a
                            etiqueta do cabeçalho já disse tudo.
                          */}
                              {ehMultiPagina(paginas) ? (
                                <section className="nx-cut-6 bg-[var(--nexodoc-recessed)] p-3">
                                  <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Onde aparece
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {paginas.map((numero, ordem) => (
                                      <button
                                        key={`${finding.refId ?? index}-pag-${numero}`}
                                        type="button"
                                        disabled={!finding.pdfUrl}
                                        onClick={() =>
                                          openInlinePdf(finding, numero)
                                        }
                                        className={cn(
                                          "nx-cut-5 px-2.5 py-1 font-mono text-xs transition-colors",
                                          /*
                                        A PÁGINA ÂNCORA era VERDE, e verde é o
                                        sinal de OK. Ela não está "ok" — ela é a
                                        ATUAL do conjunto, e a matriz de estados
                                        (§7) diz que atual é teal preenchido. Aqui
                                        o teal é legítimo: são botões, e cada um
                                        abre o documento.
                                      */
                                          ordem === 0
                                            ? "bg-primary/15 font-semibold text-[var(--nexodoc-accent)]"
                                            : "bg-[var(--nexodoc-raised)] text-muted-foreground",
                                          finding.pdfUrl
                                            ? "cursor-pointer hover:text-foreground"
                                            : "cursor-default",
                                        )}
                                      >
                                        <span className="mr-1 text-[11px] uppercase tracking-wider opacity-70">
                                          pág.
                                        </span>
                                        {numero}
                                      </button>
                                    ))}
                                  </div>
                                </section>
                              ) : null}

                              <section className="nx-cut-6 min-w-0 bg-[var(--nexodoc-recessed)] p-3">
                                {/*
                                  A PÁGINA NO CABEÇALHO, O BOTÃO DEPOIS DO TRECHO.
                                  Lê-se o trecho e em seguida vai-se conferir: o
                                  botão fica no fim da leitura, e o chip diz
                                  ANTES dela de qual folha o trecho saiu. "Ver na
                                  pág. N" diz o destino; o nome acessível
                                  continua "Ver no documento".
                                */}
                                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Evidência encontrada
                                  </p>
                                  {paginaDaEvidencia ? (
                                    <span className="nx-cut-4 bg-[var(--nexodoc-raised)] px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                      pág. {paginaDaEvidencia}
                                    </span>
                                  ) : null}
                                  {!finding.pdfUrl && finding.semFonte ? (
                                    <span
                                      data-sem-fonte
                                      className="w-full text-xs leading-5 text-muted-foreground"
                                    >
                                      {finding.semFonte}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm leading-6 text-foreground">
                                  <HighlightedEvidence
                                    text={finding.evidencia}
                                    needle={getHighlightNeedle(finding)}
                                  />
                                </p>
                                {/*
                                  VER NO DOCUMENTO fica colado à evidência — não
                                  escondido no menu "⋯". É a ação que fecha o
                                  ciclo da auditoria: o achado deixa de ser uma
                                  afirmação e vira algo que se confere na página.
                                */}
                                {finding.pdfUrl ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-3 h-7"
                                    onClick={() => openInlinePdf(finding)}
                                    aria-label={
                                      paginaDaEvidencia
                                        ? `Ver no documento, página ${paginaDaEvidencia}`
                                        : "Ver no documento"
                                    }
                                  >
                                    <ExternalLink className="size-3.5" aria-hidden />
                                    {paginaDaEvidencia ? `Ver na pág. ${paginaDaEvidencia}` : "Ver no documento"}
                                  </Button>
                                ) : null}
                              </section>

                              {/*
                            OS METADADOS DESCEM PARA A LATERAL. Eles respondem
                            "onde eu confiro", e não "o que está errado" — quem
                            precisa deles já decidiu que vai olhar o documento.
                            "Página provável" saiu: a fita acima diz melhor, e
                            com todas as páginas em vez de uma.

                            Lista de definição, e não três caixas com contorno:
                            eram três cartões dentro do cartão do achado, cada um
                            com moldura, para três pares rótulo/valor.
                          */}
                              <dl className="m-0 grid content-start divide-y divide-border/60 px-1">
                                <FindingField
                                  label="Documento"
                                  value={finding.documento}
                                />
                                <FindingField
                                  label="Local"
                                  value={finding.local}
                                />
                                <FindingField
                                  label="Categoria"
                                  value={finding.categoria}
                                />
                              </dl>
                            </div>
                          </div>
                              </>
                            ) : null}
                            {abaDoDetalhe === "conversa" ? (
                              <div className="p-4">
                                {auditId && finding.refId ? (
                                  <ConversaDoAchado
                                    key={finding.refId}
                                    auditId={auditId}
                                    findingId={finding.refId}
                                    membros={membros}
                                    rascunho={rascunhos[finding.refId] ?? ""}
                                    onRascunho={(texto) =>
                                      setRascunhos((atual) => ({ ...atual, [finding.refId!]: texto }))
                                    }
                                    onPublicado={() =>
                                      setComentariosPorAchado((atual) => ({
                                        ...atual,
                                        [finding.refId!]: (atual[finding.refId!] ?? 0) + 1,
                                      }))
                                    }
                                  />
                                ) : (
                                  <p className="m-0 text-sm text-muted-foreground">
                                    A conversa existe para pareceres gravados no servidor.
                                  </p>
                                )}
                              </div>
                            ) : null}
                            {abaDoDetalhe === "historico" ? (
                              <HistoricoDoAchado
                                registro={registro}
                                herdadoDe={finding.herdado_de?.quando}
                                desfecho={finding.refId ? desfechoPorAchado[finding.refId] : undefined}
                              />
                            ) : null}
                          </div>

                          {/*
                            OS DOIS EIXOS, separados — auditoria UX/UI, A05.
                            VALIDADE julga o achado (a IA acertou?). TRATAMENTO diz o
                            que foi feito na obra. Confirmar não corrige nada, e
                            corrigir não diz que o achado era verdadeiro.
                          */}
                          <div className="relative z-20 grid gap-0 border-t @min-[40rem]:grid-cols-2">
                            <section aria-label="Validade" className="grid content-start gap-2 p-4 @min-[40rem]:border-r" data-eixo="validade">
                              <h5 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Validade — o achado está certo?
                              </h5>
                          {auditId && finding.refId ? (
                            <div
                              /*
                            A ÁREA DE FEEDBACK RESPONDE AO QUE FOI RESPONDIDO.
                            Antes ela era verde SEMPRE — inclusive antes de
                            alguém responder qualquer coisa, e inclusive num
                            achado marcado como falso positivo. Uma cor de
                            estado que nunca muda não é estado: é decoração, e
                            ela ocupava o verde que agora significa "confirmado".

                            Neutra por padrão; verde quando o achado foi
                            confirmado; âmbar quando foi descartado, de acordo
                            com o cartão em volta.
                          */
                              data-veredito-do-achado={
                                feedbackByFinding[finding.refId] || undefined
                              }
                              className={cn(
                                "nx-cut-6 flex flex-wrap items-center gap-3 px-3 py-2 transition-colors duration-[var(--duration-base)] ease-[var(--ease-feedback)]",
                                feedbackByFinding[finding.refId] === "CONFIRMED"
                                  ? "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)]"
                                  : feedbackByFinding[finding.refId] ===
                                      "FALSE_POSITIVE"
                                    ? "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)]"
                                    : "bg-[var(--nexodoc-recessed)]/50",
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">
                                {feedbackByFinding[finding.refId] ===
                                "CONFIRMED"
                                  ? "Achado confirmado."
                                  : feedbackByFinding[finding.refId] ===
                                      "FALSE_POSITIVE"
                                    ? "Marcado como falso positivo."
                                    : "Ainda sem julgamento."}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    feedbackByFinding[finding.refId] ===
                                    "CONFIRMED"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  disabled={feedbackSavingKey === finding.refId}
                                  onClick={() =>
                                    void saveFindingFeedback(
                                      finding,
                                      index,
                                      "CONFIRMED",
                                    )
                                  }
                                  // O botão escolhido carrega a cor do estado: é
                                  // o mesmo verde do "Corrigido" na barra de
                                  // ações, e é o que diz QUAL dos três foi.
                                  className={
                                    feedbackByFinding[finding.refId] ===
                                    "CONFIRMED"
                                      ? "border-[var(--status-ok)]/40 text-[var(--status-ok)]"
                                      : undefined
                                  }
                                >
                                  <Check />
                                  Confirmar achado
                                  <kbd aria-hidden className="ml-0.5 font-mono text-[11px] font-normal opacity-60">C</kbd>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    feedbackByFinding[finding.refId] ===
                                    "FALSE_POSITIVE"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  disabled={feedbackSavingKey === finding.refId}
                                  onClick={() =>
                                    void saveFindingFeedback(
                                      finding,
                                      index,
                                      "FALSE_POSITIVE",
                                    )
                                  }
                                  className={
                                    feedbackByFinding[finding.refId] ===
                                    "FALSE_POSITIVE"
                                      ? "border-[var(--status-warning)]/40 text-[var(--status-warning)]"
                                      : undefined
                                  }
                                >
                                  <AlertTriangle />
                                  Falso positivo
                                  <kbd aria-hidden className="ml-0.5 font-mono text-[11px] font-normal opacity-60">F</kbd>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    feedbackByFinding[finding.refId] ===
                                    "WRONG_SEVERITY"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  disabled={feedbackSavingKey === finding.refId}
                                  onClick={() =>
                                    void saveFindingFeedback(
                                      finding,
                                      index,
                                      "WRONG_SEVERITY",
                                    )
                                  }
                                >
                                  <Wrench />
                                  Gravidade errada
                                </Button>
                              </div>
                            </div>
                          ) : null}
                            </section>
                            <section aria-label="Tratamento" className="grid content-start gap-2 p-4" data-eixo="tratamento">
                              <h5 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Tratamento — o que foi feito
                              </h5>
                              <p className="m-0 text-xs text-muted-foreground" data-tratamento-atual>
                                {situacaoLegivel(finding)}
                              </p>
                        <div
                          /*
                        DE QUEM SÃO ESTAS AÇÕES. A barra é IRMÃ do cartão, não
                        filha — a identidade do achado ocupa o cartão inteiro e o
                        que se faz com ele fica em cima. O preço disso é que o
                        `data-achado` do cartão não alcança estes botões, e quem
                        precisa deles (prova, e qualquer coisa que venha depois)
                        só teria a POSIÇÃO na lista para se guiar. Índice é o
                        número mágico que já quebrou uma prova nesta tela.
                      */
                          data-acoes-do-achado={finding.refId || undefined}
                          /*
                           * `@container` PORQUE A COLUNA MANDA, e não a janela.
                           *
                           * Medido em 27/08/2026 no painel do Nexo com janela
                           * de 1100px: esta fila tem 274px de largura, e os
                           * quatro controles somam 433 — três linhas. O `@`
                           * pergunta à COLUNA, que é quem aperta; uma media
                           * query de janela responderia "1100px, está largo"
                           * enquanto a fila quebra em três.
                           */
                          className="@container flex flex-wrap items-center gap-2"
                        >
                          {/*
                          O botão fica no CABEÇALHO do achado, ao lado do menu:
                          é a ação que se repete 22 vezes numa revisão, e ela
                          tem que estar sempre no mesmo lugar, sem rolar.
                        */}
                          {/*
                          "MARCAR CORRIGIDO" SOME quando o achado foi encerrado
                          de outro jeito.

                          Ele reflete `resolvedAt`, e os TRÊS desfechos marcam
                          essa coluna — então um achado assumido como decisão
                          técnica aparecia com a tarja "Decisão técnica" ao
                          lado de um botão dizendo "Corrigido". As duas coisas
                          se contradizem, e a contradição estava exatamente
                          sobre o que o registro precisa deixar claro: se o
                          documento foi mexido ou se o risco foi assumido.
                        */}
                          {onToggleResolvido &&
                          finding.refId &&
                          (!desfechoPorAchado[finding.refId] ||
                            desfechoPorAchado[finding.refId].kind ===
                              "FIXED_IN_DOC") ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                estaResolvido(finding.refId)
                                  ? "secondary"
                                  : "outline"
                              }
                              onClick={() =>
                                void alternarResolvido(
                                  finding,
                                  !estaResolvido(finding.refId),
                                )
                              }
                              className={
                                estaResolvido(finding.refId)
                                  ? "border-[var(--status-ok)]/40 text-[var(--status-ok)]"
                                  : undefined
                              }
                            >
                              {/*
                                O ÍCONE SAI QUANDO A COLUNA APERTA — e é ele, não o rótulo.
                                Um ícone vale ~22px com o gap, e os dois desta fila são o
                                que separa duas linhas de três. Cortar a PALAVRA
                                economizaria mais e custaria o sentido: "Decisão técnica"
                                sem texto é um quadrado mudo, e decisão que alguém vai
                                defender depois não pode virar adivinhação.
                              */}
                              <Check className="hidden @[21rem]:block" />
                              {estaResolvido(finding.refId)
                                ? "Correção informada"
                                : "Informar correção"}
                            </Button>
                          ) : null}
                          {/*
                            A ORDEM DESTA FILA É POR FREQUÊNCIA, e foi medida.

                            "Marcar corrigido" e "Enviar" são o que se repete
                            vinte e duas vezes numa revisão; "Decisão técnica" é
                            rara e pesada — abre campo de nota e vira compromisso
                            que alguém defende depois. Pôr as duas frequentes
                            juntas na primeira linha não é só hierarquia: com a
                            coluna a 274px (254 de conteúdo), 144+8+72 = 224 cabe
                            e sobra folga, enquanto a ordem antiga empurrava o
                            `···` sozinho para uma TERCEIRA linha — vinte e duas
                            vezes, uma por cartão.
                          */}
                          {/*
                            ENVIAR, IRMÃO DOS OUTROS DOIS — e não escondido no
                            `···`.

                            Enviar já era possível antes: a etiqueta "Ref.
                            INC-001" é uma caixa de seleção, e marcá-la abre a
                            barra com o destinatário. Mas a palavra "enviar" só
                            aparecia DEPOIS de marcar, e dentro do menu de três
                            pontos — quem não sabia que a caixa existia não tinha
                            como descobrir a função, e ela é metade do produto.

                            NÃO ABRE SELETOR PRÓPRIO: marca este achado e deixa a
                            barra do rodapé escolher a pessoa. Um segundo lugar
                            para escolher destinatário seria uma segunda regra de
                            quem pode receber, e as duas discordariam no primeiro
                            dia.

                            E ELE ALTERNA. Marcar é reversível, então o mesmo
                            botão desmarca — um botão que já cumpriu seu efeito e
                            não faz mais nada é um botão quebrado.
                          */}
                          {finding.refId && !estaResolvido(finding.refId) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                selecionados.has(finding.refId)
                                  ? "secondary"
                                  : "outline"
                              }
                              onClick={() => alternarSelecao(finding.refId!)}
                              aria-pressed={selecionados.has(finding.refId)}
                            >
                              <Send className="hidden @[21rem]:block" />
                              {selecionados.has(finding.refId)
                                ? "Selecionado para atribuir"
                                : "Selecionar para atribuir"}
                            </Button>
                          ) : null}
                          {/*
                          DECISÃO TÉCNICA — o terceiro desfecho.

                          Fica ao lado de "Marcar corrigido" e não dentro do
                          menu de três pontos: é uma decisão que se assume, e
                          esconder uma decisão que alguém vai ter que defender
                          depois é o contrário do que a tela deve fazer.

                          O primeiro clique abre o campo da nota; o segundo
                          grava. Sem nota o botão não fecha nada — e o
                          servidor recusa também, que é onde a regra vale.
                        */}
                          {finding.refId &&
                          !desfechoPorAchado[finding.refId] ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                escrevendoRisco === finding.refId &&
                                !notaDoRisco[finding.refId]?.trim()
                              }
                              onClick={() => {
                                if (escrevendoRisco !== finding.refId) {
                                  setEscrevendoRisco(finding.refId!);
                                  return;
                                }

                                void salvarDesfecho(
                                  finding,
                                  index,
                                  "ACCEPTED_RISK",
                                  notaDoRisco[finding.refId!],
                                );
                              }}
                            >
                              {escrevendoRisco === finding.refId
                                ? "Gravar decisão técnica"
                                : "Registrar decisão técnica"}
                            </Button>
                          ) : null}
                          <Dropdown
                            align="end"
                            trigger={({ open, toggle }) => (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={toggle}
                                aria-expanded={open}
                              >
                                <MoreHorizontal className="size-4" />
                                Mais ações
                              </Button>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {finding.termoBusca ? (
                                  <DropdownItem
                                    onClick={() => {
                                      void navigator.clipboard.writeText(
                                        finding.termoBusca ?? "",
                                      );
                                      close();
                                    }}
                                  >
                                    <Copy className="size-4" />
                                    Copiar termo
                                  </DropdownItem>
                                ) : null}
                                {auditId && finding.refId ? (
                                  <DropdownItem
                                    onClick={() => {
                                      void copiarLinkDoAchado(finding.refId!);
                                      close();
                                    }}
                                  >
                                    <Copy className="size-4" />
                                    Copiar link do achado
                                  </DropdownItem>
                                ) : null}
                                <DropdownItem
                                  onClick={() => {
                                    void createFindingSnapshot(finding, index).catch((e) =>
                                      setPop({ tom: "falha", texto: e instanceof Error ? e.message : "Não deu para gerar o cartão." }),
                                    );
                                    close();
                                  }}
                                >
                                  <Eye className="size-4" />
                                  Exportar cartão do achado (PNG)
                                </DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        </div>
                          {finding.refId &&
                          escrevendoRisco === finding.refId ? (
                            <div className="grid">
                              <label
                                htmlFor={`nota-risco-${finding.refId}`}
                                className="mb-2 block font-mono text-xs uppercase text-muted-foreground"
                              >
                                Por que este risco está sendo assumido
                              </label>
                              <Textarea
                                id={`nota-risco-${finding.refId}`}
                                value={notaDoRisco[finding.refId] ?? ""}
                                onChange={(event) =>
                                  setNotaDoRisco((atual) => ({
                                    ...atual,
                                    [finding.refId!]: event.target.value,
                                  }))
                                }
                                rows={3}
                                autoFocus
                                placeholder="Ex.: aprovado pelo corpo de bombeiros em 12/08, ata anexada ao processo."
                                className="w-full"
                                textareaClassName="resize-y"
                              />
                              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                                Fica registrada com o seu nome e a data. Sem
                                ela, a decisão não é gravada.
                              </p>
                            </div>
                          ) : null}
                            </section>
                          </div>
                        </article>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>


                {auditId ? (
                  <section className="nx-cut-8 bg-[var(--nexodoc-recessed)] p-4">
                    <p className="font-mono text-xs uppercase text-muted-foreground">
                      Faltou apontar algum erro?
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Textarea
                        value={missingFindingNote}
                        onChange={(event) =>
                          setMissingFindingNote(event.target.value)
                        }
                        rows={2}
                        className="min-h-12 flex-1"
                        textareaClassName="resize-y"
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
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {feedbackNotice}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {/*
                  A BARRA DE ENVIO, grudada no rodapé da lista.

                  Mesmo padrão de `/admin/users`: aparece só quando há seleção, e
                  fica onde a mão já está — a alternativa seria um diálogo por
                  cima, que tira os achados da vista justamente quando a pessoa
                  precisa conferir quais marcou.
                */}
                {/*
                  O RODAPÉ DA LISTA É UM SÓ, e por isso os dois moram no mesmo
                  `sticky`.

                  A barra de envio some no instante em que o envio dá certo (a
                  seleção zera) e o pop nasce ali, na mesma posição, com a mesma
                  forma e a mesma elevação: o olho não precisa procurar a
                  resposta, ela chega onde a pergunta estava. Quando o envio
                  FALHA os dois convivem — a seleção não foi desfeita, e o pop
                  fica por cima da barra explicando por quê.

                  Dois `sticky bottom-4` irmãos se sobreporiam no mesmo ponto;
                  um `sticky` só, com os dois dentro, empilha de verdade.
                */}
                {pop || selecionados.size > 0 ? (
                  <div className="sticky bottom-4 z-10 grid gap-2">
                    {pop ? (
                      <Pop tom={pop.tom} onFechar={fecharPop}>
                        {pop.texto}
                      </Pop>
                    ) : null}
                    {selecionados.size > 0 ? (
                      /*
                    QUATRO COISAS ESTAVAM FORA DO SISTEMA aqui, e todas na mesma
                    barra (§2, §5, §7 da DESIGN.md):

                     · `rounded-md` — a geometria declarada é o CHANFRO, e duas
                       geometrias na mesma tela não são um sistema;
                     · `border-primary/40` — teal é a cor do INTERATIVO. Uma
                       moldura teal num contêiner passivo gasta o acento em
                       decoração, que é exatamente o que a regra do acento único
                       proíbe;
                     · fundo `--nexodoc-recessed` — recessed é a cor de CAMPO.
                       A barra é painel flutuante, e o `<Select>` dentro dela
                       também pede recessed: campo e contêiner ficavam na mesma
                       cor, e o seletor sumia dentro da barra. Era esse o "não
                       dá para ler";
                     · `shadow-lg` — `box-shadow` morre no recorte. Elevação de
                       sobreposição vem de `drop-shadow` num pai NÃO recortado.

                    Por isso são dois elementos e não um: `.nx-elev` é o pai que
                    projeta a sombra, e a forma chanfrada de dentro é o que ela
                    segue.

                    `.nx-cut-8` E NÃO `.nx-edge-8`, e isto foi medido no
                    navegador, não deduzido: `.nx-edge-*` reage a
                    `:has(:focus-visible)` — é assim que o wrapper de um campo
                    mostra o foco do filho. Numa barra que CONTÉM campos, focar o
                    seletor acendia a moldura da BARRA INTEIRA de teal, e o anel
                    de foco aparecia a quarenta centímetros do controle focado.
                    A camada de contorno é vocabulário de CONTROLE; um painel que
                    guarda controles é forma só, e quem o separa do fundo é a
                    sombra do `.nx-elev` mais o degrau de superfície (`--card`
                    sobre a página).
                  */
                      <div className="nx-elev">
                        <div className="nx-cut-8 flex flex-wrap items-center gap-3 bg-card px-4 py-3">
                          {/*
                      A CONTAGEM É O ASSUNTO DA BARRA, e estava em 12px cinza,
                      do mesmo peso do resto. Mono Label maiúsculo separa o
                      rótulo do dado sem precisar de cor — e a cor aqui seria
                      teal, que não pode.
                    */}
                          <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                            <span className="text-sm font-semibold normal-case tracking-normal text-foreground">
                              {selecionados.size}
                            </span>{" "}
                            {selecionados.size === 1 ? "achado selecionado" : "achados selecionados"}
                          </span>

                          <label
                            htmlFor="destinatario-do-envio"
                            className="sr-only"
                          >
                            Atribuir a
                          </label>
                          {/*
                      ALTURA 40, e não 36. O `h-9` ia para o WRAPPER, mas o
                      `select` de dentro tem `min-height: 2.5rem` numa regra
                      global fora de `@layer` — que vence utility. O campo
                      transbordava a própria moldura por 4px, e é boa parte do
                      borrado que a lista tinha.

                      A LARGURA MÍNIMA existe porque o nome é o dado: "Christian
                      Lizardo Wilhelm Aren…" cortado em 140px não identifica
                      ninguém.
                    */}
                          <Select
                            id="destinatario-do-envio"
                            value={destinatario}
                            onChange={(event) =>
                              setDestinatario(event.target.value)
                            }
                            className="min-w-[15rem] flex-1 sm:max-w-[22rem]"
                            selectClassName="text-foreground"
                          >
                            <option value="">Atribuir a…</option>
                            {/*
                        QUEM RESPONDE PELA DISCIPLINA VEM PRIMEIRO — e ninguém
                        some da lista.

                        Achado de hidrossanitário é de complementares, e caçar o
                        nome certo numa lista de 31 pessoas é o atrito que esta
                        ordenação tira. FILTRAR seria o caminho óbvio e seria
                        errado: a disciplina do achado sai de varredura de texto
                        e cai em "geral" quando nada casa — com filtro, esses
                        achados mostrariam uma lista vazia e não haveria como
                        enviar nada.

                        Sem grupo reconhecido, a ordem é a que veio do servidor.
                      */}
                            {grupoDoEnvio && agrupar ? (
                              <>
                                <optgroup label={GRUPOS_TECNICOS[grupoDoEnvio]}>
                                  {membrosDoGrupo.map((m) => (
                                    <option key={m.email} value={m.email}>
                                      {m.name ?? m.email}
                                      {m.status === "INVITED"
                                        ? " (convidado)"
                                        : ""}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Resto do escritório">
                                  {membrosDeFora.map((m) => (
                                    <option key={m.email} value={m.email}>
                                      {m.name ?? m.email}
                                      {m.status === "INVITED"
                                        ? " (convidado)"
                                        : ""}
                                    </option>
                                  ))}
                                </optgroup>
                              </>
                            ) : (
                              membros.map((m) => (
                                <option key={m.email} value={m.email}>
                                  {m.name ?? m.email}
                                  {m.status === "INVITED" ? " (convidado)" : ""}
                                </option>
                              ))
                            )}
                          </Select>

                          {/*
                      O RECADO, OPCIONAL — e `Input` e não `Textarea`.
                      A barra é `items-center` com controles de 40px, e os
                      comentários vizinhos explicam por que essa altura importa.
                      Um `Textarea` (min-h 64) desalinharia a linha inteira para
                      ganhar uma segunda linha de texto que o recado raramente
                      usa. Quem precisa escrever mais escreve na conversa do
                      achado, que é onde a discussão mora.
                    */}
                          <Input
                            value={recado}
                            onChange={(event) => setRecado(event.target.value)}
                            placeholder="Recado (opcional)"
                            aria-label="Recado que vai junto de cada achado enviado"
                            className="min-w-[12rem] flex-1 sm:max-w-[20rem]"
                          />

                          {/*
                      A AÇÃO DE TURNO da barra, e por isso na altura PADRÃO (40)
                      e não na densa (32): ela precisa alinhar com o campo ao
                      lado, e um botão de 32 ao lado de um campo de 40 lê como
                      controle secundário. É o oposto do que ele é — a barra
                      inteira existe para este clique.

                      `loading` em vez de trocar o rótulo à mão: o primitivo já
                      guarda a largura e põe o spinner por dentro, que é o que a
                      matriz de estados manda (§7). Trocar "Enviar" por
                      "Enviando…" encolhia e esticava a barra a cada envio.
                    */}
                          <Button
                            type="button"
                            disabled={!destinatario}
                            loading={enviando}
                            onClick={() => void enviarSelecionados()}
                            /*
                        O rótulo visível é "Enviar", curto porque a barra já diz
                        quantos e para quem. Mas a página TEM outro "Enviar" — o
                        do chat do Nexo —, e para quem navega por leitor de tela
                        os dois seriam a mesma palavra solta.
                      */
                          >
                            <Send aria-hidden />
                            {destinatario
                              ? `Atribuir ${plural(selecionados.size, "achado", "achados")} a ${nomeDoDestinatario}`
                              : `Atribuir ${plural(selecionados.size, "achado", "achados")}`}
                          </Button>

                          {/*
                      LIMPAR É FANTASMA, e continua sendo — desfazer a seleção
                      não é ação de turno. Mas era um `<button>` cru: sem a
                      altura da linha, sem o Mono Label do sistema e sem anel de
                      foco por dentro do chanfro. O primitivo resolve os três.

                      SEM `ml-auto`, desde 27/08/2026. Ele empurrava o Limpar
                      para a direita da linha, e numa barra que quebra
                      (`flex-wrap`) o empurrão sobrevive à quebra: no painel
                      estreito do Nexo o Limpar caía sozinho numa terceira
                      linha, encostado na borda, longe do Enviar que ele desfaz.
                      Colado no Enviar ele lê como o par que é.
                    */}
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setSelecionados(new Set())}
                            aria-label="Limpar seleção"
                          >
                            Limpar
                          </Button>

                          {/*
                      O BURACO DITO EM VOZ ALTA.

                      Quando a disciplina TEM grupo e o grupo não tem ninguém, o
                      seletor cai na lista plana de quarenta nomes — e quem envia
                      não sabe por quê. Parece que o sistema não soube; ele soube,
                      e não há a quem apontar.

                      Medido em 21/08: `terraplenagem` e `climatizacao` respondem
                      ao grupo `externo` (são terceirizadas na tabela do
                      escritório) e o escritório não tem NINGUÉM nele. São 64 dos
                      229 achados dos dois memoriais de referência — um quarto.

                      A frase não sugere ninguém, e é o ponto: sugerir seria
                      inventar dono. Ela diz o fato que falta, e quem lê sabe o
                      que fazer — convidar o parceiro, ou corrigir o grupo de
                      quem já faz a ponte.

                      AZUL, E NÃO ÂMBAR — o âmbar era meu, e estava errado (§2).
                      Âmbar é ATENÇÃO: um estado do documento que pede ação sobre
                      ele. Isto é contexto que o sistema oferece sobre a própria
                      lista, e é exatamente o trabalho declarado de
                      `--signal-info`. O comentário do `Badge` já avisa o preço
                      de errar isso: quando "seu documento está velho" divide a
                      cor com "reconectei sozinho", o engenheiro aprende a
                      ignorar o âmbar — e o aviso que custa dinheiro passa batido.

                      Frase em SANS, não em mono: mono é rótulo e dado. Isto é
                      prosa, e prosa em mono lê como saída de terminal.
                    */}
                          <p className="m-0 w-full text-xs text-muted-foreground" data-resumo-do-lote>
                            Atribuir não manda e-mail: a pessoa vê na home dela. O aviso por e-mail é
                            separado, em &ldquo;Notificar por e-mail&rdquo;, no topo do parecer.
                          </p>
                          {grupoDoEnvio && !agrupar ? (
                            <p className="flex w-full items-start gap-2 text-xs leading-relaxed text-[var(--signal-info)]">
                              <Info
                                aria-hidden
                                className="mt-px size-4 shrink-0"
                              />
                              <span>
                                <strong className="font-medium">
                                  {GRUPOS_TECNICOS[grupoDoEnvio]}
                                </strong>{" "}
                                é quem responde por este achado, e ninguém do
                                escritório está nesse grupo. Escolha à mão, ou
                                peça para incluírem a pessoa.
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {openEngineFindings.length > 0 ? (
                  <section className="nx-cut-8 grid gap-2 bg-[var(--nexodoc-recessed)] px-4 pb-4 pt-3">
                    <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Questões em aberto — verificação não concluída ({openEngineFindings.length})
                    </h3>
                    {openEngineFindings.map((finding, index) => (
                      <div key={`${finding.raw}-aberta-${index}`} className="nx-cut-8 bg-card p-3">
                        <CartaoDoMotor
                          modelo={findingCard(
                            {
                              descricao: finding.descricao ?? "",
                              conflito: finding.conflito ?? "",
                              evidencia: finding.evidencia ?? "",
                              sugestao_correcao: finding.acao ?? "",
                              pagina: finding.pagina ?? "",
                              motor: finding.motor!,
                            },
                            motorFonte ?? { hasRevision: () => false },
                          )}
                          aoAbrir={motorFonte?.aoAbrir}
                          corretor={corretorDo(finding)}
                        />
                      </div>
                    ))}
                  </section>
                ) : null}

                {suggestionFindings.length > 0 ? (
                  <details className="nx-cut-8 bg-[var(--nexodoc-recessed)]">
                    <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Sugestões da IA — confira ({suggestionFindings.length}) ·
                      menor confiança, não contam para o veredito
                    </summary>
                    <div className="grid gap-2 px-4 pb-4">
                      {suggestionFindings.map((finding, index) => (
                        <div
                          key={`${finding.raw}-suggestion-${index}`}
                          className="nx-cut-8 bg-card p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">Sugerido</Badge>
                            {finding.pagina ? (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                p.{finding.pagina}
                              </span>
                            ) : null}
                            <span className="text-sm font-medium text-foreground">
                              {finding.title}
                            </span>
                            {finding.pdfUrl ? (
                              <button
                                type="button"
                                onClick={() => openInlinePdf(finding)}
                                className="ml-auto text-xs text-primary outline-none hover:underline focus-visible:underline"
                              >
                                {/* O MESMO rótulo do botão colado à evidência
                                    (ver o comentário dele). Dois nomes para o
                                    mesmo gesto é como um produto passa a ter
                                    duas portas para o mesmo lugar. */}
                                Ver no documento
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
              <EmptyState
                description={
                  report && incompletudeDoParecer(report).incompleta
                    ? "Nenhum achado nesta lista, mas a auditoria NÃO foi completa: isto não significa que o documento está correto."
                    : "Nenhum achado encontrado."
                }
                className="py-8"
              />
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
                <p className="mt-1 text-sm">
                  {report && incompletudeDoParecer(report).incompleta
                    ? incompletudeDoParecer(report).titulo
                    : status}
                </p>
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Achados
                </p>
                <TextoDoRelatorio texto={findingsText} />
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Ações recomendadas
                </p>
                <TextoDoRelatorio texto={actionsText} />
              </div>
              <div>
                <p className="font-mono text-xs font-medium uppercase text-muted-foreground">
                  Conclusão
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                  {report?.conclusao ||
                    parsed.conclusion ||
                    "Sem conclusão identificada."}
                </pre>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </article>
  );
}
