import { ChangeEvent, useRef, useState } from "react";
import { FileUp, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DOCUMENT_TYPES,
  getDocumentTypeLabel,
  type DocumentType,
} from "@/lib/document-types";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("memorial");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    onFilesSelected(selectedFiles, documentType);
    event.target.value = "";
  }

  return (
    <div className={compact ? "flex gap-1.5" : "grid gap-2 sm:grid-cols-[180px_1fr]"}>
      <label className="sr-only" htmlFor="document-type">
        Tipo de documento
      </label>
      <select
        id="document-type"
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
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        size={compact ? "sm" : "default"}
        className="justify-center"
      >
        {compact ? <Paperclip /> : <FileUp />}
        Anexar PDFs
      </Button>
    </div>
  );
}
