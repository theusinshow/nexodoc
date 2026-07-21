"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TomoFormat, VolumeFormat, CoverTitleMode } from "@/lib/cover-utils";

const LOGO_STOPWORDS = new Set(["prefeitura", "municipal", "de", "do", "da", "dos", "das", "e"]);

/** Iniciais da cidade para o slot de logo (placeholder ate ter o brasao real). */
function getInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !LOGO_STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Slot do logotipo da prefeitura. Hoje renderiza o monograma (iniciais da
 * cidade); quando houver arquivos de brasao, trocar por <Image>.
 */
function TemplateLogo({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-mono text-xs font-semibold uppercase tracking-tight text-muted-foreground"
    >
      {getInitials(name)}
    </div>
  );
}

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
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-md border border-destructive/30 bg-destructive/8 p-6 text-center"
      >
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum template encontrado. Adicione templates em{" "}
          <code className="rounded-sm border border-border bg-muted px-1 py-0.5 font-mono text-xs">
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
        <h2 className="text-2xl font-medium tracking-[-0.01em]">Modelo da capa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha a prefeitura. Quando houver mais de um padrao, selecione a
          variacao.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
        {groups.map((group) => {
          const isGroupSelected = group.variantes.some((v) => v.id === templateId);
          const cardBase = cn(
            "rounded-md border p-4 transition",
            isGroupSelected ? "border-primary bg-primary/5" : "border-border bg-card"
          );

          // Prefeitura com um unico padrao: o card inteiro seleciona (sem chip redundante).
          if (group.variantes.length === 1) {
            const variant = group.variantes[0];
            const selected = variant.id === templateId;
            return (
              <button
                key={group.nome}
                type="button"
                onClick={() => onSelect(variant)}
                aria-pressed={selected}
                className={cn(cardBase, "flex w-full items-center gap-3 text-left hover:border-ring")}
              >
                <TemplateLogo name={group.nome} />
                <span className="text-sm font-semibold leading-snug">{group.nome}</span>
                {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          }

          return (
            <div key={group.nome} className={cn(cardBase, "space-y-3")}>
              <div className="flex items-center gap-3">
                <TemplateLogo name={group.nome} />
                <h4 className="text-sm font-semibold leading-snug">{group.nome}</h4>
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
                      aria-pressed={isSelected}
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
            </div>
          );
        })}
        </div>

        <aside className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Modelo selecionado</h3>
          </div>

          {selectedTemplate ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <TemplateLogo name={selectedTemplate.grupo || selectedTemplate.nome} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {selectedTemplate.grupo || selectedTemplate.nome}
                  </p>
                  {selectedTemplate.variante && (
                    <p className="mt-0.5 text-xs font-medium text-primary">
                      {selectedTemplate.variante}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs text-muted-foreground">
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
