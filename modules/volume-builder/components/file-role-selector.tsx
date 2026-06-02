"use client";

import { useState } from "react";
import type { ImportedPdfFile, PageSelection } from "@/modules/volume-builder/lib/volume/volume-types";
import { PdfPageSelector } from "./pdf-page-selector";
import { FileText } from "lucide-react";

interface FileRoleSelectorProps {
  importedFiles: ImportedPdfFile[];
  onSelect: (selection: PageSelection) => void;
  onFileSelected?: (file: ImportedPdfFile) => void;
}

export function FileRoleSelector({
  importedFiles,
  onSelect,
  onFileSelected,
}: FileRoleSelectorProps) {
  const [selectedFile, setSelectedFile] = useState<ImportedPdfFile | null>(null);

  if (importedFiles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Importe PDFs primeiro.
      </p>
    );
  }

  if (selectedFile) {
    return (
      <div className="space-y-2">
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedFile(null)}
        >
          Voltar para lista de arquivos
        </button>
        <PdfPageSelector
          fileId={selectedFile.id}
          fileName={selectedFile.name}
          pageCount={selectedFile.pageCount}
          onSelect={onSelect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">Selecione um arquivo:</p>
      {importedFiles.map((file) => (
        <button
          key={file.id}
          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors flex items-center gap-2"
          onClick={() => {
            setSelectedFile(file);
            onFileSelected?.(file);
          }}
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate flex-1">{file.name}</span>
          {file.pageCount > 0 && (
            <span className="text-muted-foreground shrink-0">
              {file.pageCount}p
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
