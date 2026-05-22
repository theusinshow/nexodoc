"use client";

import { SendHorizontal } from "lucide-react";

import { AttachedFiles } from "@/components/attached-files";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AuditFileAttachment, DocumentType } from "@/lib/document-types";

type ComposerProps = {
  message: string;
  files: AuditFileAttachment[];
  isLoading: boolean;
  setupComplete: boolean;
  onMessageChange: (value: string) => void;
  onFilesAdd: (files: File[], documentType: DocumentType) => void;
  onFileRemove: (index: number) => void;
  onSubmit: () => void;
};

export function Composer({
  message,
  files,
  isLoading,
  setupComplete,
  onMessageChange,
  onFilesAdd,
  onFileRemove,
  onSubmit,
}: ComposerProps) {
  const canSubmit =
    setupComplete && message.trim().length > 0 && files.length > 0 && !isLoading;

  return (
    <div className="border-t bg-[var(--nexodoc-panel)]/92 p-3 shadow-[0_-12px_32px_rgb(0_0_0_/_0.16)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <div className="rounded-lg border bg-card/90 p-2 shadow-[var(--shadow-subtle)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {files.length}/5 PDFs anexados
            </p>
            <FileUpload
              onFilesSelected={onFilesAdd}
              disabled={isLoading || !setupComplete}
              compact
            />
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
              className="max-h-[16rem] min-h-[12.5rem] resize-none border-border/80 bg-[var(--nexodoc-recessed)] py-3 text-sm leading-6 shadow-none focus-visible:ring-2"
              disabled={isLoading || !setupComplete}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  onSubmit();
                }
              }}
            />
            <div className="flex lg:flex-col">
              <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
                <SendHorizontal />
                {isLoading ? "Analisando" : "Auditar"}
              </Button>
            </div>
          </div>

          {files.length > 0 ? (
            <div className="mt-2 border-t pt-2">
              <AttachedFiles
                files={files}
                onRemove={onFileRemove}
                disabled={isLoading}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
