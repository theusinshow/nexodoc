"use client";

import { SendHorizontal } from "lucide-react";

import { AttachedFiles } from "@/components/attached-files";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AuditFileAttachment, DocumentType } from "@/lib/document-types";
import { cn } from "@/lib/utils";

type ComposerProps = {
  message: string;
  files: AuditFileAttachment[];
  isLoading: boolean;
  setupComplete: boolean;
  followupEnabled?: boolean;
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
  followupEnabled = false,
  onMessageChange,
  onFilesAdd,
  onFileRemove,
  onSubmit,
}: ComposerProps) {
  const isFollowup = followupEnabled && files.length === 0;
  const canSubmit =
    setupComplete && message.trim().length > 0 && (files.length > 0 || followupEnabled) && !isLoading;

  return (
    <div className={cn("border-t bg-card px-4", isFollowup ? "py-2.5" : "py-4")}>
      <div className="mx-auto flex max-w-5xl flex-col gap-2.5">
        {!isFollowup ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-medium text-foreground">
                {`${files.length}/5 PDFs anexados`}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                PDFs técnicos, até 5 arquivos de 25 MB
              </p>
            </div>
            <FileUpload
              onFilesSelected={onFilesAdd}
              disabled={isLoading || !setupComplete}
              compact
            />
          </div>
        ) : null}

        <div className={cn("grid gap-2", isFollowup ? "grid-cols-[1fr_auto] items-center" : "gap-3 lg:grid-cols-[1fr_auto] lg:items-end")}>
          <Textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder={
              isFollowup
                ? "Pergunte sobre os achados ou evidências..."
                : setupComplete
                  ? "Descreva o que deve ser verificado na auditoria"
                  : "Preencha a identificação da auditoria para liberar o envio"
            }
            className={cn(
              "resize-none bg-[var(--nexodoc-recessed)] text-sm leading-6 shadow-none",
              isFollowup
                ? "min-h-[2.5rem] max-h-[8rem] py-2"
                : "max-h-[24rem] min-h-[8rem] py-3.5 sm:min-h-[12rem]",
            )}
            disabled={isLoading || !setupComplete}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                onSubmit();
              }
            }}
          />
          <Button
            className={cn(isFollowup ? "h-9" : "lg:min-w-[140px]")}
            type="button"
            size={isFollowup ? "sm" : "lg"}
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            <SendHorizontal className="size-4" />
            {isLoading ? "Analisando" : isFollowup ? "Perguntar" : "Auditar"}
          </Button>
        </div>

        {files.length > 0 ? (
          <div className="border-t pt-2.5">
            <AttachedFiles
              files={files}
              onRemove={onFileRemove}
              disabled={isLoading}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
