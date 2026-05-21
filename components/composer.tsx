"use client";

import { SendHorizontal } from "lucide-react";

import { AttachedFiles } from "@/components/attached-files";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ComposerProps = {
  message: string;
  files: File[];
  isLoading: boolean;
  onMessageChange: (value: string) => void;
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onSubmit: () => void;
};

export function Composer({
  message,
  files,
  isLoading,
  onMessageChange,
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
