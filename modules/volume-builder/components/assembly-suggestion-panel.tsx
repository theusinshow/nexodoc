"use client";

import { useState } from "react";
import type { ImportedPdfFile, PageAsset, VolumeMetadata } from "@/modules/volume-builder/lib/volume/volume-types";
import type {
  AssemblySuggestion,
  AssemblySuggestionResponse,
} from "@/modules/volume-builder/lib/volume/assembly-suggestion-types";
import { getVolumeApiEndpoint } from "@/modules/volume-builder/lib/utils/volume-api-endpoint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, Check, Loader2, Wand2 } from "lucide-react";

interface AssemblySuggestionPanelProps {
  metadata: VolumeMetadata;
  importedFiles: ImportedPdfFile[];
  pageAssets: PageAsset[];
  onApplySuggestion: (suggestion: AssemblySuggestion) => void;
}

export function AssemblySuggestionPanel({
  metadata,
  importedFiles,
  pageAssets,
  onApplySuggestion,
}: AssemblySuggestionPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AssemblySuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSuggest() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetch(getVolumeApiEndpoint("/api/volume/suggest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, importedFiles, pageAssets }),
      });

      if (!result.ok) {
        const message = await readErrorResponse(result);
        throw new Error(message);
      }

      const data = (await result.json()) as AssemblySuggestionResponse;
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }

  const suggestions = response?.suggestions ?? [];

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-[var(--nexodoc-tertiary)]" />
              <h3 className="text-sm font-semibold">Pre-montagem com IA</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Sugere capa, LD, separatriz e pranchas antes da revisao manual.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={isLoading || pageAssets.length === 0}
            onClick={handleSuggest}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Sugerir montagem
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/35 bg-[var(--status-critical-bg)] p-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {response?.source === "ai" ? "IA" : "Local"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {suggestions.length} sugestao(oes) encontradas
              </span>
            </div>

            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{suggestion.title}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.outputFileName}</p>
                  </div>
                  <Badge variant={getConfidenceVariant(suggestion.confidence)}>
                    {CONFIDENCE_LABELS[suggestion.confidence]}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  <SuggestionMetric label="Capa" value={suggestion.coverAssetId ? "1" : "0"} />
                  <SuggestionMetric label="LD" value={suggestion.ldAssetId ? "1" : "0"} />
                  <SuggestionMetric label="Pranchas" value={String(suggestion.documentAssetIds.length)} />
                  <SuggestionMetric label="Separatriz" value="Auto" />
                </div>

                <div className="mt-3 rounded-md border bg-background/60 p-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Separatriz</p>
                  <p className="mt-1 text-xs font-semibold uppercase">{suggestion.separatorTitle}</p>
                </div>

                {suggestion.notes.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {suggestion.notes.slice(0, 3).map((note, index) => (
                      <p key={`${note}-${index}`} className="text-[11px] text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  className="mt-3 h-8 text-xs"
                  onClick={() => onApplySuggestion(suggestion)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Aplicar esta sugestao
                </Button>
              </div>
            ))}

            {response && response.warnings.length > 0 && (
              <div className="rounded-md border border-[var(--nexodoc-tertiary-strong)]/35 bg-[var(--nexodoc-tertiary-bg)] p-2">
                {response.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`} className="text-[11px] text-[var(--nexodoc-tertiary)]">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/60 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

/**
 * A confiança da sugestão, como VARIANTE do `<Badge>`.
 *
 * Devolvia as classes à mão, e o sítio que a consumia já era
 * `<Badge variant="outline" className={...}>` — o componente estava ali, sendo
 * contrariado por uma string. `emphasis` é o rust, que é exatamente o que o
 * caso do meio pintava: ênfase, não status. Ver `scripts/prova-badge-a-mao.mjs`.
 */
function getConfidenceVariant(confidence: AssemblySuggestion["confidence"]) {
  if (confidence === "high") return "ok" as const;
  if (confidence === "medium") return "emphasis" as const;
  return "critical" as const;
}

const CONFIDENCE_LABELS: Record<AssemblySuggestion["confidence"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

async function readErrorResponse(response: Response) {
  const type = response.headers.get("Content-Type") ?? "";

  if (type.includes("application/json")) {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "Erro ao sugerir montagem.";
  }

  return (await response.text()) || "Erro ao sugerir montagem.";
}
