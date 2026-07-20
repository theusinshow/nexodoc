"use client";

import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  Files,
  Gauge,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PanelRight,
  RotateCcw,
  ScrollText,
  SlidersHorizontal,
  TableProperties,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { AuditProgress } from "@/components/audit-progress";
import { AuditResult, type AuditPdfSource } from "@/components/audit-result";
import { Composer } from "@/components/composer";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { MessageBubble } from "@/components/message-bubble";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_ANALYSIS_LEVEL,
  getAnalysisLevelDescription,
  getAnalysisLevelLabel,
  type AnalysisLevel,
} from "@/lib/analysis-level";
import type { AuditReport } from "@/lib/audit-report";
import {
  DEFAULT_AUDIT_MODE,
  getAuditModeDescription,
  getAuditModeLabel,
  type AuditMode,
} from "@/lib/audit-mode";
import type { AuditFileAttachment, DocumentType } from "@/lib/document-types";
import type { DocumentClassification, DocumentKind } from "@/lib/audit-classify";
import { PREFEITURAS, PREFEITURA_OUTRA_ID, findPrefeitura } from "@/lib/prefeituras";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { ProjectContext } from "@/lib/project-context";
import { cn } from "@/lib/utils";

function normalizeMunicipio(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type ChatWindowProps = {
  isMockMode?: boolean;
  allowDemoMode?: boolean;
  isAdmin?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  projectId?: string;
  projectContext?: ProjectContext | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  auditId?: string;
  auditMode?: AuditMode;
  elapsedMs?: number;
  report?: AuditReport;
  pdfSources?: AuditPdfSource[];
};

type AuditHistoryItem = {
  id: string;
  title: string;
  projectName: string;
  description: string;
  createdAt: Date;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  fileNames: string[];
  status: "processing" | "completed" | "failed" | "canceled";
  result?: string;
  report?: AuditReport;
  elapsedMs?: number;
  error?: string;
  pdfSources?: AuditPdfSource[];
};

type RecentAuditListItem = {
  id: string;
  title: string;
  projectName: string;
  description: string;
  auditMode: string;
  analysisLevel?: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED";
  result: string | null;
  report: AuditReport | null;
  error: string | null;
  elapsedMs: number | null;
  createdAt: string;
  fileNames: string[];
};

type RecentAuditsResponse = {
  audits: RecentAuditListItem[];
  disabledReason?: string;
};

type AuditHistoryStatus = {
  configured: boolean;
  connected: boolean;
  publicHistoryEnabled: boolean;
  message: string;
};

type QualitySummary = {
  enabled: boolean;
  total: number;
  confirmed: number;
  falsePositive: number;
  wrongSeverity: number;
  missingFinding: number;
};

type InspectorTab = "summary" | "findings" | "report";
type AuditEngine = "single" | "dual";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

type AuditTriageOption = {
  id: string;
  mode: AuditMode;
  recommendedLevel: AnalysisLevel;
  icon: typeof ScrollText;
  title: string;
  shortLabel: string;
  description: string;
  fileHint: string;
  prompt: string;
};

const AUDIT_TRIAGE_OPTIONS: AuditTriageOption[] = [
  {
    id: "memorial-coherence",
    mode: "memorial",
    recommendedLevel: "standard",
    icon: ScrollText,
    title: "Conferir memorial",
    shortLabel: "Memorial",
    description: "Use quando o alvo e um memorial, especificacao ou texto tecnico unico.",
    fileHint: "1 PDF principal",
    prompt:
      "Cheque o memorial descritivo. Verifique identificacao do projeto, coerencia interna do texto e sinais de reaproveitamento de outro projeto.",
  },
  {
    id: "volume-cross-check",
    mode: "volume",
    recommendedLevel: "standard",
    icon: Files,
    title: "Conferir volume",
    shortLabel: "Volume",
    description: "Use para comparar capa, separatriz, LD e pranchas do mesmo volume.",
    fileHint: "2 a 5 PDFs",
    prompt:
      "Cheque o volume de projeto. Compare capa, separatriz, LDs e pranchas, com foco em LD x pranchas, selos, revisoes, titulos, disciplina, volume e tomo.",
  },
  {
    id: "deep-review",
    mode: "volume",
    recommendedLevel: "deep",
    icon: ClipboardCheck,
    title: "Revisao completa",
    shortLabel: "Profunda",
    description: "Use quando o risco e maior e vale gastar mais tempo e tokens.",
    fileHint: "Volume completo",
    prompt:
      "Faca uma auditoria profunda do conjunto documental. Compare identificacao, LD, capa, separatriz, pranchas, selos, revisoes, titulos, disciplina, volume e tomo. Priorize inconsistencias que possam travar revisao tecnica.",
  },
];

function getAuditEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  return apiUrl ? `${apiUrl}/api/audit` : "/api/audit";
}

function getAuditChatEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  return apiUrl ? `${apiUrl}/api/audit/chat` : "/api/audit/chat";
}

function getLearningsEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  return apiUrl ? `${apiUrl}/api/learnings` : "/api/learnings";
}

function getRecentAuditsEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const path = "/api/audits/recent?limit=20";

  return apiUrl ? `${apiUrl}${path}` : path;
}

function getAuditHistoryStatusEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const path = "/api/audits/status";

  return apiUrl ? `${apiUrl}${path}` : path;
}

function getQualitySummaryEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const path = "/api/audits/quality";

  return apiUrl ? `${apiUrl}${path}` : path;
}

