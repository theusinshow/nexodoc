import { FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getDocumentTypeLabel,
  type AuditFileAttachment,
} from "@/lib/document-types";

type AttachedFilesProps = {
  files: AuditFileAttachment[];
  onRemove: (index: number) => void;
  disabled?: boolean;
};

function formatFileSize(size: number) {
  const mb = size / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function AttachedFiles({
  files,
  onRemove,
  disabled = false,
}: AttachedFilesProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="grid max-h-24 gap-1.5 overflow-y-auto sm:grid-cols-2">
      {files.map((attachment, index) => (
        <div
          key={attachment.id}
          className="flex min-w-0 items-center gap-2 rounded-md border bg-[var(--nexodoc-raised)]/80 px-2 py-1.5 text-xs"
        >
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-medium">{attachment.file.name}</p>
              <span className="shrink-0 rounded border bg-muted/70 px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                {getDocumentTypeLabel(attachment.documentType)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {formatFileSize(attachment.file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remover ${attachment.file.name}`}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
