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
import { AlertCircle, ChevronDown, ChevronUp, EyeOff, FileUp } from "lucide-react";

interface ImportedFilesPoolProps {
  files: ImportedPdfFile[];
  fileDataMap: Map<string, File>;
  onFilesImported: (files: ImportedPdfFile[], fileData: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  onCollapse?: () => void;
}

export function ImportedFilesPool({
  files,
  fileDataMap,
  onFilesImported,
  onRemoveFile,
  onCollapse,
}: ImportedFilesPoolProps) {
  const [odtWarning, setOdtWarning] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<PageAssetRole>("document");
  const [showImportedList, setShowImportedList] = useState(false);

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
        setShowImportedList(false);
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
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4" />
            Upload classificado
          </CardTitle>
          {onCollapse && files.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onCollapse}
            >
              <EyeOff className="mr-1 h-3 w-3" />
              Ocultar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Escolha o tipo antes de importar para a bandeja ja nascer filtrada.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {roleCounts.map((role) => (
            <Button
              key={role.value}
              type="button"
              variant={selectedRole === role.value ? "default" : "outline"}
              size="sm"
              className={`h-auto justify-between gap-2 px-2 py-2 text-xs transition-all duration-200 ${
                selectedRole === role.value
                  ? "border-primary shadow-[0_0_0_1px_rgb(91_218_198_/_0.16)]"
                  : "hover:border-primary/60 hover:bg-muted/40"
              }`}
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
          <div className="rounded-md border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--status-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--status-warning)]">{odtWarning}</p>
            </div>
          </div>
        )}

        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum arquivo importado.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5">
              <span className="text-xs text-muted-foreground">
                {files.length} arquivo(s), {files.reduce((total, file) => total + file.pageCount, 0)} pagina(s)
              </span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  pronto
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => setShowImportedList((current) => !current)}
                >
                  {showImportedList ? (
                    <ChevronUp className="mr-1 h-3 w-3" />
                  ) : (
                    <ChevronDown className="mr-1 h-3 w-3" />
                  )}
                  Lista
                </Button>
              </div>
            </div>
            {showImportedList && (
              <div className="max-h-[34vh] space-y-2 overflow-y-auto pr-1">
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
