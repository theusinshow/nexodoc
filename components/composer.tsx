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
    <div className="border-t bg-card px-4 py-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-sm font-medium text-foreground">
              {files.length}/5 PDFs anexados
            </p>
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
                setupComplete
                  ? "Solicitação objetiva da auditoria"
                  : "Preencha a identificação da auditoria para liberar o envio"
              }
              className="max-h-[15rem] min-h-[7.5rem] resize-none py-3 text-sm leading-6 shadow-none sm:min-h-[8.5rem]"
              disabled={isLoading || !setupComplete}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  onSubmit();
                }
              }}
            />
            <div className="flex lg:flex-col">
              <Button className="w-full lg:min-w-32" type="button" onClick={onSubmit} disabled={!canSubmit}>
                <SendHorizontal />
                {isLoading ? "Analisando" : "Auditar"}
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
