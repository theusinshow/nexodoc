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
    <div className="border-t bg-card px-4 py-4 shadow-[0_-1px_2px_oklch(10%_0.015_255_/_0.16)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-foreground">
              {isFollowup ? "Conversa sobre a auditoria" : `${files.length}/5 PDFs anexados`}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {isFollowup
                ? "Pergunte sem reenviar arquivos"
                : "PDFs técnicos, até 5 arquivos de 25 MB"}
            </p>
          </div>
          <FileUpload
            onFilesSelected={onFilesAdd}
            disabled={isLoading || !setupComplete}
            compact
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <Textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder={
              isFollowup
                ? "Pergunte sobre os achados, evidências, prioridades ou correções desta auditoria"
                : setupComplete
                  ? "Solicitação objetiva da auditoria"
                  : "Preencha a identificação da auditoria para liberar o envio"
            }
            className="max-h-[15rem] min-h-[5.5rem] resize-none bg-[var(--nexodoc-recessed)] py-3 text-sm leading-6 shadow-none sm:min-h-[8rem]"
            disabled={isLoading || !setupComplete}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                onSubmit();
              }
            }}
          />
          <div className="flex lg:flex-col">
            <Button
              className="w-full lg:min-w-36"
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
            >
              <SendHorizontal />
              {isLoading ? "Analisando" : isFollowup ? "Perguntar" : "Auditar"}
            </Button>
          </div>
        </div>

        {files.length > 0 ? (
          <div className="border-t pt-3">
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
