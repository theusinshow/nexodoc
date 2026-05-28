"use client";

import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileSearch,
  Files,
  Gauge,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PlayCircle,
  RotateCcw,
  ScrollText,
  TableProperties,
  TestTube2,
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
import { DashboardShortcuts } from "@/components/dashboard-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { MessageBubble } from "@/components/message-bubble";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
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
import { getDemoAuditResult } from "@/lib/audit-demo-data";
import type { AuditFileAttachment, DocumentType } from "@/lib/document-types";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";

type ChatWindowProps = {
  isMockMode?: boolean;
  allowDemoMode?: boolean;
  isAdmin?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
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

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const DEMO_FILE_NAMES: Record<AuditMode, string[]> = {
  memorial: ["Memorial descritivo.pdf"],
  volume: ["Capa e separatriz.pdf", "LD arquitetura.pdf", "Pranchas arquitetura.pdf"],
};

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
  if (mode === "volume") {
    return "Cheque o volume de projeto. Compare capa, separatriz, LDs e pranchas, com foco em LD x pranchas, selos, revisões, títulos, disciplina, volume e tomo.";
  }

  return "Cheque o memorial descritivo. Verifique identificação do projeto, coerência interna do texto e sinais de reaproveitamento de outro projeto.";
}

function getDemoProjectName(mode: AuditMode) {
  return mode === "volume"
    ? "Escola Municipal Exemplo - Volume Arquitetura"
    : "Escola Municipal Exemplo - Memorial";
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
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState(getDefaultPrompt(DEFAULT_AUDIT_MODE));
  const [files, setFiles] = useState<AuditFileAttachment[]>([]);
  const [auditMode, setAuditMode] = useState<AuditMode>(DEFAULT_AUDIT_MODE);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>(DEFAULT_ANALYSIS_LEVEL);
  const [auditTitle, setAuditTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [auditDescription, setAuditDescription] = useState("");
  const [useMockMode, setUseMockMode] = useState(isMockMode && allowDemoMode);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"audit" | "followup" | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [auditHistory, setAuditHistory] = useState<AuditHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<AuditHistoryStatus | null>(null);
  const [qualitySummary, setQualitySummary] = useState<QualitySummary | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("summary");
  const [isDropActive, setIsDropActive] = useState(false);
  const [learningTitle, setLearningTitle] = useState("");
  const [learningContent, setLearningContent] = useState("");
  const [learningNotice, setLearningNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);

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
  const latestFindings = extractSection(
    latestResult?.content,
    "6\\.\\s*Achados encontrados|6\\.\\s*Incongruencias relevantes encontradas|6\\.\\s*Incongruências relevantes encontradas",
  );
  const latestReport =
    latestResult?.content ?? "Nenhuma auditoria concluída nesta sessão.";
  const latestRecommendedAction =
    extractFirstRecommendedAction(latestResult?.content) ||
    (latestResult
      ? "Revisar achados, confirmar evidências e registrar decisão técnica."
      : "Carregue a demo local ou envie uma auditoria para iniciar a inspeção.");
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

  function handleNewAudit() {
    setMessages([]);
    setMessage(getDefaultPrompt(DEFAULT_AUDIT_MODE));
    setFiles([]);
    setAuditMode(DEFAULT_AUDIT_MODE);
    setAnalysisLevel(DEFAULT_ANALYSIS_LEVEL);
    setAuditTitle("");
    setProjectName("");
    setAuditDescription("");
    setError("");
    setActiveAuditId(null);
    setElapsedMs(0);
  }

  function handleLoadDemoAudit() {
    const demoId = crypto.randomUUID();
    const demoResult = getDemoAuditResult(auditMode);
    const fileNames = DEMO_FILE_NAMES[auditMode];
    const title = `Demo ${getAuditModeLabel(auditMode)}`;
    const demoProjectName = getDemoProjectName(auditMode);
    const demoDescription = "Cenário demonstrativo local, sem chamada de API.";
    const demoElapsedMs = auditMode === "volume" ? 18400 : 9200;
    const userMessage: ChatMessage = {
      id: `${demoId}-request`,
      role: "user",
      content: `${getDefaultPrompt(auditMode)}\n\nIdentificação: ${title}\nProjeto: ${demoProjectName}\nTipo: ${getAuditModeLabel(auditMode)}\nArquivos: ${fileNames.join(", ")}`,
      auditMode,
    };
    const assistantMessage: ChatMessage = {
      id: `${demoId}-result`,
      role: "assistant",
      content: demoResult,
      auditMode,
      elapsedMs: demoElapsedMs,
    };

    setAuditTitle(title);
    setProjectName(demoProjectName);
    setAuditDescription(demoDescription);
    setFiles([]);
    setError("");
    setElapsedMs(0);
    setActiveAuditId(demoId);
    setMessages([userMessage, assistantMessage]);
    setAuditHistory((current) => [
      {
        id: demoId,
        title,
        projectName: demoProjectName,
        description: demoDescription,
        createdAt: new Date(),
        auditMode,
        analysisLevel,
        fileNames,
        status: "completed",
        result: demoResult,
        elapsedMs: demoElapsedMs,
      },
      ...current,
    ]);
    setInspectorTab("summary");
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
    formData.append("auditTitle", auditTitle.trim() || "Auditoria sem identificação");
    formData.append("projectName", projectName.trim() || "Projeto não informado");
    formData.append("auditDescription", auditDescription.trim());
    formData.append("auditId", auditId);
    formData.append("mockMode", useMockMode ? "true" : "false");
    files.forEach((attachment) => {
      formData.append("files", attachment.file);
      formData.append("fileTypes", attachment.documentType);
    });

    const userMessage: ChatMessage = {
      id: `${auditId}-request`,
      role: "user",
      content: `${trimmedMessage}\n\nIdentificação: ${auditTitle || "Auditoria sem identificação"}\nProjeto: ${projectName || "Projeto não informado"}\nTipo: ${getAuditModeLabel(auditMode)}\nArquivos: ${files.map((item) => item.file.name).join(", ")}`,
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

  function renderAuditContext() {
    return (
      <section className="border-b bg-background px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={auditTitle}
              onChange={(event) => setAuditTitle(event.target.value)}
              placeholder="Identificação"
              disabled={isLoading}
              className="h-8 w-[140px] rounded-sm border border-input bg-transparent px-2 text-xs font-mono outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
            />
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Projeto"
              disabled={isLoading}
              className="h-8 w-[160px] rounded-sm border border-input bg-transparent px-2 text-xs font-mono outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-ring"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium text-muted-foreground whitespace-nowrap">Tipo</span>
              <div className="flex rounded-sm border bg-[var(--nexodoc-recessed)] p-0.5">
                {(["memorial", "volume"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleAuditModeChange(mode)}
                    className={cn(
                      "rounded-sm px-3 py-1.5 font-mono text-xs outline-none transition-colors",
                      auditMode === mode
                        ? "border border-ring/40 bg-card font-medium text-foreground"
                        : "border border-transparent text-muted-foreground hover:text-foreground",
                    )}
                    title={getAuditModeDescription(mode)}
                  >
                    {getAuditModeLabel(mode)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium text-muted-foreground whitespace-nowrap">Nível</span>
              <div className="flex rounded-sm border bg-[var(--nexodoc-recessed)] p-0.5">
                {(["standard", "deep"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setAnalysisLevel(level)}
                    className={cn(
                      "rounded-sm px-3 py-1.5 font-mono text-xs outline-none transition-colors",
                      analysisLevel === level
                        ? level === "deep"
                          ? "border border-[var(--nexodoc-tertiary)]/40 bg-[var(--nexodoc-tertiary-bg)] font-medium text-[var(--nexodoc-tertiary)]"
                          : "border border-ring/40 bg-card font-medium text-foreground"
                        : "border border-transparent text-muted-foreground hover:text-foreground",
                    )}
                    title={getAnalysisLevelDescription(level)}
                  >
                    {getAnalysisLevelLabel(level)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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
            "mx-auto w-full max-w-[680px] rounded-sm border border-dashed px-8 py-10 text-center transition-[border-color,background-color]",
            isDropActive
              ? "border-primary bg-primary/5"
              : "border-input/60 hover:border-ring/50",
          )}>
            <div className="mx-auto flex size-12 items-center justify-center rounded-sm border border-primary/15 bg-primary/5 text-primary">
              <FileSearch className="size-6" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Nova auditoria documental</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Anexe PDFs, escolha o tipo de auditoria e solicite a análise.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              {[
                ["01", "Anexe os PDFs"],
                ["02", "Escolha o tipo"],
                ["03", "Execute e revise"],
              ].map(([num, title]) => (
                <div key={num} className="space-y-1">
                  <span className="block font-mono text-xs text-primary">{num}</span>
                  <span className="block font-medium text-foreground">{title}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleLoadDemoAudit}>
                <PlayCircle className="size-4" />
                Demo local
              </Button>
            </div>
          </div>

          <div className="mt-6 mx-auto max-w-[680px]">
            <div className="flex justify-start">
              <article className="nexodoc-message-in max-w-[min(680px,100%)] rounded-sm border border-border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
                Olá! Sou o assistente de auditoria documental do NexoDoc. Anexe os PDFs do seu projeto, escolha entre Memorial ou Volume, e eu vou analisar a coerência, identificar incongruências e sugerir correções.
              </article>
            </div>
          </div>
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
                : "A auditoria não foi concluída. Você pode tentar novamente, cancelar ou carregar a demo local."}
            </p>
            {!isValidationError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-8 border-destructive/25 text-destructive hover:bg-destructive/10"
                onClick={handleLoadDemoAudit}
              >
                <PlayCircle className="size-4" />
                Ver demo local
              </Button>
            ) : null}
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
            <>
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
            </>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start h-9 text-xs"
            onClick={handleLoadDemoAudit}
          >
            <PlayCircle className="size-3.5" />
            Demo local
          </Button>
        </div>

        {allowDemoMode ? (
          <button
            type="button"
            aria-pressed={useMockMode}
            onClick={() => setUseMockMode((current) => !current)}
            className="mt-3 flex w-full items-center justify-between rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-left font-mono text-[11px] outline-none transition-[border-color,background-color] hover:border-border hover:bg-[var(--nexodoc-raised)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <span className="flex items-center gap-1.5">
              <TestTube2 className="size-3.5 text-[var(--nexodoc-tertiary)]" />
              <span>
                <span className="font-medium text-foreground">Modo demo</span>
              </span>
            </span>
            <span
              className={cn(
                "h-4 w-8 rounded-full border p-px transition-colors",
                useMockMode ? "border-[var(--nexodoc-tertiary-strong)]/50 bg-[var(--nexodoc-tertiary-strong)]/60" : "bg-[var(--nexodoc-recessed)]",
              )}
            >
              <span
                className={cn(
                  "block size-3 rounded-full bg-foreground transition-transform",
                  useMockMode && "translate-x-4",
                )}
              />
            </span>
          </button>
        ) : null}

        <div className="mt-3 space-y-1 text-[11px]">
          {isMockMode ? (
            <div className="flex items-center gap-1.5 rounded-sm border border-[var(--nexodoc-tertiary)]/25 bg-[var(--nexodoc-tertiary-bg)] px-2 py-1 font-mono text-[var(--nexodoc-tertiary)]">
              <span className="size-1.5 rounded-full bg-current" />
              Mock ativo
            </div>
          ) : null}

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
            {allowDemoMode ? (
              <Button
                type="button"
                aria-pressed={useMockMode}
                variant={useMockMode ? "secondary" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setUseMockMode((current) => !current)}
              >
                <TestTube2 className="size-4" />
                Demo
              </Button>
            ) : null}
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
            <SignOutButton compact />
          </div>
        </header>

        {!isLoading ? renderAuditContext() : null}

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

      <aside className="hidden h-dvh w-[320px] shrink-0 border-l bg-[var(--nexodoc-panel)] p-4 xl:flex xl:flex-col">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Painel</p>
            <h2 className="mt-0.5 text-base font-semibold">Controle</h2>
          </div>
          <div className={`rounded-sm border px-2 py-1 font-mono text-[11px] font-medium ${statusToneClass}`}>
            {statusIsCritical ? (
              <AlertTriangle className="mr-1 inline size-3" />
            ) : (
              <CheckCircle2 className="mr-1 inline size-3" />
            )}
            {latestStatus}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: "Tipo", value: getAuditModeLabel(auditMode) },
            { label: "Nível", value: getAnalysisLevelLabel(latestResult?.report?.runtime?.nivel_analise ?? analysisLevel) },
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
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setInspectorTab("findings")}
            >
              Ver achados
            </Button>
            {latestResult?.report ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleLoadDemoAudit}
              >
                Demo local
              </Button>
            ) : null}
          </div>
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

        <div className="mt-4 grid grid-cols-3 rounded-sm border bg-[var(--nexodoc-recessed)] p-0.5 font-mono text-xs">
          {[
            { value: "summary" as const, label: "Resumo" },
            { value: "findings" as const, label: "Achados" },
            { value: "report" as const, label: "Relatório" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setInspectorTab(tab.value)}
              className={cn(
                "rounded-sm px-2 py-2 outline-none transition-[background-color,border-color,color]",
                inspectorTab === tab.value
                  ? "border border-ring/35 bg-card font-medium text-foreground"
                  : "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:border-ring",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-sm border bg-card p-3 text-sm leading-6">
          {inspectorTab === "summary" ? (
            <div className="space-y-3">
              <section>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Projeto</p>
                <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm">
                  {latestProject || projectName || "Aguardando auditoria."}
                </pre>
              </section>
              <section className="border-t pt-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Próxima ação</p>
                <p className="mt-1.5 text-muted-foreground">
                  {latestResult
                    ? "Revise achados por arquivo e valide os documentos citados."
                    : "Siga o passo a passo e envie os PDFs."}
                </p>
              </section>
            </div>
          ) : null}

          {inspectorTab === "findings" ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="size-3.5 text-primary" />
                <p className="font-medium">Incongruências</p>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                {latestFindings || "Nenhum achado estruturado disponível ainda."}
              </pre>
            </div>
          ) : null}

          {inspectorTab === "report" ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ScrollText className="size-3.5 text-primary" />
                <p className="font-medium">Relatório completo</p>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                {latestReport}
              </pre>
            </div>
          ) : null}
        </div>
      </aside>
      <KeyboardShortcutsHelp />
    </main>
  );
}
