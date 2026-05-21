import { FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type AttachedFilesProps = {
  files: File[];
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
    <div className="grid gap-2 sm:grid-cols-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${file.size}-${index}`}
          className="flex min-w-0 items-center gap-3 rounded-none border bg-card px-3 py-2 text-sm"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remover ${file.name}`}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
