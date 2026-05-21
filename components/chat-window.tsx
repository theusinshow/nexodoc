"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSearch,
  Files,
  ListChecks,
  RotateCcw,
  ScrollText,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AuditProgress } from "@/components/audit-progress";
import { AuditResult } from "@/components/audit-result";
import { Composer } from "@/components/composer";
import { MessageBubble } from "@/components/message-bubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDemoAuditResult } from "@/lib/audit-demo-data";
import { DEFAULT_AUDIT_MODE, getAuditModeLabel, type AuditMode } from "@/lib/audit-mode";

type ChatWindowProps = {
  isMockMode?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  auditMode?: AuditMode;
  elapsedMs?: number;
};

type AuditHistoryItem = {
  id: string;
  title: string;
  createdAt: Date;
  auditMode: AuditMode;
  fileNames: string[];
  status: "processing" | "completed" | "failed" | "canceled";
  result?: string;
  elapsedMs?: number;
  error?: string;
};

type InspectorTab = "summary" | "findings" | "report";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function getStatusFromResult(result?: string) {
  if (!result) {
    return "aguardando envio";
  }

  const lowerResult = result.toLowerCase();

  if (lowerResult.includes("com incongruência relevante")) {
    return "com incongruência relevante";
  }

  if (lowerResult.includes("com ponto de atenção")) {
    return "com ponto de atenção";
  }

  if (lowerResult.includes("sem incongruência relevante")) {
    return "sem incongruência relevante";
  }

  return "resultado disponível";
}

