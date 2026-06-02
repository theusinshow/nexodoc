"use client";

import { useCallback, useState } from "react";
import type { ImportedPdfFile, PageAssetRole } from "@/modules/volume-builder/lib/volume/volume-types";
import { createImportedPdfFile, isPdfFile } from "@/modules/volume-builder/lib/volume/volume-extractor";
import { countPages } from "@/modules/volume-builder/lib/pdf/count-pages";
import { FileDropzone } from "@/modules/volume-builder/shared/file-dropzone";
import { ImportedPdfCard } from "./imported-pdf-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileUp } from "lucide-react";

interface ImportedFilesPoolProps {
  files: ImportedPdfFile[];
  fileDataMap: Map<string, File>;
  onFilesImported: (files: ImportedPdfFile[], fileData: File[]) => void;
  onRemoveFile: (fileId: string) => void;
}

export function ImportedFilesPool({
  files,
  fileDataMap,
  onFilesImported,
  onRemoveFile,
}: ImportedFilesPoolProps) {
  const [odtWarning, setOdtWarning] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<PageAssetRole>("document");

  const handleFilesAccepted = useCallback(
    async (acceptedFiles: File[]) => {
      setOdtWarning(null);

      const odtFiles = acceptedFiles.filter(
        (file) =>
          file.name.toLowerCase().endsWith(".odt") ||
          file.type === "application/vnd.oasis.opendocument.text"
      );

      if (odtFiles.length > 0) {
        setOdtWarning(
          `No MVP, envie o documento ja exportado em PDF. Conversao ODT ficara para uma versao futura por servico externo. Arquivos rejeitados: ${odtFiles.map((f) => f.name).join(", ")}`
        );
      }

      const pdfFiles = acceptedFiles.filter(isPdfFile);

      if (pdfFiles.length === 0) {
        return;
      }

      const newFiles: ImportedPdfFile[] = [];
      const fileDataList: File[] = [];

      for (const file of pdfFiles) {
        const importedFile = createImportedPdfFile(file, selectedRole);

        try {
          const arrayBuffer = await file.arrayBuffer();
          const pageCount = await countPages(arrayBuffer);
          importedFile.pageCount = pageCount;
        } catch (error) {
          console.error(`Erro ao contar paginas de ${file.name}:`, error);
          importedFile.warnings.push("Nao foi possivel contar paginas.");
        }

        newFiles.push(importedFile);
        fileDataList.push(file);
      }

      if (newFiles.length > 0) {
        onFilesImported(newFiles, fileDataList);
      }
    },
    [onFilesImported, selectedRole]
  );

  const roleCounts = ROLE_OPTIONS.map((option) => ({
    ...option,
    count: files.filter((file) => file.role === option.value).length,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-4 w-4" />
          Upload classificado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {roleCounts.map((role) => (
            <Button
              key={role.value}
              type="button"
              variant={selectedRole === role.value ? "default" : "outline"}
              size="sm"
              className="h-auto justify-between gap-2 px-2 py-2 text-xs"
              onClick={() => setSelectedRole(role.value)}
            >
              <span className="truncate">{role.label}</span>
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {role.count}
              </Badge>
            </Button>
          ))}
        </div>

        <FileDropzone onFilesAccepted={handleFilesAccepted} />

        {odtWarning && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-800">{odtWarning}</p>
            </div>
          </div>
        )}

        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum arquivo importado.
          </p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <ImportedPdfCard
                key={file.id}
                file={file}
                fileData={fileDataMap.get(file.id)}
                onRemove={() => onRemoveFile(file.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ROLE_OPTIONS: Array<{ value: PageAssetRole; label: string }> = [
  { value: "cover", label: "Capas" },
  { value: "ld", label: "LDs" },
  { value: "separator", label: "Separatrizes" },
  { value: "document", label: "Pranchas" },
  { value: "appendix", label: "Anexos" },
];
