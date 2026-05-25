"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  Files,
  Gauge,
  ListChecks,
  RotateCcw,
  ScrollText,
  TestTube2,
} from "lucide-react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { AuditProgress } from "@/components/audit-progress";
import { AuditResult, type AuditPdfSource } from "@/components/audit-result";
import { Composer } from "@/components/composer";
import { MessageBubble } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AuditReport } from "@/lib/audit-report";
import {
  DEFAULT_AUDIT_MODE,
  getAuditModeDescription,
  getAuditModeLabel,
  type AuditMode,
} from "@/lib/audit-mode";
import type { AuditFileAttachment, DocumentType } from "@/lib/document-types";
import { cn } from "@/lib/utils";

type ChatWindowProps = {
  isMockMode?: boolean;
  allowDemoMode?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  fileNames: string[];
  status: "processing" | "completed" | "failed" | "canceled";
  result?: string;
  report?: AuditReport;
  elapsedMs?: number;
  error?: string;
  pdfSources?: AuditPdfSource[];
};

type InspectorTab = "summary" | "findings" | "report";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function getAuditEndpoint() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  return apiUrl ? `${apiUrl}/api/audit` : "/api/audit";
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
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState(getDefaultPrompt(DEFAULT_AUDIT_MODE));
  const [files, setFiles] = useState<AuditFileAttachment[]>([]);
  const [auditMode, setAuditMode] = useState<AuditMode>(DEFAULT_AUDIT_MODE);
  const [auditTitle, setAuditTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [auditDescription, setAuditDescription] = useState("");
  const [useMockMode, setUseMockMode] = useState(isMockMode && allowDemoMode);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [auditHistory, setAuditHistory] = useState<AuditHistoryItem[]>([]);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("summary");
  const [isDropActive, setIsDropActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const pdfObjectUrlsRef = useRef<string[]>([]);

  const latestResult = useMemo(() => {
    return [...messages].reverse().find((item) => item.role === "assistant");
  }, [messages]);
  const latestStatus = getStatusFromResult(latestResult?.content);
  const latestFindingCount =
    getReportFindingCount(latestResult?.report) || getFindingCount(latestResult?.content);
  const latestProject = extractSection(
    latestResult?.content,
    "1\\.\\s*Projeto analisado",
  );
  const latestFindings = extractSection(
    latestResult?.content,
    "6\\.\\s*Incongruencias relevantes encontradas|6\\.\\s*Incongruências relevantes encontradas",
  );
  const latestReport =
    latestResult?.content ?? "Nenhuma auditoria concluída nesta sessão.";
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
    "h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:opacity-60";

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

  async function handleSubmit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Informe uma solicitacao para a auditoria.");
      return;
    }

    if (files.length === 0) {
      setError("Anexe pelo menos um PDF.");
      return;
    }

    setIsLoading(true);
    setError("");
    setElapsedMs(0);
    startedAtRef.current = performance.now();
    const auditId = crypto.randomUUID();
    setActiveAuditId(auditId);
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append("message", trimmedMessage);
    formData.append("auditMode", auditMode);
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
      abortControllerRef.current = null;
    }
  }

  function renderAuditContext() {
    return (
      <section className="border-b bg-card px-4 py-4 sm:px-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_minmax(300px,390px)] xl:items-end">
          <div className="grid min-w-0 gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
            <label className="grid gap-1.5 text-xs">
              <span className="font-mono font-medium text-muted-foreground">Identificacao</span>
              <input
                value={auditTitle}
                onChange={(event) => setAuditTitle(event.target.value)}
                placeholder="Opcional"
                disabled={isLoading}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1.5 text-xs">
              <span className="font-mono font-medium text-muted-foreground">Projeto</span>
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Nome do projeto"
                disabled={isLoading}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1.5 text-xs">
              <span className="font-mono font-medium text-muted-foreground">Descricao</span>
              <input
                value={auditDescription}
                onChange={(event) => setAuditDescription(event.target.value)}
                placeholder="Opcional"
                disabled={isLoading}
                className={fieldClass}
              />
            </label>
          </div>

          <div className="min-w-0">
            <div className="grid grid-cols-2 rounded-md border bg-[var(--nexodoc-recessed)] p-1 font-mono text-sm">
              {(["memorial", "volume"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleAuditModeChange(mode)}
                  className={
                    auditMode === mode
                      ? "rounded-md border border-border bg-card px-3 py-2.5 font-medium text-foreground shadow-[var(--shadow-subtle)]"
                      : "rounded-md border border-transparent px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  }
                  title={getAuditModeDescription(mode)}
                >
                  {getAuditModeLabel(mode)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderEmptyChat() {
    return (
      <section
        className="grid min-h-[240px] flex-1 place-items-center px-4 py-8"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div
          className={cn(
            "grid w-full max-w-xl place-items-center rounded-md border border-dashed bg-card px-8 py-12 text-center transition-[border-color,background-color]",
            isDropActive
              ? "border-primary bg-primary/10 text-foreground"
              : "border-input hover:border-ring",
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-md border border-primary/15 bg-primary/8 text-primary">
            <FileSearch className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Nova auditoria documental</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Arraste PDFs para esta area ou anexe documentos no campo abaixo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden h-dvh w-64 shrink-0 border-r bg-[var(--nexodoc-panel)] px-4 py-5 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-primary/15 bg-card text-primary">
            <FileSearch className="size-5" />
          </div>
          <div>
            <h1 className="font-mono text-base font-semibold tracking-normal">NexoDoc</h1>
            <p className="font-mono text-xs text-muted-foreground">Auditoria documental</p>
          </div>
        </div>

        {isMockMode ? (
          <div className="mt-4 rounded-md border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)]/80 px-3 py-2 font-mono text-xs text-[var(--status-warning)]">
            Mock ativo
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="mt-6 justify-start"
          onClick={handleNewAudit}
        >
          <RotateCcw />
          Nova auditoria
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 justify-start text-muted-foreground hover:text-foreground"
          onClick={() => window.open("/admin/usage", "_blank", "noopener,noreferrer")}
        >
          <Gauge />
          Uso e custos
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-1 justify-start text-muted-foreground hover:text-foreground"
          onClick={() => window.open("/admin/audits", "_blank", "noopener,noreferrer")}
        >
          <ListChecks />
          Histórico admin
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-1 justify-start text-muted-foreground hover:text-foreground"
          onClick={() => window.open("/admin/config", "_blank", "noopener,noreferrer")}
        >
          <Gauge />
          Configurações
        </Button>

        {allowDemoMode ? (
          <button
            type="button"
            aria-pressed={useMockMode}
            onClick={() => setUseMockMode((current) => !current)}
            className="mt-5 flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left font-mono text-xs transition-colors hover:border-ring hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <TestTube2 className="size-4 text-primary" />
              <span>
                <span className="block font-medium text-foreground">Modo demo</span>
                <span className="text-muted-foreground">Sem consumir tokens</span>
              </span>
            </span>
            <span
              className={cn(
                "h-5 w-9 rounded-full border p-0.5 transition-colors",
                useMockMode ? "border-primary/50 bg-primary/70" : "bg-[var(--nexodoc-recessed)]",
              )}
            >
              <span
                className={cn(
                  "block size-3.5 rounded-full bg-foreground transition-transform",
                  useMockMode && "translate-x-4",
                )}
              />
            </span>
          </button>
        ) : null}

        <div className="mt-6 border-t pt-5">
          <div className="flex items-center gap-2 font-mono text-sm font-medium">
            <Files className="size-4 text-primary" />
            Atual
          </div>
          <div className="mt-3 space-y-2 font-mono text-xs text-muted-foreground">
            <p>{projectName || "Projeto não informado"}</p>
            <p>{getAuditModeLabel(auditMode)}</p>
            <p>{displayedFileCount} arquivo(s)</p>
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto border-t pt-5">
          <div className="flex items-center gap-2 font-mono text-sm font-medium">
            <Clock3 className="size-4 text-primary" />
            Histórico
          </div>
          <div className="mt-3 space-y-2">
            {auditHistory.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">Sem auditorias.</p>
            ) : (
              auditHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenAudit(item)}
                  className="w-full rounded-md border bg-card px-3 py-2.5 text-left font-mono text-xs transition-colors hover:border-ring hover:bg-accent"
                >
                  <span className="block truncate font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {getAuditModeLabel(item.auditMode)} · {item.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <FileSearch className="size-5 text-primary" />
            <span className="font-mono font-semibold">NexoDoc</span>
          </div>
          {allowDemoMode ? (
            <Button
              type="button"
              aria-pressed={useMockMode}
              variant={useMockMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setUseMockMode((current) => !current)}
            >
              <TestTube2 />
              Demo
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={handleNewAudit}>
            <RotateCcw />
            Nova
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Abrir uso e custos"
            onClick={() => window.open("/admin/usage", "_blank", "noopener,noreferrer")}
          >
            <Gauge />
          </Button>
        </header>

        {!isLoading ? renderAuditContext() : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <div
            className={cn(
              "mx-auto flex min-h-full flex-col gap-4",
              isLoading ? "max-w-[760px]" : "max-w-5xl",
            )}
          >
            {messages.length === 0 && !isLoading ? (
              renderEmptyChat()
            ) : (
              messages.map((item) => (
                <div key={item.id}>
                  {item.role === "assistant" ? (
                    <AuditResult
                      content={item.content}
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

            {isLoading ? (
              <div className="flex min-h-[240px] flex-1 items-center justify-center py-8">
                <AuditProgress
                  fileCount={files.length}
                  auditMode={auditMode}
                  elapsedMs={elapsedMs}
                  onCancel={handleCancelAudit}
                />
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <Composer
          message={message}
          files={files}
          isLoading={isLoading}
          setupComplete={setupComplete}
          onMessageChange={setMessage}
          onFilesAdd={handleFilesAdd}
          onFileRemove={handleFileRemove}
          onSubmit={handleSubmit}
        />
      </section>

      <aside className="hidden h-dvh w-[320px] shrink-0 border-l bg-[var(--nexodoc-panel)] p-5 2xl:flex 2xl:flex-col">
        <div className="flex items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="font-mono text-xs uppercase text-muted-foreground">Painel</p>
            <h2 className="mt-1 text-base font-semibold">Inspeção</h2>
          </div>
          <div className={`rounded-md border px-2 py-1 font-mono text-xs font-medium ${statusToneClass}`}>
            {statusIsCritical ? (
              <AlertTriangle className="mr-1 inline size-3" />
            ) : (
              <CheckCircle2 className="mr-1 inline size-3" />
            )}
            {latestStatus}
          </div>
        </div>

        <dl className="my-5 divide-y border-y font-mono text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">{getAuditModeLabel(auditMode)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-muted-foreground">Tempo</dt>
            <dd className="font-mono text-xs font-medium">
              {isLoading ? formatSeconds(elapsedMs) : formatSeconds(latestResult?.elapsedMs)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-muted-foreground">PDFs</dt>
            <dd className="font-medium">{displayedFileCount || "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-muted-foreground">Achados</dt>
            <dd className="font-medium">{latestFindingCount}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-3 rounded-md border bg-[var(--nexodoc-recessed)] p-1 font-mono text-xs">
          {[
            { value: "summary" as const, label: "Resumo" },
            { value: "findings" as const, label: "Achados" },
            { value: "report" as const, label: "Relatório" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setInspectorTab(tab.value)}
              className={
                inspectorTab === tab.value
                  ? "rounded-md border bg-card px-2 py-2.5 font-medium text-foreground"
                  : "rounded-md border border-transparent px-2 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-md border bg-card p-4 text-sm leading-6">
          {inspectorTab === "summary" ? (
            <div className="space-y-4">
              <section>
                <p className="font-mono text-xs uppercase text-muted-foreground">
                  Projeto
                </p>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">
                  {latestProject || projectName || "Aguardando auditoria."}
                </pre>
              </section>
              <section className="border-t pt-4">
                <p className="font-mono text-xs uppercase text-muted-foreground">
                  Próxima ação
                </p>
                <p className="mt-2 text-muted-foreground">
                  {latestResult
                    ? "Revise achados por arquivo e valide os documentos citados."
                    : "Siga o passo a passo e envie os PDFs."}
                </p>
              </section>
            </div>
          ) : null}

          {inspectorTab === "findings" ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="size-4 text-primary" />
                <p className="font-medium">Incongruencias</p>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                {latestFindings || "Nenhum achado estruturado disponivel ainda."}
              </pre>
            </div>
          ) : null}

          {inspectorTab === "report" ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <ScrollText className="size-4 text-primary" />
                <p className="font-medium">Relatório completo</p>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                {latestReport}
              </pre>
            </div>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