function getFindingCount(result?: string) {
  if (!result) {
    return 0;
  }

  return result.match(/Achado\s+\d+:/gi)?.length ?? 0;
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

function validateFiles(currentFiles: File[], newFiles: File[]) {
  const pdfFiles = newFiles.filter((file) => {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  });

  if (pdfFiles.length !== newFiles.length) {
    return {
      files: currentFiles,
      error: "Anexe apenas arquivos PDF.",
    };
  }

  const oversized = pdfFiles.find((file) => file.size > MAX_FILE_SIZE);

  if (oversized) {
    return {
      files: currentFiles,
      error: `O arquivo "${oversized.name}" excede 25 MB.`,
    };
  }

  const merged = [...currentFiles, ...pdfFiles].slice(0, MAX_FILES);

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

export function ChatWindow({ isMockMode = false }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState(
    "Confira a consistência documental entre memorial e pranchas.",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [auditMode, setAuditMode] = useState<AuditMode>(DEFAULT_AUDIT_MODE);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [auditHistory, setAuditHistory] = useState<AuditHistoryItem[]>([]);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("summary");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);

  const latestResult = useMemo(() => {
    return [...messages].reverse().find((item) => item.role === "assistant");
  }, [messages]);
  const latestStatus = getStatusFromResult(latestResult?.content);
  const latestFindingCount = getFindingCount(latestResult?.content);
  const latestProject = extractSection(
    latestResult?.content,
    "1\\.\\s*Projeto analisado",
  );
  const latestFindings = extractSection(
    latestResult?.content,
    "5\\.\\s*Incongruências relevantes encontradas",
  );
  const latestReport =
    latestResult?.content ?? "Nenhuma auditoria concluída nesta sessão.";
  const activeAudit = auditHistory.find((item) => item.id === activeAuditId);
  const displayedFileCount = files.length || activeAudit?.fileNames.length || 0;
  const statusIsCritical = latestStatus === "com incongruência relevante";
  const statusIsOk = latestStatus === "sem incongruência relevante";
  const statusToneClass = statusIsCritical
    ? "border-[var(--status-critical)]/35 bg-[var(--status-critical-bg)] text-[var(--status-critical)]"
    : statusIsOk
      ? "border-[var(--status-ok)]/35 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
      : "border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, error]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 500);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  function handleFilesAdd(newFiles: File[]) {
    const result = validateFiles(files, newFiles);
    setFiles(result.files);
    setError(result.error);
  }

  function handleFileRemove(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setError("");
  }

  function handleNewAudit() {
    setMessages([]);
    setMessage("Confira a consistência documental entre memorial e pranchas.");
    setFiles([]);
    setError("");
    setActiveAuditId(null);
    setElapsedMs(0);
  }

  function handleOpenAudit(item: AuditHistoryItem) {
    setActiveAuditId(item.id);
    setError(item.error ?? "");
    setMessage("Confira a consistência documental entre memorial e pranchas.");
    setFiles([]);
    setAuditMode(item.auditMode);

    const userMessage: ChatMessage = {
      id: `${item.id}-request`,
      role: "user",
      content: `Auditoria registrada\n\nModo: ${getAuditModeLabel(item.auditMode)}\nArquivos: ${item.fileNames.join(", ")}`,
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
      setAuditHistory((current) =>
        current.map((item) =>
          item.id === activeAuditId
            ? { ...item, status: "canceled", error: "Auditoria cancelada." }
            : item,
        ),
      );
    }
  }

  function handleLoadDemo() {
    const auditId = crypto.randomUUID();
    const result = getDemoAuditResult(auditMode);
    const demoElapsedMs = auditMode === "complete" ? 4200 : 1800;

    setIsLoading(false);
    setError("");
    setFiles([]);
    setElapsedMs(0);
    setActiveAuditId(auditId);
    setMessages([
      {
        id: `${auditId}-request`,
        role: "user",
        content: `Demonstração local\n\nModo: ${getAuditModeLabel(auditMode)}\nArquivos: Memorial.pdf, Pranchas.pdf`,
        auditMode,
      },
      {
        id: `${auditId}-result`,
        role: "assistant",
        content: result,
        auditMode,
        elapsedMs: demoElapsedMs,
      },
    ]);
    setAuditHistory((current) => [
      {
        id: auditId,
        title: `Demo ${current.length + 1}`,
        createdAt: new Date(),
        auditMode,
        fileNames: ["Memorial.pdf", "Pranchas.pdf"],
        status: "completed",
        result,
        elapsedMs: demoElapsedMs,
      },
      ...current,
    ]);
  }

  async function handleSubmit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Informe uma solicitação para a auditoria.");
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
    files.forEach((file) => formData.append("files", file));

    const userMessage: ChatMessage = {
      id: `${auditId}-request`,
      role: "user",
      content: `${trimmedMessage}\n\nModo: ${getAuditModeLabel(auditMode)}`,
      auditMode,
    };

    setMessages((current) => [...current, userMessage]);
    setAuditHistory((current) => [
      {
        id: auditId,
        title: `Auditoria ${current.length + 1}`,
        createdAt: new Date(),
        auditMode,
        fileNames: files.map((file) => file.name),
        status: "processing",
      },
      ...current,
    ]);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      const payload = (await response.json()) as {
        result?: string;
        error?: string;
        auditMode?: AuditMode;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Não foi possível concluir a auditoria.");
      }

      const result = payload.result;
      const finalElapsedMs = performance.now() - startedAtRef.current;

      setMessages((current) => [
        ...current,
        {
          id: `${auditId}-result`,
          role: "assistant",
          content: result,
          auditMode: payload.auditMode ?? auditMode,
          elapsedMs: finalElapsedMs,
        },
      ]);
      setAuditHistory((current) =>
        current.map((item) =>
          item.id === auditId
            ? {
                ...item,
                status: "completed",
                result,
                elapsedMs: finalElapsedMs,
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
          item.id === auditId ? { ...item, status: "failed", error: message } : item,
        ),
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r bg-[var(--nexodoc-panel)] px-5 py-5 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-none bg-primary text-primary-foreground">
            <FileSearch className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-normal">NexoDoc</h1>
            <p className="text-xs text-muted-foreground">
              Auditoria documental
            </p>
          </div>
        </div>

        {isMockMode ? (
          <div className="mt-4 border border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
            Modo mock ativo. Testes de interface sem consumo da OpenAI API.
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

        <div className="mt-8 space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Versão 0.1</p>
          <p>Sem login, banco de dados ou histórico persistente.</p>
          <p>Limite inicial: até 5 PDFs, 25 MB por arquivo.</p>
        </div>

        <div className="mt-8 rounded-none border bg-[var(--nexodoc-surface)] p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Files className="size-4 text-primary" />
            Auditoria atual
          </div>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <p>Modo: {getAuditModeLabel(auditMode)}</p>
            <p>Arquivos anexados: {displayedFileCount}</p>
            <p>Status: {isLoading ? "em andamento" : latestResult ? "concluída" : "aguardando envio"}</p>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-none border bg-[var(--nexodoc-surface)] p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock3 className="size-4 text-primary" />
            Histórico da sessão
          </div>
          <div className="mt-3 space-y-2">
            {auditHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma auditoria nesta sessão.
              </p>
            ) : (
              auditHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenAudit(item)}
                  className="w-full rounded-none border bg-card px-3 py-2 text-left text-xs transition-[background-color,border-color] hover:border-ring hover:bg-muted"
                >
                  <span className="block font-medium text-foreground">
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

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <FileSearch className="size-5 text-primary" />
            <span className="font-semibold">NexoDoc</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleNewAudit}>
            <RotateCcw />
            Nova
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {messages.length === 0 ? (
              <div className="grid min-h-[calc(100vh-280px)] place-items-center">
                <section className="w-full max-w-2xl rounded-none border bg-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-none bg-accent text-accent-foreground">
                      <ClipboardList className="size-5" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary">NexoDoc Audit Workspace</Badge>
                        <h2 className="mt-3 text-xl font-semibold">
                          Auditoria documental de PDFs
                        </h2>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Anexe memoriais, pranchas, capas, listas de documentos
                        ou documentos técnicos em PDF. O NexoDoc confere
                        identificação documental e retorna uma análise
                        padronizada.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              messages.map((item) => (
                <div key={item.id}>
                  {item.role === "assistant" ? (
                    <AuditResult
                      content={item.content}
                      elapsedMs={item.elapsedMs}
                    />
                  ) : (
                    <MessageBubble role={item.role} content={item.content} />
                  )}
                </div>
              ))
            )}

            {isLoading ? (
              <div className="flex justify-start">
                <AuditProgress
                  fileCount={files.length}
                  auditMode={auditMode}
                  elapsedMs={elapsedMs}
                  onCancel={handleCancelAudit}
                />
              </div>
            ) : null}

            {latestResult ? (
              <div className="sr-only">Resultado pronto</div>
            ) : null}

            {error ? (
              <div className="rounded-none border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <Composer
          message={message}
          files={files}
          auditMode={auditMode}
          isLoading={isLoading}
          onMessageChange={setMessage}
          onAuditModeChange={setAuditMode}
          onFilesAdd={handleFilesAdd}
          onFileRemove={handleFileRemove}
          onSubmit={handleSubmit}
          onLoadDemo={handleLoadDemo}
        />
      </section>

      <aside className="hidden w-[360px] shrink-0 border-l bg-[var(--nexodoc-panel)] p-4 xl:flex xl:flex-col">
        <div className="flex items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Painel analítico
            </p>
            <h2 className="mt-1 text-base font-semibold">Inspeção da auditoria</h2>
          </div>
          <div className={`border px-2 py-1 text-xs font-medium ${statusToneClass}`}>
            {statusIsCritical ? (
              <AlertTriangle className="mr-1 inline size-3" />
            ) : (
              <CheckCircle2 className="mr-1 inline size-3" />
            )}
            {latestStatus}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 py-4">
          <div className="border bg-card p-3">
            <BarChart3 className="mb-2 size-4 text-primary" />
            <p className="text-xs text-muted-foreground">Modo</p>
            <p className="mt-1 text-sm font-medium">{getAuditModeLabel(auditMode)}</p>
          </div>
          <div className="border bg-card p-3">
            <Clock3 className="mb-2 size-4 text-primary" />
            <p className="text-xs text-muted-foreground">Tempo</p>
            <p className="mt-1 text-sm font-medium">
              {isLoading ? formatSeconds(elapsedMs) : formatSeconds(latestResult?.elapsedMs)}
            </p>
          </div>
          <div className="border bg-card p-3">
            <Files className="mb-2 size-4 text-primary" />
            <p className="text-xs text-muted-foreground">PDFs</p>
            <p className="mt-1 text-sm font-medium">{displayedFileCount || "-"}</p>
          </div>
          <div className="border bg-card p-3">
            <ListChecks className="mb-2 size-4 text-primary" />
            <p className="text-xs text-muted-foreground">Achados</p>
            <p className="mt-1 text-sm font-medium">{latestFindingCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 border bg-card p-1 text-xs">
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
                  ? "border border-ring bg-background px-2 py-2 text-foreground"
                  : "border border-transparent px-2 py-2 text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto border bg-card p-4 text-sm leading-6">
          {inspectorTab === "summary" ? (
            <div className="space-y-4">
              <section>
                <p className="text-xs uppercase text-muted-foreground">
                  Projeto analisado
                </p>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">
                  {latestProject || "Aguardando resultado da primeira auditoria."}
                </pre>
              </section>
              <section className="border-t pt-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Próxima ação
                </p>
                <p className="mt-2 text-muted-foreground">
                  {latestResult
                    ? "Revise os achados, copie os pontos relevantes e valide os documentos citados."
                    : "Anexe PDFs, escolha o modo de auditoria e envie a solicitação no chat."}
                </p>
              </section>
            </div>
          ) : null}

          {inspectorTab === "findings" ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="size-4 text-primary" />
                <p className="font-medium">Incongruências relevantes</p>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                {latestFindings || "Nenhum achado estruturado disponível ainda."}
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
