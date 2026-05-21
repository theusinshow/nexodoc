"use client";

import { ClipboardList, FileSearch, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AuditProgress } from "@/components/audit-progress";
import { AuditResult } from "@/components/audit-result";
import { Composer } from "@/components/composer";
import { MessageBubble } from "@/components/message-bubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  elapsedMs?: number;
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState(
    "Confira a consistência documental entre memorial e pranchas.",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const latestResult = useMemo(() => {
    return [...messages].reverse().find((item) => item.role === "assistant");
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, error]);

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
    const startedAt = performance.now();

    const formData = new FormData();
    formData.append("message", trimmedMessage);
    files.forEach((file) => formData.append("files", file));

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedMessage,
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        result?: string;
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Não foi possível concluir a auditoria.");
      }

      const result = payload.result;

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result,
          elapsedMs: performance.now() - startedAt,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível concluir a auditoria.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r bg-card px-5 py-5 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSearch className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-normal">NexoDoc</h1>
            <p className="text-xs text-muted-foreground">
              Auditoria documental
            </p>
          </div>
        </div>

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
                <section className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <ClipboardList className="size-5" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary">MVP 0.1</Badge>
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
                <AuditProgress fileCount={files.length} />
              </div>
            ) : null}

            {latestResult ? (
              <div className="sr-only">Resultado pronto</div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
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
          onMessageChange={setMessage}
          onFilesAdd={handleFilesAdd}
          onFileRemove={handleFileRemove}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}
