"use client";

import { SendHorizontal } from "lucide-react";

import { AttachedFiles } from "@/components/attached-files";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AuditMode } from "@/lib/audit-mode";
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
}: ComposerProps) {
  const canSubmit = message.trim().length > 0 && files.length > 0 && !isLoading;

  return (
    <div className="border-t bg-background/95 p-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <AttachedFiles
          files={files}
          onRemove={onFileRemove}
          disabled={isLoading}
        />
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="mb-3 grid gap-2 rounded-md bg-muted/40 p-1 sm:grid-cols-2">
            {[
              {
                value: "fast" as const,
                title: "Rápida",
                description: "Triagem objetiva, menor custo e resposta curta.",
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
                  "rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  auditMode === mode.value
                    ? "border-primary bg-background text-foreground shadow-xs"
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
          <Textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Descreva a conferência documental desejada"
            className="max-h-40 min-h-20 resize-none border-0 px-0 py-0 shadow-none focus-visible:ring-0"
            disabled={isLoading}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                onSubmit();
              }
            }}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <FileUpload onFilesSelected={onFilesAdd} disabled={isLoading} />
            <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
              <SendHorizontal />
              {isLoading ? "Analisando" : "Auditar documentos"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
