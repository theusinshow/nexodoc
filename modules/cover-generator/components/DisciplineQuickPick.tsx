"use client";

import { Button } from "@/components/ui/button";

const DISCIPLINE_OPTIONS = [
  "PROJETO ARQUITETONICO",
  "PROJETO ESTRUTURAL EM CONCRETO",
  "PROJETO DE FUNDACOES",
  "PROJETO ELETRICO",
  "PROJETO HIDROSSANITARIO",
  "PROJETO PREVENTIVO CONTRA INCENDIO",
  "PROJETO DE DRENAGEM PLUVIAL",
  "PROJETO DE TERRAPLENAGEM",
  "PROJETO DE PAVIMENTACAO",
  "LEVANTAMENTO TOPOGRAFICO",
  "SONDAGEM",
  "MEMORIAL DESCRITIVO",
];

interface DisciplineQuickPickProps {
  value: string;
  onChange: (value: string) => void;
}

export function DisciplineQuickPick({ value, onChange }: DisciplineQuickPickProps) {
  const selectedLines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  function toggleDiscipline(option: string) {
    const exists = selectedLines.includes(option);
    const nextLines = exists
      ? selectedLines.filter((line) => line !== option)
      : [...selectedLines, option];

    onChange(nextLines.join("\n"));
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-2">
      <div className="flex flex-wrap gap-1.5">
        {DISCIPLINE_OPTIONS.map((option) => {
          const selected = selectedLines.includes(option);

          return (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 px-2 text-[11px] ${
                selected
                  ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                  : "hover:border-primary/60"
              }`}
              onClick={() => toggleDiscipline(option)}
            >
              {option}
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Clique para adicionar ou remover. O campo continua editavel para nomes especificos.
      </p>
    </div>
  );
}
