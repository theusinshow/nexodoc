"use client";

import { useMemo, useState } from "react";
import type { AssemblyRow, VolumeMetadata, ImportedPdfFile } from "@/modules/volume-builder/lib/volume/volume-types";
import { determineOutputMode } from "@/modules/volume-builder/lib/volume/volume-rules";
import { generateZipFileName, generateReportFileName } from "@/modules/volume-builder/lib/volume/volume-naming";
import { getVolumeApiEndpoint } from "@/modules/volume-builder/lib/utils/volume-api-endpoint";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, FileArchive, FileText, Loader2 } from "lucide-react";

interface ExportPanelProps {
  rows: AssemblyRow[];
  metadata: VolumeMetadata;
  importedFiles: ImportedPdfFile[];
  fileDataMap: Map<string, File>;
  projectId?: string;
  compact?: boolean;
}

export function ExportPanel({ rows, metadata, importedFiles, fileDataMap, projectId, compact = false }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outputMode = determineOutputMode(rows);
  const canExport = rows.length > 0;

  const zipFileName = generateZipFileName(metadata);
  const reportFileName = generateReportFileName(metadata);
  const usedFileIds = useMemo(() => getUsedFileIds(rows), [rows]);

  function createBuildFormData() {
    const formData = new FormData();
    const usedImportedFiles = importedFiles.filter((file) => usedFileIds.has(file.id));

    formData.append("rows", JSON.stringify(rows));
    formData.append("metadata", JSON.stringify(metadata));
    formData.append("importedFiles", JSON.stringify(usedImportedFiles));
    if (projectId) {
      formData.append("projectId", projectId);
    }

    for (const file of usedImportedFiles) {
      const fileData = fileDataMap.get(file.id);
      if (fileData) {
        formData.append(`file_${file.id}`, fileData);
      }
    }

    return formData;
  }

  async function requestBuild(fallback: string) {
    const endpoint = getVolumeApiEndpoint("/api/volume/build");
    const response = await fetch(endpoint, {
      method: "POST",
      body: createBuildFormData(),
    });

    if (!response.ok) {
      throw new Error(await readErrorResponse(response, `${fallback} (${endpoint})`));
    }

    return response;
  }

  async function handlePreview() {
    if (outputMode !== "single_pdf") {
      setError("Preview direto esta disponivel apenas para PDF unico. Para multiplos volumes, gere o ZIP.");
      return;
    }

    setIsPreviewing(true);
    setError(null);

    const previewWindow = window.open("", "_blank");

    try {
      const response = await requestBuild("Erro ao gerar preview");
      const responseType = response.headers.get("Content-Type") ?? "";

      if (!responseType.includes("application/pdf")) {
        throw new Error(await readErrorResponse(response, "Resposta inesperada ao gerar preview"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      previewWindow?.close();
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    try {
      const response = await requestBuild("Erro ao gerar PDF");
      const responseType = response.headers.get("Content-Type") ?? "";
      const isExpectedFile =
        responseType.includes("application/pdf") ||
        responseType.includes("application/zip") ||
        responseType.includes("application/octet-stream");

      if (!isExpectedFile) {
        throw new Error(await readErrorResponse(response, "Resposta inesperada ao gerar PDF"));
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");

      let fileName = "download";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          fileName = match[1];
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadReport() {
    setIsDownloadingReport(true);
    setError(null);

    try {
      const endpoint = getVolumeApiEndpoint("/api/volume/report");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, metadata, importedFiles, projectId }),
      });

      if (!response.ok) {
        throw new Error(await readErrorResponse(response, `Erro ao gerar relatorio (${endpoint})`));
      }

      const text = await response.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = reportFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsDownloadingReport(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{compact ? "Exportacao" : "Modo de saida:"}</span>
          <Badge variant="outline" className="gap-1">
            {outputMode === "single_pdf" ? (
              <>
                <FileText className="h-3 w-3" />
                PDF unico
              </>
            ) : (
              <>
                <FileArchive className="h-3 w-3" />
                ZIP com {rows.length} PDFs
              </>
            )}
          </Badge>
        </div>

        {outputMode === "zip" && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Com {rows.length} linhas, a exportacao sera em formato ZIP contendo todos os PDFs e o relatorio de montagem.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Preview direto fica disponivel quando ha apenas um PDF.
            </p>
            <p className="text-xs font-mono mt-1">
              {zipFileName}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!canExport || isPreviewing || outputMode !== "single_pdf"}
            size="sm"
            onClick={handlePreview}
          >
            {isPreviewing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            Preview
          </Button>
          <Button disabled={!canExport || isExporting} size="sm" onClick={handleExport}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            {outputMode === "single_pdf" ? "Gerar PDF" : "Gerar ZIP"}
          </Button>
          <Button
            variant="outline"
            disabled={!canExport || isDownloadingReport}
            size="sm"
            onClick={handleDownloadReport}
          >
            {isDownloadingReport ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Baixar relatorio
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {!canExport && (
          <p className="text-xs text-muted-foreground">
            Adicione pelo menos uma linha de montagem para exportar.
          </p>
        )}

        {canExport && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {rows.length} linha(s) pronta(s) para exportacao.
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Relatorio: {reportFileName}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getUsedFileIds(rows: AssemblyRow[]) {
  const ids = new Set<string>();

  for (const row of rows) {
    if (row.cover?.selection?.sourceFileId) {
      ids.add(row.cover.selection.sourceFileId);
    }

    for (const block of row.blocks) {
      if (block.separator?.selection?.sourceFileId) {
        ids.add(block.separator.selection.sourceFileId);
      }
      if (block.ld?.selection?.sourceFileId) {
        ids.add(block.ld.selection.sourceFileId);
      }

      for (const doc of block.documents) {
        if (doc.selection?.sourceFileId) {
          ids.add(doc.selection.sourceFileId);
        }
      }

      for (const appendix of block.appendices ?? []) {
        if (appendix.selection?.sourceFileId) {
          ids.add(appendix.selection.sourceFileId);
        }
      }
    }
  }

  return ids;
}

async function readErrorResponse(response: Response, fallback: string) {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  }

  const text = await response.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    return `${fallback}: o servidor retornou uma pagina HTML (${response.status}). Verifique se a sessao ainda esta ativa e se a rota da API esta acessivel.`;
  }

  return text.trim() || `${fallback} (${response.status})`;
}
