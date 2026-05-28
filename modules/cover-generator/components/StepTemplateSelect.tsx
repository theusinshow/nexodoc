"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TomoFormat, VolumeFormat, CoverTitleMode } from "@/lib/cover-utils";

export interface TemplateOption {
  id: string;
  nome: string;
  arquivoTemplate: string;
  volumeFormat?: VolumeFormat;
  tomoFormat?: TomoFormat;
  coverTitleMode?: CoverTitleMode;
  defaults: {
    orgao: string;
    secretaria: string;
    fase: string;
    volumeFormat?: VolumeFormat;
    tomoFormat?: TomoFormat;
    coverTitleMode?: CoverTitleMode;
  };
  campos: string[];
}

interface StepTemplateSelectProps {
  templateId: string;
  onSelect: (template: TemplateOption) => void;
  onNext: () => void;
}

export function StepTemplateSelect({
  templateId,
  onSelect,
  onNext,
}: StepTemplateSelectProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templates, templateId]
  );

  useEffect(() => {
    fetch("/api/capas/templates")
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        return res.json();
      })
      .then((data) => setTemplates(data.templates ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar templates"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="font-mono text-xs text-muted-foreground">Carregando templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/30 bg-destructive/8 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum template encontrado. Adicione templates em{" "}
          <code className="border border-border bg-muted px-1 py-0.5 font-mono text-xs">
            templates/capas/
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Modelo da capa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma prefeitura. O modelo define o arquivo ODT oficial,
          marcadores aceitos e formato de volume usado nas proximas etapas.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
        {templates.map((template) => {
          const isSelected = templateId === template.id;
          const volumeFormat =
            template.volumeFormat ?? template.defaults.volumeFormat ?? "roman";
          const showSecretaria = template.campos.includes("SECRETARIA");
          return (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              onClick={() => onSelect(template)}
              className={cn(
                "h-auto w-full justify-start p-0 text-left transition hover:border-ring",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "bg-card"
              )}
            >
              <div className="flex w-full items-start gap-4 p-4">
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold">{template.nome}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {volumeFormat === "numeric" ? "Volume numerico" : "Volume romano"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.arquivoTemplate} &middot; {template.defaults.fase || "Sem fase padrao"}
                  </p>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span className="truncate">Orgao: {template.defaults.orgao || "preencher depois"}</span>
                    {showSecretaria && (
                      <span className="truncate">Secretaria: {template.defaults.secretaria || "preencher depois"}</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.campos.slice(0, 8).map((campo) => (
                      <Badge
                        key={campo}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {campo}
                      </Badge>
                    ))}
                    {template.campos.length > 8 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{template.campos.length - 8}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
        </div>

        <aside className="border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Modelo selecionado</h3>
          </div>

          {selectedTemplate ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedTemplate.nome}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ODT: {selectedTemplate.arquivoTemplate}
                </p>
              </div>

              <div className="border border-border bg-muted p-3 font-mono text-xs text-muted-foreground">
                Os campos padrao entram no formulario seguinte, mas continuam
                editaveis antes da geracao.
              </div>

              <Button className="w-full" onClick={onNext}>
                Continuar com este modelo
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Selecione um modelo na lista para liberar a proxima etapa.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
