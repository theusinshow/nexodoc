"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TomoFormat, VolumeFormat, CoverTitleMode } from "@/lib/cover-utils";

export interface TemplateOption {
  id: string;
  nome: string;
  grupo?: string;
  variante?: string;
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
  const groups = useMemo(() => {
    const map = new Map<string, TemplateOption[]>();
    for (const template of templates) {
      const key = template.grupo || template.nome;
      const list = map.get(key);
      if (list) list.push(template);
      else map.set(key, [template]);
    }
    return Array.from(map, ([nome, variantes]) => ({ nome, variantes }));
  }, [templates]);

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
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
          Escolha a prefeitura e, quando houver mais de um padrao, a variacao.
          Cada variacao define o arquivo ODT oficial, marcadores aceitos e
          formato de volume usado nas proximas etapas.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
        {groups.map((group) => {
          const active =
            group.variantes.find((v) => v.id === templateId) ?? group.variantes[0];
          const isGroupSelected = group.variantes.some((v) => v.id === templateId);
          const volumeFormat =
            active.volumeFormat ?? active.defaults.volumeFormat ?? "roman";
          const showSecretaria = active.campos.includes("SECRETARIA");
          const multiVariant = group.variantes.length > 1;
          return (
            <div
              key={group.nome}
              className={cn(
                "border p-4 space-y-3 transition",
                isGroupSelected ? "border-primary bg-primary/5" : "border-border bg-card"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h4 className="text-sm font-semibold">{group.nome}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {volumeFormat === "numeric" ? "Volume numerico" : "Volume romano"}
                </Badge>
                {multiVariant && (
                  <Badge variant="secondary" className="text-[10px]">
                    {group.variantes.length} variacoes
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {group.variantes.map((variant) => {
                  const isSelected = variant.id === templateId;
                  return (
                    <Button
                      key={variant.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(variant)}
                      className={cn(
                        "h-8 gap-1.5 px-3 text-xs",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary"
                          : "hover:border-ring"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {variant.variante ?? variant.nome}
                    </Button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {active.arquivoTemplate} &middot;{" "}
                {active.defaults.fase || "Sem fase padrao"}
                {showSecretaria && active.defaults.secretaria
                  ? ` · ${active.defaults.secretaria}`
                  : ""}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {active.campos.slice(0, 8).map((campo) => (
                  <Badge key={campo} variant="secondary" className="text-[10px]">
                    {campo}
                  </Badge>
                ))}
                {active.campos.length > 8 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{active.campos.length - 8}
                  </Badge>
                )}
              </div>
            </div>
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
                <p className="text-sm font-medium">
                  {selectedTemplate.grupo || selectedTemplate.nome}
                </p>
                {selectedTemplate.variante && (
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    {selectedTemplate.variante}
                  </p>
                )}
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
