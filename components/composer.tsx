"use client";

import { Lightbulb, Play, SendHorizontal } from "lucide-react";

import { AttachedFiles } from "@/components/attached-files";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AuditMode } from "@/lib/audit-mode";
import { PROMPT_SUGGESTIONS } from "@/lib/prompt-suggestions";
import { cn } from "@/lib/utils";

type ComposerProps = {
  message: string;
  files: File[];
  auditMode: AuditMode;
  isLoading: boolean;
  onMessageChange: (value: string) => void;
  onAuditModeChange: (value: AuditMode) => void;
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onSubmit: () => void;
  onLoadDemo: () => void;
};

export function Composer({
  message,
  files,
  auditMode,
  isLoading,
  onMessageChange,
  onAuditModeChange,
  onFilesAdd,
  onFileRemove,
  onSubmit,
  onLoadDemo,
}: ComposerProps) {
  const canSubmit = message.trim().length > 0 && files.length > 0 && !isLoading;

  return (
    <div className="border-t bg-[var(--nexodoc-panel)]/95 p-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <AttachedFiles
          files={files}
          onRemove={onFileRemove}
          disabled={isLoading}
        />
        <div className="rounded-none border bg-card p-3">
          <div className="mb-3 grid gap-2 rounded-none border bg-muted/40 p-1 lg:grid-cols-3">
            {[
              {
                value: "fast" as const,
                title: "Rápida",
                description: "Triagem objetiva, menor custo e resposta curta.",
              },
              {
                value: "volume" as const,
                title: "Volume",
                description: "Capa, LD, pranchas, selos, revisões e estrutura.",
              },
              {
                value: "complete" as const,
                title: "Completa",
                description: "Conferência mais cuidadosa e detalhada.",
              },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={isLoading}
                onClick={() => onAuditModeChange(mode.value)}
                className={cn(
                  "rounded-none border px-3 py-2 text-left transition-[background-color,border-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-60",
                  auditMode === mode.value
                    ? "border-ring bg-background text-foreground shadow-[inset_0_0_0_1px_var(--ring)]"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <span className="block text-sm font-medium">{mode.title}</span>
                <span className="mt-1 block text-xs leading-4">
                  {mode.description}
                </span>
              </button>
            ))}
          </div>
          {files.length > 0 ? (
            <div className="mb-3 border bg-background p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Lightbulb className="size-3.5 text-primary" />
                Modelos de solicitação
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      onMessageChange(suggestion.prompt);

                      if (suggestion.auditMode) {
                        onAuditModeChange(suggestion.auditMode);
                      }
                    }}
                    className="rounded-none border bg-card px-3 py-2 text-left transition-[background-color,border-color,color] hover:border-ring hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block text-xs font-medium text-foreground">
                      {suggestion.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                      {suggestion.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Descreva a conferência documental desejada"
            className="max-h-40 min-h-20 resize-none rounded-none border-0 px-0 py-0 shadow-none focus-visible:ring-0"
            disabled={isLoading}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                onSubmit();
              }
            }}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <FileUpload onFilesSelected={onFilesAdd} disabled={isLoading} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={onLoadDemo}
                disabled={isLoading}
              >
                <Play />
                Ver demo
              </Button>
              <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
                <SendHorizontal />
                {isLoading ? "Analisando" : "Auditar documentos"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
