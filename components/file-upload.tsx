"use client";

import { ChangeEvent, useId, useState } from "react";
import { FileUp, Paperclip } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DOCUMENT_TYPES,
  getDocumentTypeLabel,
  type DocumentType,
} from "@/lib/document-types";
import { cn } from "@/lib/utils";

type FileUploadProps = {
  onFilesSelected: (files: File[], documentType: DocumentType) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function FileUpload({
  onFilesSelected,
  disabled = false,
  compact = false,
}: FileUploadProps) {
  const uploadId = useId();
  const typeId = useId();
  const [documentType, setDocumentType] = useState<DocumentType>("memorial");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles, documentType);
    }
    event.target.value = "";
  }

  return (
    <div className={compact ? "flex gap-1.5" : "grid gap-2 sm:grid-cols-[180px_1fr]"}>
      <label className="sr-only" htmlFor={typeId}>
        Tipo de documento
      </label>
      <select
        id={typeId}
        value={documentType}
        onChange={(event) => setDocumentType(event.target.value as DocumentType)}
        disabled={disabled}
        className="h-8 border bg-background px-2 text-xs text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
      >
        {DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>
          {getDocumentTypeLabel(type)}
          </option>
        ))}
      </select>

      <input
        id={uploadId}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        aria-label="Anexar PDFs"
      />

      <label
        htmlFor={uploadId}
        aria-disabled={disabled}
        className={cn(
          buttonVariants({
            variant: compact ? "outline" : "default",
            size: compact ? "sm" : "default",
          }),
          "relative cursor-pointer justify-center overflow-hidden",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {compact ? <Paperclip /> : <FileUp />}
        Anexar PDFs
      </label>
    </div>
  );
}
