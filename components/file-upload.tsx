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
    <div className={compact ? "flex flex-wrap gap-2" : "grid gap-3 sm:grid-cols-[190px_1fr]"}>
      <label className="sr-only" htmlFor={typeId}>
        Tipo de documento
      </label>
      <select
        id={typeId}
        value={documentType}
        onChange={(event) => setDocumentType(event.target.value as DocumentType)}
        disabled={disabled}
        className="h-10 rounded-md border border-input bg-card px-3 font-mono text-sm text-foreground outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:opacity-60"
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
