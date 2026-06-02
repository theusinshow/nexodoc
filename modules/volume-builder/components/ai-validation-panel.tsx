"use client";

import type { AssemblyRow, ImportedPdfFile, VolumeMetadata, BatchAnalysisResult } from "@/modules/volume-builder/lib/volume/volume-types";
import { WarningCard } from "@/modules/volume-builder/shared/warning-card";
import { StatusBadge } from "@/modules/volume-builder/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AlertCircle, Loader2, Brain } from "lucide-react";

interface AiValidationPanelProps {
  rows: AssemblyRow[];
  importedFiles?: ImportedPdfFile[];
  metadata?: VolumeMetadata;
  compact?: boolean;
}

export function AiValidationPanel({ rows, importedFiles, metadata, compact = false }: AiValidationPanelProps) {
  const [validationResult, setValidationResult] = useState<BatchAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/volume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          metadata: metadata || { projectCode: "", projectName: "" },
          importedFiles: importedFiles || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao analisar montagem");
      }

      const result: BatchAnalysisResult = await response.json();
      setValidationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Validacao</p>
            {!compact && (
              <p className="text-sm text-muted-foreground">
                Valide a montagem antes de exportar.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Analise local + IA (se configurada)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={rows.length === 0 || isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Brain className="h-4 w-4 mr-1" />
            )}
            Analisar montagem
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {validationResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <StatusBadge status={validationResult.status} />
            </div>

            {validationResult.summary && (
              <p className="text-xs text-muted-foreground">
                {validationResult.summary}
              </p>
            )}

            {validationResult.requiresManualConfirmation && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs text-orange-800 font-medium">
                  Confirmacao manual necessaria devido a problemas de montagem.
                </p>
              </div>
            )}

            {validationResult.rowWarnings && validationResult.rowWarnings.length > 0 && (
              <div className="space-y-2">
                {validationResult.rowWarnings.map((rw) => (
                  (rw.warnings.length > 0 || rw.problems.length > 0) && (
                    <div key={rw.rowId} className="rounded border p-2 space-y-1">
                      <p className="text-xs font-medium">{rw.rowTitle}</p>
                      {rw.problems.length > 0 && (
                        <div className="flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
                          <ul className="space-y-0.5">
                            {rw.problems.map((p, i) => (
                              <li key={i} className="text-xs text-red-700">{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rw.warnings.length > 0 && (
                        <ul className="space-y-0.5 ml-4">
                          {rw.warnings.map((w, i) => (
                            <li key={i} className="text-xs text-yellow-700">{w}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}

            <WarningCard warnings={validationResult.batchWarnings} />

            {validationResult.batchWarnings.length === 0 &&
              (!validationResult.rowWarnings ||
                validationResult.rowWarnings.every(
                  (rw) => rw.warnings.length === 0 && rw.problems.length === 0
                )) && (
                <p className="text-xs text-green-700">
                  Nenhum problema encontrado.
                </p>
              )}
          </div>
        )}

        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Adicione linhas de montagem para validar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
