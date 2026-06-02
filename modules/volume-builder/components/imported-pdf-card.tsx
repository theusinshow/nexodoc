"use client";

import type { ImportedPdfFile } from "@/modules/volume-builder/lib/volume/volume-types";
import { formatFileSize } from "@/modules/volume-builder/lib/utils/format-file-size";
import { StatusBadge } from "@/modules/volume-builder/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { PdfPageThumbnailGrid } from "./pdf-page-thumbnail-grid";

interface ImportedPdfCardProps {
  file: ImportedPdfFile;
  fileData?: File;
  onRemove: () => void;
}

export function ImportedPdfCard({ file, fileData, onRemove }: ImportedPdfCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {ROLE_LABELS[file.role]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
            {file.pageCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {file.pageCount} pag.
              </span>
            )}
            <StatusBadge status={file.warnings.length > 0 ? "ponto_de_atencao" : "sem_problemas"} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded && fileData && (
        <PdfPageThumbnailGrid
          file={fileData}
          pageCount={file.pageCount}
        />
      )}
    </div>
  );
}

const ROLE_LABELS: Record<ImportedPdfFile["role"], string> = {
  cover: "Capas",
  ld: "LD",
  separator: "Separatriz",
  document: "Pranchas",
  appendix: "Anexos",
};