function getAuditCancelEndpoint(auditId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const path = `/api/audit/${encodeURIComponent(auditId)}/cancel`;

  return apiUrl ? `${apiUrl}${path}` : path;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getDefaultPrompt(mode: AuditMode) {
  return AUDIT_TRIAGE_OPTIONS.find((option) => option.mode === mode)?.prompt ?? AUDIT_TRIAGE_OPTIONS[0].prompt;
}

function getStatusFromResult(result?: string) {
  if (!result) {
    return "aguardando envio";
  }

  const lowerResult = normalizeText(result);

  if (
    lowerResult.includes("revisao obrigatoria") ||
    lowerResult.includes("com inconsistencias criticas") ||
    lowerResult.includes("com incongruencia relevante")
  ) {
    return "com inconsistências críticas";
  }

  if (
    lowerResult.includes("com pontos de revisao") ||
    lowerResult.includes("com ponto de atencao")
  ) {
    return "com pontos de revisão";
  }

  if (
    lowerResult.includes("sem achados criticos") ||
    lowerResult.includes("sem incongruencia relevante")
  ) {
    return "sem achados críticos";
  }

    return "resultado disponível";
}

function getFindingCount(result?: string) {
  if (!result) {
    return 0;
  }

  return result.match(/Achado\s+\d+:/gi)?.length ?? 0;
}

function getReportFindingCount(report?: AuditReport) {
  return report?.total_incongruencias ?? report?.incongruencias.length ?? 0;
}

function formatSeconds(ms?: number) {
  if (!ms) {
    return "--";
  }

  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function getUserInitials(name?: string | null) {
  if (!name) {
    return "?";
  }

  const parts = name.trim().split(/\s+/);

  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatHistoryDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getHistoryStatusLabel(status: AuditHistoryItem["status"]) {
  if (status === "completed") {
    return "concluída";
  }

  if (status === "failed") {
    return "falhou";
  }

  if (status === "canceled") {
    return "cancelada";
  }

  return "processando";
}

function getHistoryItemTitle(item: AuditHistoryItem) {
  if (item.title && !/auditoria sem identifica/i.test(item.title)) {
    return item.title;
  }

  if (item.projectName && !/projeto n[aã]o informado/i.test(item.projectName)) {
    return item.projectName;
  }

  return item.fileNames[0] ?? "Auditoria salva";
}

function getHistoryItemDetail(item: AuditHistoryItem) {
  const fileCount =
    item.fileNames.length > 1
      ? `${item.fileNames.length} arquivos`
      : item.fileNames[0] ?? "sem arquivo";

  return `${getAuditModeLabel(item.auditMode)} · ${getAnalysisLevelLabel(item.analysisLevel)} · ${getHistoryStatusLabel(item.status)} · ${formatHistoryDate(item.createdAt)} · ${fileCount}`;
}

function mapPersistedAuditStatus(status: RecentAuditListItem["status"]): AuditHistoryItem["status"] {
  if (status === "COMPLETED") {
    return "completed";
  }

  if (status === "FAILED") {
    return "failed";
  }

  if (status === "CANCELED") {
    return "canceled";
  }

  return "processing";
}

function mapPersistedAudit(item: RecentAuditListItem): AuditHistoryItem {
  return {
    id: item.id,
    title: item.title,
    projectName: item.projectName,
    description: item.description,
    createdAt: new Date(item.createdAt),
    auditMode: item.auditMode === "volume" ? "volume" : "memorial",
    analysisLevel: item.analysisLevel === "deep" ? "deep" : "standard",
    fileNames: item.fileNames,
    status: mapPersistedAuditStatus(item.status),
    result: item.result ?? undefined,
    report: item.report ?? undefined,
    elapsedMs: item.elapsedMs ?? undefined,
    error: item.error ?? undefined,
  };
}

function extractSection(content: string | undefined, titlePattern: string) {
  if (!content) {
    return "";
  }

  const regex = new RegExp(
    `${titlePattern}\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\d+\\.\\s|$)`,
    "i",
  );
  return regex.exec(content)?.[1]?.trim() ?? "";
}

function extractFirstRecommendedAction(content: string | undefined) {
  if (!content) {
    return "";
  }

  return (
    content.match(/Ação recomendada:\s*(.+)/i)?.[1]?.trim() ??
    content.match(/Acao recomendada:\s*(.+)/i)?.[1]?.trim() ??
    ""
  );
}

// Mapeia o tipo detectado pela classificação para o DocumentType do anexo.
const CLASSIFICATION_DOCTYPE: Record<DocumentKind, DocumentType> = {
  memorial: "memorial",
  ld: "ld",
  capa: "capa",
  prancha: "pranchas",
  orcamento: "outro",
  desconhecido: "outro",
};

function validateFiles(
  currentFiles: AuditFileAttachment[],
  newFiles: File[],
  documentType: DocumentType,
) {
  const pdfFiles = newFiles.filter((file) => {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  });

  if (pdfFiles.length !== newFiles.length) {
    return {
      files: currentFiles,
      error: "Anexe apenas PDFs nesta versao.",
    };
  }

  const oversized = pdfFiles.find((file) => file.size > MAX_FILE_SIZE);

  if (oversized) {
    return {
      files: currentFiles,
      error: `O arquivo "${oversized.name}" excede 25 MB.`,
    };
  }

  const attachments = pdfFiles.map((file) => ({
    id: crypto.randomUUID(),
    file,
    documentType,
  }));
  const merged = [...currentFiles, ...attachments].slice(0, MAX_FILES);

  if (currentFiles.length + pdfFiles.length > MAX_FILES) {
    return {
      files: merged,
      error: `Foram mantidos os primeiros ${MAX_FILES} PDFs.`,
    };
  }

  return {
    files: merged,
    error: "",
  };
}

export function ChatWindow({
  isMockMode = false,
  allowDemoMode = false,
  isAdmin = false,
  userName,
  userEmail,
  userImage,
  projectId,
  projectContext,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState(getDefaultPrompt(DEFAULT_AUDIT_MODE));
  const [files, setFiles] = useState<AuditFileAttachment[]>([]);
  const [auditMode, setAuditMode] = useState<AuditMode>(DEFAULT_AUDIT_MODE);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>(DEFAULT_ANALYSIS_LEVEL);
  const [auditEngine, setAuditEngine] = useState<AuditEngine>("single");
  const [auditTitle, setAuditTitle] = useState(projectContext?.code ? `Auditoria ${projectContext.code}` : "");
  const [projectName, setProjectName] = useState(projectContext?.name ?? "");
  const [auditDescription, setAuditDescription] = useState("");
  // Item 1 — gabarito (ground truth). Pré-preenchido pela classificação; o usuário
  // confere/corrige ou pula. Vazio = motor infere sozinho.
  const [gabaritoPrefeitura, setGabaritoPrefeitura] = useState<string>("");
  const [gabaritoObra, setGabaritoObra] = useState(projectContext?.name ?? "");
  const [gabaritoCentroCusto, setGabaritoCentroCusto] = useState(projectContext?.code ?? "");
  const [gabaritoEndereco, setGabaritoEndereco] = useState("");
  const [classifications, setClassifications] = useState<DocumentClassification[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [gabaritoOpen, setGabaritoOpen] = useState(false);
  const classifiedSignatureRef = useRef("");
  // Mock permanece disponível apenas via env var (invisível ao usuário na UI).
  const [useMockMode] = useState(isMockMode && allowDemoMode);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"audit" | "followup" | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [auditHistory, setAuditHistory] = useState<AuditHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<AuditHistoryStatus | null>(null);
  const [qualitySummary, setQualitySummary] = useState<QualitySummary | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [learningTitle, setLearningTitle] = useState("");
  const [learningContent, setLearningContent] = useState("");
  const [learningNotice, setLearningNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function closeSidebar() {
    setSidebarClosing(true);
    setTimeout(() => {
      setSidebarOpen(false);
      setSidebarClosing(false);
    }, 170);
  }

  function openSidebar() {
    setSidebarClosing(false);
    setSidebarOpen(true);
  }

  const router = useRouter();
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "g",
        ctrl: true,
        handler: () => router.push("/"),
        description: "Ir para o dashboard",
      },
      {
        key: "l",
        ctrl: true,
        handler: () => router.push("/ld"),
        description: "Ir para montagem de LDs",
      },
      ...(isAdmin
        ? [
            {
              key: "a",
              ctrl: true,
              shift: true,
              handler: () => router.push("/admin"),
              description: "Ir para painel admin",
            },
          ]
        : []),
    ],
  });
  const [isSavingLearning, setIsSavingLearning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const pdfObjectUrlsRef = useRef<string[]>([]);

  const latestResult = useMemo(() => {
    return [...messages]
      .reverse()
      .find(
        (item) =>
          item.role === "assistant" &&
          (item.report || item.elapsedMs || item.pdfSources),
      );
  }, [messages]);
  const canAskAboutAudit = Boolean(latestResult?.report);
  const latestStatus = getStatusFromResult(latestResult?.content);
  const latestFindingCount =
    getReportFindingCount(latestResult?.report) || getFindingCount(latestResult?.content);
  const latestProject = extractSection(
    latestResult?.content,
    "1\\.\\s*Projeto analisado",
  );
  const latestRecommendedAction =
    extractFirstRecommendedAction(latestResult?.content) ||
    (latestResult
      ? "Revisar achados, confirmar evidências e registrar decisão técnica."
      : "Envie os PDFs e execute uma auditoria para iniciar a inspeção.");
  const activeAudit = auditHistory.find((item) => item.id === activeAuditId);
  const displayedFileCount = files.length || activeAudit?.fileNames.length || 0;
  const setupComplete = true;
  const statusIsCritical = latestStatus === "com inconsistências críticas";
  const statusIsOk = latestStatus === "sem achados críticos";
  const statusToneClass = statusIsCritical
    ? "border-[var(--status-critical)]/35 bg-[var(--status-critical-bg)] text-[var(--status-critical)]"
    : statusIsOk
      ? "border-[var(--status-ok)]/35 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
      : "border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
  const fieldClass =
    "h-10 rounded-md border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, error]);

  useEffect(() => {
    if (!detailsOpen) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [detailsOpen]);

  useEffect(() => {
    return () => {
      pdfObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      pdfObjectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    async function loadRecentAudits() {
      try {
        const response = await fetch(getRecentAuditsEndpoint(), {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as RecentAuditsResponse;

        if (!payload.audits?.length) {
          return;
        }

        setAuditHistory((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          const persistedItems = payload.audits
            .filter((item) => !currentIds.has(item.id))
            .map(mapPersistedAudit);

          return [...persistedItems, ...current];
        });
      } catch {
        // Histórico persistido é incremental; a auditoria continua funcionando sem ele.
      }
    }

    void loadRecentAudits();
  }, []);

  useEffect(() => {
    async function loadHistoryStatus() {
      try {
        const response = await fetch(getAuditHistoryStatusEndpoint(), {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        setHistoryStatus((await response.json()) as AuditHistoryStatus);
      } catch {
        setHistoryStatus({
          configured: false,
          connected: false,
          publicHistoryEnabled: false,
          message: "Não foi possível verificar o histórico persistente.",
        });
      }
    }

    void loadHistoryStatus();
  }, []);

  useEffect(() => {
    async function loadQualitySummary() {
      try {
        const response = await fetch(getQualitySummaryEndpoint(), { cache: "no-store" });

        if (response.ok) {
          setQualitySummary((await response.json()) as QualitySummary);
        }
      } catch {
        // Métrica é auxiliar e não bloqueia auditorias.
      }
    }

    void loadQualitySummary();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 500);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  // Classificação determinística ao anexar: lê o(s) PDF(s) e pré-preenche
  // tipo/obra/município/código, para o operador só confirmar. Não chama IA.
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const signature = files.map((item) => `${item.file.name}:${item.file.size}`).join("|");

    if (signature === classifiedSignatureRef.current) {
      return; // mesmo conjunto de arquivos (ex.: só o documentType mudou) — não reclassifica
    }

    if (files.length === 0) {
      classifiedSignatureRef.current = "";
      setClassifications([]);
      return;
    }

    classifiedSignatureRef.current = signature;
    const controller = new AbortController();

    async function classify(items: AuditFileAttachment[]) {
      setIsClassifying(true);

      try {
        const form = new FormData();
        for (const item of items) {
          form.append("files", item.file, item.file.name);
        }

        const response = await fetch("/api/audit/classify", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { classifications?: DocumentClassification[] };
        const list = payload.classifications ?? [];
        setClassifications(list);

        const primary = list[0];

        if (primary) {
          if (primary.obra) {
            setProjectName(primary.obra);
          }
          setAuditTitle((current) => current || primary.codigo || primary.obra || current);
          setAuditMode(primary.auditMode);
          setAnalysisLevel(primary.analysisLevel);
          // Pré-preenche o gabarito (item 1) sem sobrescrever o que o usuário já digitou.
          setGabaritoObra((current) => current || primary.obra || "");
          setGabaritoCentroCusto((current) => current || primary.codigo || "");
          if (primary.municipio) {
            const detected = normalizeMunicipio(primary.municipio);
            const matched = PREFEITURAS.find((item) => normalizeMunicipio(item.municipio) === detected);
            if (matched) {
              setGabaritoPrefeitura((current) => current || matched.id);
            }
          }
          setFiles((current) =>
            current.map((item, index) => {
              const tipo = list[index]?.tipo;
              return tipo ? { ...item, documentType: CLASSIFICATION_DOCTYPE[tipo] } : item;
            }),
          );
        }
      } catch {
        // Classificação é auxiliar; falha não bloqueia a auditoria manual.
      } finally {
        setIsClassifying(false);
      }
    }

    void classify(files);

    return () => controller.abort();
  }, [files, isLoading]);

  function handleFilesAdd(newFiles: File[], documentType: DocumentType) {
    setFiles((currentFiles) => {
      const result = validateFiles(currentFiles, newFiles, documentType);
      setError(result.error);
      return result.files;
    });
  }

  function handleDropFiles(newFiles: File[]) {
    handleFilesAdd(newFiles, auditMode === "volume" ? "outro" : "memorial");
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDropActive(false);
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);

    if (droppedFiles.length > 0) {
      handleDropFiles(droppedFiles);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDropActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDropActive(false);
    }
  }

  function handleFileRemove(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setError("");
  }

  function handleAuditModeChange(mode: AuditMode) {
    setAuditMode(mode);
    setMessage(getDefaultPrompt(mode));
  }

  function handleTriageSelect(option: AuditTriageOption) {
    setAuditMode(option.mode);
    setAnalysisLevel(option.recommendedLevel);
    setMessage(option.prompt);
    setError("");
  }

  function handleNewAudit() {
    setMessages([]);
    setMessage(getDefaultPrompt(DEFAULT_AUDIT_MODE));
    setFiles([]);
    setAuditMode(DEFAULT_AUDIT_MODE);
    setAnalysisLevel(DEFAULT_ANALYSIS_LEVEL);
    setAuditEngine("single");
    setAuditTitle("");
    setProjectName("");
    setAuditDescription("");
    setError("");
    setActiveAuditId(null);
    setElapsedMs(0);
  }

  function createPdfSources() {
    return files.map((attachment) => {
      const url = URL.createObjectURL(attachment.file);
      pdfObjectUrlsRef.current.push(url);

      return {
        name: attachment.file.name,
        url,
      };
    });
  }

  function handleOpenAudit(item: AuditHistoryItem) {
    setActiveAuditId(item.id);
    setError(item.error ?? "");
    setAuditTitle(item.title);
    setProjectName(item.projectName);
    setAuditDescription(item.description);
    setFiles([]);
    setAuditMode(item.auditMode);
    setAnalysisLevel(item.analysisLevel);
    setMessage(getDefaultPrompt(item.auditMode));

    const userMessage: ChatMessage = {
      id: `${item.id}-request`,
      role: "user",
      content: `Auditoria registrada\n\nIdentificacao: ${item.title}\nProjeto: ${item.projectName}\nTipo: ${getAuditModeLabel(item.auditMode)}\nArquivos: ${item.fileNames.join(", ")}`,
      auditMode: item.auditMode,
    };

    setMessages(
      item.result
        ? [
            userMessage,
            {
              id: `${item.id}-result`,
              role: "assistant",
              auditId: item.id,
              content: item.result,
              auditMode: item.auditMode,
              elapsedMs: item.elapsedMs,
              report: item.report,
              pdfSources: item.pdfSources,
            },
          ]
        : [userMessage],
    );
  }

  function handleCancelAudit() {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setLoadingMode(null);
    setError("Auditoria cancelada pelo usuário.");

    if (activeAuditId) {
      void fetch(getAuditCancelEndpoint(activeAuditId), { method: "PATCH" });
      setAuditHistory((current) =>
        current.map((item) =>
          item.id === activeAuditId
            ? { ...item, status: "canceled", error: "Auditoria cancelada." }
            : item,
        ),
      );
    }
  }

  async function handleFollowupSubmit(trimmedMessage: string, report: AuditReport) {
    const questionId = crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: `${questionId}-question`,
      role: "user",
      content: trimmedMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setIsLoading(true);
    setLoadingMode("followup");
    setError("");
    setElapsedMs(0);
    startedAtRef.current = performance.now();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(getAuditChatEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          question: trimmedMessage,
          report,
          auditId: latestResult?.auditId,
          history: messages
            .filter((item) => item.role === "user" || item.role === "assistant")
            .slice(-8)
            .map((item) => ({
              role: item.role,
              content: item.content,
            })),
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "Não foi possível responder sobre a auditoria.");
      }

      const answer = payload.answer;

      setMessages((current) => [
        ...current,
        {
          id: `${questionId}-answer`,
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (requestError) {
      const followupError =
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "Pergunta cancelada pelo usuário."
          : requestError instanceof Error
            ? requestError.message
            : "Não foi possível responder sobre a auditoria.";
      setError(followupError);
    } finally {
      setIsLoading(false);
      setLoadingMode(null);
      abortControllerRef.current = null;
    }
  }

  async function handleSaveLearning() {
    const title = learningTitle.trim();
    const content = learningContent.trim();

    if (!title || !content) {
      setLearningNotice("Informe título e conteúdo para salvar.");
      return;
    }

    setIsSavingLearning(true);
    setLearningNotice("");

    try {
      const response = await fetch(getLearningsEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          type: "preference",
          scope: auditMode,
          status: "active",
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar o aprendizado.");
      }

      setLearningNotice("Aprendizado salvo e será usado nas próximas auditorias.");
      setLearningTitle("");
      setLearningContent("");
    } catch (saveError) {
      setLearningNotice(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o aprendizado.",
      );
    } finally {
      setIsSavingLearning(false);
    }
  }

  async function handleSubmit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Informe uma solicitacao para a auditoria.");
      return;
    }

    if (files.length === 0 && latestResult?.report) {
      await handleFollowupSubmit(trimmedMessage, latestResult.report);
      return;
    }

    if (files.length === 0) {
      setError("Anexe pelo menos um PDF.");
      return;
    }

    setIsLoading(true);
    setLoadingMode("audit");
    setError("");
    setElapsedMs(0);
    startedAtRef.current = performance.now();
    const auditId = crypto.randomUUID();
    setActiveAuditId(auditId);
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append("message", trimmedMessage);
    formData.append("auditMode", auditMode);
    formData.append("analysisLevel", analysisLevel);
    formData.append("auditEngine", auditEngine);
    formData.append("auditTitle", auditTitle.trim() || "Auditoria sem identificação");
    formData.append("projectName", projectName.trim() || "Projeto não informado");
    formData.append("auditDescription", auditDescription.trim());
    // Item 1 — gabarito (ground truth). Vazio quando o usuário pula.
    formData.append("gabaritoObra", gabaritoObra.trim());
    formData.append("gabaritoCentroCusto", gabaritoCentroCusto.trim());
    formData.append("gabaritoEndereco", gabaritoEndereco.trim());
    const gabaritoPref = findPrefeitura(gabaritoPrefeitura);
    formData.append("gabaritoPrefeitura", gabaritoPref?.nome ?? "");
    formData.append("gabaritoMunicipio", gabaritoPref?.municipio ?? "");
    formData.append("auditId", auditId);
    formData.append("mockMode", useMockMode ? "true" : "false");
    if (projectId) {
      formData.append("projectId", projectId);
    }
    files.forEach((attachment) => {
      formData.append("files", attachment.file);
      formData.append("fileTypes", attachment.documentType);
    });

    const userMessage: ChatMessage = {
      id: `${auditId}-request`,
      role: "user",
      content: trimmedMessage,
      auditMode,
    };

    setMessages((current) => [...current, userMessage]);
    setAuditHistory((current) => [
      {
        id: auditId,
        title: auditTitle.trim() || `Auditoria ${current.length + 1}`,
        projectName: projectName.trim() || "Projeto não informado",
        description: auditDescription.trim(),
        createdAt: new Date(),
        auditMode,
        analysisLevel,
        fileNames: files.map((item) => item.file.name),
        status: "processing",
      },
      ...current,
    ]);

    try {
      const response = await fetch(getAuditEndpoint(), {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      const payload = (await response.json()) as {
        result?: string;
        report?: AuditReport;
        error?: string;
        auditMode?: AuditMode;
        auditId?: string | null;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Não foi possível concluir a auditoria.");
      }

      const result = payload.result;
      const finalElapsedMs = performance.now() - startedAtRef.current;
      const pdfSources = createPdfSources();

      setMessages((current) => [
        ...current,
        {
          id: `${auditId}-result`,
          role: "assistant",
          auditId: payload.auditId ?? auditId,
          content: result,
          auditMode: payload.auditMode ?? auditMode,
          elapsedMs: finalElapsedMs,
          report: payload.report,
          pdfSources,
        },
      ]);
      setAuditHistory((current) =>
        current.map((item) =>
          item.id === auditId
            ? {
                ...item,
                status: "completed",
                result,
                report: payload.report,
                elapsedMs: finalElapsedMs,
                pdfSources,
              }
            : item,
        ),
      );
      setFiles([]);
      setMessage("");
      setLearningTitle("Preferência de auditoria");
      setLearningContent("");
    } catch (requestError) {
      const message =
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "Auditoria cancelada pelo usuário."
          : requestError instanceof Error
            ? requestError.message
            : "Não foi possível concluir a auditoria.";
      setError(message);
      setAuditHistory((current) =>
        current.map((item) =>
          item.id === auditId
            ? {
                ...item,
                status:
                  requestError instanceof DOMException && requestError.name === "AbortError"
                    ? "canceled"
                    : "failed",
                error: message,
              }
            : item,
        ),
      );
    } finally {
      setIsLoading(false);
      setLoadingMode(null);
      abortControllerRef.current = null;
    }
  }

  function renderDetectionCards() {
    if (files.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        {files.map((item, index) => {
          const detected = classifications[index];
          const reading = isClassifying && !detected;
          const confDot =
            detected?.confianca === "alta"
              ? "bg-[var(--status-ok)]"
              : detected?.confianca === "media"
                ? "bg-[var(--status-warning)]"
                : "bg-[var(--status-critical)]";
          const confText =
            detected?.confianca === "alta"
              ? "text-[var(--status-ok)]"
              : detected?.confianca === "media"
                ? "text-[var(--status-warning)]"
                : "text-[var(--status-critical)]";
          const fields = detected
            ? [
                { label: "Obra", value: detected.obra, mono: false },
                { label: "Município", value: detected.municipio, mono: false },
                { label: "Código", value: detected.codigo, mono: true },
                { label: "Páginas", value: detected.pageCount ? String(detected.pageCount) : "", mono: true },
              ].filter((field) => field.value)
            : [];

          return (
            <div key={item.id} className="nexodoc-file-in overflow-hidden rounded-sm border bg-card">
              <div className="flex items-center justify-between gap-3 border-b bg-[var(--nexodoc-raised)] px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileSearch className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight text-foreground">{item.file.name}</p>
                    {reading ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        lendo o documento…
                      </span>
                    ) : detected ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
                        {detected.tipoLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                {detected ? (
                  <span className={cn("flex shrink-0 items-center gap-1.5 font-mono text-[11px]", confText)}>
                    <span className={cn("size-1.5 rounded-full", confDot)} />
                    {detected.confianca}
                  </span>
                ) : null}
              </div>

              <div className="px-3.5 py-3">
                {reading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded-sm bg-[var(--nexodoc-raised)]" />
                    <div className="h-3 w-2/5 animate-pulse rounded-sm bg-[var(--nexodoc-raised)]" />
                  </div>
                ) : detected ? (
                  <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {fields.map((field) => (
                        <div key={field.label} className="min-w-0">
                          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className={cn("truncate text-sm text-foreground", field.mono && "font-mono")}>
                            {field.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {detected.precisaOcr ? (
                      <p className="mt-3 flex items-start gap-1.5 rounded-sm bg-[var(--status-warning-bg)] px-2.5 py-1.5 text-[11px] leading-4 text-[var(--status-warning)]">
                        <AlertTriangle className="mt-px size-3 shrink-0" />
                        Sem texto pesquisável (provável imagem ou prancha). Confirme o tipo em Opções avançadas.
                      </p>
                    ) : detected.sinais.length ? (
                      <p className="mt-2.5 font-mono text-[10px] leading-4 text-muted-foreground">{detected.sinais[0]}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {classifications.length > 0 && !isClassifying ? (
          <p className="px-0.5 pt-0.5 text-xs leading-5 text-muted-foreground">
            Confira os dados detectados. Algo errado? Ajuste em{" "}
            <span className="font-medium text-foreground">Opções avançadas</span>. Caso contrário, execute a auditoria.
          </p>
        ) : null}
      </div>
    );
  }

  function renderConfigDropdown() {
    const engineLabel = auditEngine === "dual" ? " · 2 IAs" : "";

    return (
      <Dropdown
        align="end"
        panelClassName="w-[300px] p-3"
        trigger={({ open, toggle }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={toggle}
            aria-expanded={open}
            disabled={isLoading}
          >
            <SlidersHorizontal className="size-4" />
            <span className="font-mono text-[11px]">
              {getAuditModeLabel(auditMode)} · {getAnalysisLevelLabel(analysisLevel)}
              {engineLabel}
            </span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        )}
      >
        {() => (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Preset</p>
              <div className="grid gap-1">
                {AUDIT_TRIAGE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected =
                    auditMode === option.mode && analysisLevel === option.recommendedLevel;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleTriageSelect(option)}
                      className={cn(
                        "flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
                        isSelected
                          ? "border-ring/60 bg-[var(--nexodoc-raised)] text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-[var(--nexodoc-raised)] hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1">{option.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{option.fileHint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2.5 border-t pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">Tipo</span>
                <div className="flex rounded-sm border bg-[var(--nexodoc-recessed)] p-0.5">
                  {(["memorial", "volume"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleAuditModeChange(mode)}
                      title={getAuditModeDescription(mode)}
                      className={cn(
                        "rounded-sm px-2.5 py-1 font-mono text-[11px] outline-none transition-colors",
                        auditMode === mode
                          ? "border border-ring/40 bg-card font-medium text-foreground"
                          : "border border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {getAuditModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">Nível</span>
                <div className="flex rounded-sm border bg-[var(--nexodoc-recessed)] p-0.5">
                  {(["standard", "deep"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setAnalysisLevel(level)}
                      title={getAnalysisLevelDescription(level)}
                      className={cn(
                        "rounded-sm px-2.5 py-1 font-mono text-[11px] outline-none transition-colors",
                        analysisLevel === level
                          ? level === "deep"
                            ? "border border-[var(--nexodoc-tertiary)]/40 bg-[var(--nexodoc-tertiary-bg)] font-medium text-[var(--nexodoc-tertiary)]"
                            : "border border-ring/40 bg-card font-medium text-foreground"
                          : "border border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {getAnalysisLevelLabel(level)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">IA</span>
                <div className="flex rounded-sm border bg-[var(--nexodoc-recessed)] p-0.5">
                  {([
                    { value: "single" as const, label: "Única", title: "Motor principal com validação padrão." },
                    { value: "dual" as const, label: "2 IAs", title: "Uma segunda IA revisa os achados antes do relatório." },
                  ]).map((engine) => (
                    <button
                      key={engine.value}
                      type="button"
                      onClick={() => setAuditEngine(engine.value)}
                      title={engine.title}
                      className={cn(
                        "rounded-sm px-2.5 py-1 font-mono text-[11px] outline-none transition-colors",
                        auditEngine === engine.value
                          ? engine.value === "dual"
                            ? "border border-primary/40 bg-primary/10 font-medium text-[var(--nexodoc-accent)]"
                            : "border border-ring/40 bg-card font-medium text-foreground"
                          : "border border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {engine.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Identificação (opcional)
              </p>
              <div className="grid gap-2">
                <input
                  value={auditTitle}
                  onChange={(event) => setAuditTitle(event.target.value)}
                  placeholder="Identificação"
                  disabled={isLoading}
                  className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs font-mono outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
                />
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Projeto"
                  disabled={isLoading}
                  className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs font-mono outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
                />
              </div>
            </div>
          </div>
        )}
      </Dropdown>
    );
  }

  function renderAuditSetup() {
    return (
      <section className="border-b bg-background px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {projectContext ? (
            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
              <span className="font-medium text-foreground">Projeto</span>
              <span className="shrink-0 font-mono text-primary">{projectContext.code}</span>
              <span className="max-w-[200px] truncate text-muted-foreground">{projectContext.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-card/70 px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">Modo independente</span>
              <button
                type="button"
                onClick={() => router.push("/projetos")}
                className="font-medium text-primary outline-none hover:underline focus-visible:underline"
              >
                Vincular projeto
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/ld")}
              disabled={isLoading}
              className="hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:underline sm:inline-flex"
            >
              <TableProperties className="size-3.5" />
              Prancha / selo → LDs
            </button>
            {renderConfigDropdown()}
          </div>
        </div>

        {files.length > 0 ? (
          <div className="mt-3 space-y-3">
            {renderDetectionCards()}
            <div className="overflow-hidden rounded-md border bg-card">
              <button
                type="button"
                onClick={() => setGabaritoOpen((value) => !value)}
                aria-expanded={gabaritoOpen}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left outline-none transition-colors hover:bg-[var(--nexodoc-raised)] focus-visible:ring-3 focus-visible:ring-ring/20"
              >
                <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Gabarito da obra
                  <span className="ml-1 font-sans normal-case text-muted-foreground/70">— opcional, aumenta a precisão</span>
                </span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", gabaritoOpen && "rotate-180")}
                />
              </button>
              {gabaritoOpen ? (
                <div className="grid gap-2 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prefeitura</span>
                    <select
                      value={gabaritoPrefeitura}
                      onChange={(event) => setGabaritoPrefeitura(event.target.value)}
                      disabled={isLoading}
                      className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs outline-none transition-[border-color] focus:border-ring"
                    >
                      <option value="">Selecione…</option>
                      {PREFEITURAS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                      <option value={PREFEITURA_OUTRA_ID}>Outra…</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Nome da obra (capa)</span>
                    <input
                      value={gabaritoObra}
                      onChange={(event) => setGabaritoObra(event.target.value)}
                      placeholder="Como consta na capa"
                      disabled={isLoading}
                      className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Centro de custo</span>
                    <input
                      value={gabaritoCentroCusto}
                      onChange={(event) => setGabaritoCentroCusto(event.target.value)}
                      placeholder="Código do projeto"
                      disabled={isLoading}
                      className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs font-mono outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Endereço</span>
                    <input
                      value={gabaritoEndereco}
                      onChange={(event) => setGabaritoEndereco(event.target.value)}
                      placeholder="Logradouro da obra"
                      disabled={isLoading}
                      className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderEmptyChat() {
    return (
      <section
        className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div
          className={cn(
            "nexodoc-enter w-full max-w-3xl",
            isDropActive && "scale-[1.01]",
          )}
        >
          <div className={cn(
            "mx-auto w-full max-w-[560px] rounded-sm border border-dashed px-8 py-11 text-center transition-[border-color,background-color]",
            isDropActive
              ? "border-primary bg-primary/5"
              : "border-input/60 hover:border-ring/40",
          )}>
            <div className="mx-auto flex size-11 items-center justify-center rounded-sm border border-primary/20 bg-primary/5 text-primary">
              <FileSearch className="size-5" />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
              Solte o documento para auditar
            </h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-6 text-muted-foreground">
              Arraste um PDF técnico para esta área. A IA identifica a obra, o município e o tipo do documento; você confere e executa.
            </p>
          </div>

          <ol className="mx-auto mt-6 flex max-w-[560px] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="text-primary">01</span>
              <span className="text-foreground">Solte o PDF</span>
            </li>
            <span aria-hidden className="text-border">—</span>
            <li className="flex items-center gap-1.5">
              <span className="text-primary">02</span>
              <span className="text-foreground">A IA identifica</span>
            </li>
            <span aria-hidden className="text-border">—</span>
            <li className="flex items-center gap-1.5">
              <span className="text-primary">03</span>
              <span className="text-foreground">Confira e audite</span>
            </li>
          </ol>
        </div>
      </section>
    );
  }

  function renderErrorState() {
    if (!error) {
      return null;
    }

    const isValidationError =
      error.includes("PDF") ||
      error.includes("solicitacao") ||
      error.includes("solicitação") ||
      error.includes("25 MB") ||
      error.includes("primeiros");

    return (
      <div className="nexodoc-enter rounded-sm border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-xs leading-5 text-destructive/70">
              {isValidationError
                ? "Revise arquivos anexados, limite de 5 PDFs e solicitação antes de enviar."
                : "A auditoria não foi concluída. Você pode tentar novamente ou cancelar."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-background text-foreground">
      {sidebarOpen ? (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 lg:hidden",
            sidebarClosing ? "backdrop-fade-out" : "backdrop-fade-in",
          )}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={cn(
          "h-dvh w-[236px] shrink-0 border-r bg-[var(--nexodoc-panel)] px-3 py-5",
          sidebarOpen
            ? cn(
                "fixed inset-y-0 left-0 z-50 flex flex-col lg:relative lg:z-auto lg:flex lg:flex-col",
                sidebarClosing ? "sidebar-drawer-closing" : "sidebar-drawer-open",
              )
            : "hidden lg:flex lg:flex-col",
        )}
      >
        <div className="flex items-center gap-2.5 px-1">
          <Image
            src="/assets/logo.svg"
            alt="NexoDoc"
            width={34}
            height={34}
            priority
            className="size-8 rounded-sm object-cover"
          />
          <div>
            <h1 className="font-mono text-sm font-semibold tracking-normal">NexoDoc</h1>
            <p className="font-mono text-[11px] text-muted-foreground">Auditoria documental</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 min-h-7 w-7 lg:hidden"
            onClick={closeSidebar}
            aria-label="Fechar menu lateral"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="mt-4 space-y-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => window.location.assign("/")}
          >
            <LayoutGrid className="size-3.5" />
            Painel de módulos
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start h-9 text-xs"
            onClick={handleNewAudit}
          >
            <RotateCcw className="size-3.5" />
            Nova auditoria
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => window.location.assign("/ld")}
          >
            <TableProperties className="size-3.5" />
            Criador de LDs
          </Button>
          {isAdmin ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setAdminOpen((value) => !value)}
                aria-expanded={adminOpen}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
              >
                <span className="flex items-center gap-1.5">
                  <Gauge className="size-3" />
                  Admin
                </span>
                <ChevronDown className={cn("size-3.5 transition-transform", adminOpen && "rotate-180")} />
              </button>
              {adminOpen ? (
                <div className="mt-1 space-y-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start h-9 text-xs"
                    onClick={() => window.location.assign("/admin")}
                  >
                    <Gauge className="size-3.5" />
                    Painel admin
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => window.open("/admin/usage", "_blank", "noopener,noreferrer")}
                  >
                    <Gauge className="size-3.5" />
                    Uso e custos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => window.open("/admin/audits", "_blank", "noopener,noreferrer")}
                  >
                    <ListChecks className="size-3.5" />
                    Histórico admin
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => window.open("/admin/quality", "_blank", "noopener,noreferrer")}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Qualidade
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => window.open("/admin/config", "_blank", "noopener,noreferrer")}
                  >
                    <Gauge className="size-3.5" />
                    Configurações
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-1 text-[11px]">
          {historyStatus ? (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono",
                historyStatus.connected
                  ? "border-[var(--status-ok)]/25 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
                  : "border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {historyStatus.connected ? "Histórico ativo" : "Histórico local"}
            </div>
          ) : null}

          {qualitySummary?.enabled ? (
            <div className="rounded-sm px-2 py-1 font-mono text-muted-foreground">
              {qualitySummary.confirmed} corretos · {qualitySummary.falsePositive} FP · {qualitySummary.missingFinding} ausentes
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Files className="size-3 text-primary" />
            Atual
          </div>
          <div className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground">
            <p className="truncate">{projectName || "Projeto não informado"}</p>
            <p className="truncate">{getAuditModeLabel(auditMode)} · {getAnalysisLevelLabel(analysisLevel)}</p>
            <p>{displayedFileCount} arquivo(s)</p>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t pt-3">
          <div className="flex items-center justify-between gap-2 px-0.5 font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Histórico
            {auditHistory.length > 0 ? (
              <span className="rounded-sm border bg-[var(--nexodoc-recessed)] px-1 py-px text-[10px] text-muted-foreground">
                {auditHistory.length}
              </span>
            ) : null}
          </div>
          <div className="mt-2 space-y-1">
            {auditHistory.length === 0 ? (
              <p className="px-0.5 font-mono text-[11px] text-muted-foreground/60">
                {historyStatus?.connected
                  ? "Nenhuma auditoria salva."
                  : "Histórico persistente inativo."}
              </p>
            ) : (
              auditHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenAudit(item)}
                  className="w-full rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-left font-mono text-[11px] outline-none transition-[border-color,background-color] hover:border-border hover:bg-[var(--nexodoc-raised)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                >
                  <span className="block truncate font-medium text-foreground">
                    {getHistoryItemTitle(item)}
                  </span>
                  <span className="mt-0.5 block truncate text-muted-foreground/70">
                    {getHistoryItemDetail(item)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="shrink-0 border-t pt-3 pb-1">
          <div className="flex items-center gap-2.5">
            {userImage ? (
              <Image
                src={userImage}
                alt=""
                width={28}
                height={28}
                className="size-7 rounded-full border border-border"
              />
            ) : (
              <div className="flex size-7 items-center justify-center rounded-full border border-border bg-[var(--nexodoc-recessed)] text-[11px] font-mono font-medium text-primary">
                {getUserInitials(userName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[11px] font-medium text-foreground">
                {userName ?? "Usuário"}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {userEmail ?? ""}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sair"
              onClick={() => void signOut({ redirectTo: "/login" })}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--nexodoc-raised)] hover:text-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <section className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2.5 lg:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 min-h-8 w-8"
              onClick={openSidebar}
              aria-label="Abrir menu lateral"
            >
              <Menu className="size-4" />
            </Button>
            <Image
              src="/assets/logo.svg"
              alt=""
              width={22}
              height={22}
              priority
              className="size-[22px] rounded-sm object-cover"
            />
            <span className="font-mono text-sm font-semibold">NexoDoc</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 min-h-8 w-8"
              onClick={() => window.location.assign("/")}
              aria-label="Voltar ao painel de módulos"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleNewAudit}>
              <RotateCcw className="size-4" />
              Nova
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={() => window.location.assign("/admin")}
              >
                <Gauge className="size-4" />
                Admin
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 min-h-8 w-8"
              onClick={() => setDetailsOpen(true)}
              aria-label="Abrir painel de detalhes"
            >
              <PanelRight className="size-4" />
            </Button>
            <SignOutButton compact />
          </div>
        </header>

        <div className="hidden items-center justify-between gap-3 border-b bg-card px-5 py-2 lg:flex">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-medium",
                statusToneClass,
              )}
            >
              {statusIsCritical ? (
                <AlertTriangle className="size-3" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              {latestStatus}
            </span>
            {latestFindingCount > 0 ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {latestFindingCount} achado(s)
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant={detailsOpen ? "secondary" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setDetailsOpen((value) => !value)}
          >
            <PanelRight className="size-4" />
            Detalhes
          </Button>
        </div>

        {!isLoading && messages.length === 0 ? renderAuditSetup() : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div
            className={cn(
              "mx-auto flex min-h-full flex-col gap-3",
              isLoading ? "max-w-[760px]" : "max-w-5xl",
            )}
          >
            {messages.length === 0 && !isLoading ? (
              renderEmptyChat()
            ) : (
              messages.map((item) => (
                <div key={item.id}>
                  {item.role === "assistant" && (item.report || item.elapsedMs || item.pdfSources) ? (
                    <AuditResult
                      content={item.content}
                      auditId={item.auditId}
                      elapsedMs={item.elapsedMs}
                      report={item.report}
                      pdfSources={item.pdfSources}
                    />
                  ) : (
                    <MessageBubble role={item.role} content={item.content} />
                  )}
                </div>
              ))
            )}

            {isLoading && loadingMode === "audit" ? (
              <div className="flex min-h-[240px] flex-1 items-center justify-center py-8">
                <AuditProgress
                  fileCount={files.length}
                  auditMode={auditMode}
                  elapsedMs={elapsedMs}
                  onCancel={handleCancelAudit}
                />
              </div>
            ) : null}

            {isLoading && loadingMode === "followup" ? (
              <div className="nexodoc-enter rounded-md border bg-card px-4 py-3 font-mono text-sm text-muted-foreground">
                Interpretando o relatório da auditoria...
              </div>
            ) : null}

            {renderErrorState()}
            <div ref={bottomRef} />
          </div>
        </div>

        <Composer
          message={message}
          files={files}
          isLoading={isLoading}
          setupComplete={setupComplete}
          followupEnabled={canAskAboutAudit}
          onMessageChange={setMessage}
          onFilesAdd={handleFilesAdd}
          onFileRemove={handleFileRemove}
          onSubmit={handleSubmit}
        />
      </section>

      {detailsOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-fade-in xl:hidden"
          onClick={() => setDetailsOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={cn(
          // Em telas largas (xl) encaixa como coluna no fluxo, empurrando o
          // conteúdo. Abaixo de xl vira drawer sobreposto (fixed) com backdrop.
          "z-50 flex h-dvh w-[340px] max-w-[90vw] shrink-0 flex-col overflow-y-auto border-l bg-[var(--nexodoc-panel)] p-4",
          "fixed inset-y-0 right-0 transition-transform duration-200 ease-out xl:static xl:z-auto xl:max-w-none xl:transition-none",
          detailsOpen ? "translate-x-0" : "pointer-events-none translate-x-full xl:hidden",
        )}
        aria-hidden={!detailsOpen}
      >
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <div className={`rounded-sm border px-2 py-1 font-mono text-[11px] font-medium ${statusToneClass}`}>
              {statusIsCritical ? (
                <AlertTriangle className="mr-1 inline size-3" />
              ) : (
                <CheckCircle2 className="mr-1 inline size-3" />
              )}
              {latestStatus}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 min-h-7 w-7"
            onClick={() => setDetailsOpen(false)}
            aria-label="Fechar painel de detalhes"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: "Tipo", value: getAuditModeLabel(auditMode) },
            { label: "Nível", value: getAnalysisLevelLabel(latestResult?.report?.runtime?.nivel_analise ?? analysisLevel) },
            {
              label: "IA",
              value: latestResult?.report?.runtime?.motor_auditoria === "dual" || auditEngine === "dual" ? "2 IAs" : "Única",
              tone: latestResult?.report?.runtime?.motor_auditoria === "dual" || auditEngine === "dual" ? "text-[var(--nexodoc-accent)]" : undefined,
            },
            { label: "Tempo", value: isLoading ? formatSeconds(elapsedMs) : formatSeconds(latestResult?.elapsedMs) },
            { label: "PDFs", value: displayedFileCount || "-" },
            { label: "Achados", value: String(latestFindingCount), tone: latestFindingCount > 0 ? "text-[var(--nexodoc-tertiary)]" : undefined },
          ].map((metric) => (
            <div key={metric.label} className="rounded-sm border bg-card px-3 py-2.5">
              <p className="font-mono text-[11px] text-muted-foreground">{metric.label}</p>
              <p className={cn("mt-0.5 font-mono text-sm font-medium text-foreground", metric.tone)}>{metric.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-3 rounded-sm border border-[var(--nexodoc-tertiary)]/15 bg-[var(--nexodoc-tertiary-bg)] p-3">
          <div className="flex items-center gap-2">
            <Wrench className="size-3.5 text-[var(--nexodoc-tertiary)]" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--nexodoc-tertiary)]">Próxima ação</p>
          </div>
          <p className="mt-1.5 text-sm leading-5 text-foreground">
            {latestRecommendedAction}
          </p>
          {latestResult?.report ? (
            <div className="mt-3 border-t pt-3">
              <div className="mb-2 flex items-center gap-2">
                <BookmarkPlus className="size-3.5 text-primary" />
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Aprendizado global</p>
              </div>
              <div className="grid gap-2">
                <input
                  value={learningTitle}
                  onChange={(event) => setLearningTitle(event.target.value)}
                  placeholder="Título do aprendizado"
                  className="h-9 rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
                />
                <Textarea
                  value={learningContent}
                  onChange={(event) => setLearningContent(event.target.value)}
                  placeholder="Ex.: Sempre tratar citação de outra obra como achado crítico..."
                  className="min-h-20 resize-none bg-[var(--nexodoc-recessed)] text-sm leading-5 shadow-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleSaveLearning}
                  disabled={isSavingLearning}
                >
                  <BookmarkPlus className="size-3.5" />
                  {isSavingLearning ? "Salvando" : "Salvar"}
                </Button>
                {learningNotice ? (
                  <p className="font-mono text-xs text-muted-foreground">{learningNotice}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-sm border bg-card p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Projeto</p>
          <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
            {latestProject || projectName || "Aguardando auditoria. Envie os PDFs para iniciar."}
          </pre>
        </section>
      </aside>
      <KeyboardShortcutsHelp />
    </main>
  );
}
