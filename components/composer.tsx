"use client";

import { Lightbulb, Play, SendHorizontal } from "lucide-react";

import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAuditModeLabel, type AuditMode } from "@/lib/audit-mode";
import type { AuditFileAttachment, DocumentType } from "@/lib/document-types";
import { PROMPT_SUGGESTIONS } from "@/lib/prompt-suggestions";

type ComposerProps = {
  message: string;
  files: AuditFileAttachment[];
  auditMode: AuditMode;
  isLoading: boolean;
  setupComplete: boolean;
  onMessageChange: (value: string) => void;
  onAuditModeChange: (value: AuditMode) => void;
  onFilesAdd: (files: File[], documentType: DocumentType) => void;
  onSubmit: () => void;
  onLoadDemo: () => void;
};

export function Composer({
  message,
  files,
  auditMode,
  isLoading,
  setupComplete,
  onMessageChange,
  onAuditModeChange,
  onFilesAdd,
  onSubmit,
  onLoadDemo,
}: ComposerProps) {
  const canSubmit =
    setupComplete && message.trim().length > 0 && files.length > 0 && !isLoading;
  const suggestions = PROMPT_SUGGESTIONS.filter(
    (suggestion) => suggestion.auditMode === auditMode,
  );

  return (
    <div className="border-t bg-[var(--nexodoc-panel)]/95 p-3">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <div className="border bg-card p-2">
          <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="border bg-muted px-2 py-1 font-medium text-foreground">
                {getAuditModeLabel(auditMode)}
              </span>
              {suggestions.slice(0, 2).map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  disabled={isLoading || !setupComplete}
                  onClick={() => {
                    onMessageChange(suggestion.prompt);

                    if (suggestion.auditMode) {
                      onAuditModeChange(suggestion.auditMode);
                    }
                  }}
                  className="inline-flex items-center gap-1 border bg-background px-2 py-1 text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Lightbulb className="size-3" />
                  {suggestion.title}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="hidden text-xs text-muted-foreground sm:block">
                {files.length}/5 PDFs
              </p>
              <FileUpload
                onFilesSelected={onFilesAdd}
                disabled={isLoading || !setupComplete}
                compact
              />
            </div>
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto]">
            <Textarea
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder={
                setupComplete
                  ? "Solicitacao objetiva da auditoria"
                  : "Preencha a identificacao da auditoria para liberar o envio"
              }
              className="max-h-20 min-h-12 resize-none rounded-none border bg-background py-2 text-sm shadow-none focus-visible:ring-2"
              disabled={isLoading || !setupComplete}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  onSubmit();
                }
              }}
            />
            <div className="flex gap-2 lg:flex-col">
              <Button
                type="button"
                variant="outline"
                onClick={onLoadDemo}
                disabled={isLoading}
              >
                <Play />
                Demo
              </Button>
              <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
                <SendHorizontal />
                {isLoading ? "Analisando" : "Auditar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
