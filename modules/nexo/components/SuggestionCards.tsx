"use client";

/**
 * Pré-opções do welcome (Apêndice E, locked). 4 cards contextuais que PREENCHEM
 * o composer (editável) — nunca executam (decisão #6). Clicar preenche a frase e
 * dispara o slide welcome→active (`onPick`), deixando o controle na conversa.
 *
 * "Conferir" e "Gerar separatriz" existem só por texto/dentro do fluxo — não
 * viram card em destaque. O re-rótulo contextual ao soltar PDFs ("Montar volume
 * com estes 8 arquivos") é um incremento leve: aceito `fileCount` e ajusto o
 * texto quando houver arquivos; o resto é o passo do dropzone-overlay (glass).
 */

import { cn } from "@/lib/utils";
import { useComposer } from "../state/composer-controller";

interface Suggestion {
  emoji: string;
  label: string;
  desc: string;
  /** Frase-andaime escrita no composer (o usuário edita e envia). */
  phrase: string;
}

function buildSuggestions(fileCount: number): Suggestion[] {
  const comEstes = fileCount > 0 ? ` com estes ${fileCount} arquivos` : "";
  return [
    {
      emoji: "📦",
      label: fileCount > 0 ? `Montar volume${comEstes}` : "Montar volume",
      desc: "Lê selos → capa + separatriz + LD → volume (cruza disciplinas).",
      phrase: `Monta o volume${comEstes}`,
    },
    {
      emoji: "📋",
      label: "Gerar LD",
      desc: "Só a lista de documentos.",
      phrase: "Gera a LD dessas pranchas",
    },
    {
      emoji: "🏛️",
      label: "Gerar capa",
      desc: "Só a capa.",
      phrase: "Gera a capa dessas pranchas",
    },
    {
      emoji: "🔍",
      label: "Auditar memorial",
      desc: "Memorial contra a obra.",
      phrase: "Audita o memorial contra a obra",
    },
  ];
}

export function SuggestionCards({
  onPick,
  fileCount = 0,
  className,
}: {
  onPick: () => void;
  fileCount?: number;
  className?: string;
}) {
  const composer = useComposer();
  const suggestions = buildSuggestions(fileCount);

  function pick(phrase: string) {
    composer.fill(phrase);
    onPick();
  }

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {suggestions.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => pick(s.phrase)}
          className="nexodoc-enter group flex flex-col items-start gap-1 rounded-md border border-border bg-card p-3 text-left transition-[border-color,background-color,transform] duration-150 ease-out hover:border-ring hover:bg-accent active:translate-y-px focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {s.emoji}
            </span>
            <span className="text-sm font-medium">{s.label}</span>
          </span>
          <span className="text-xs text-muted-foreground">{s.desc}</span>
        </button>
      ))}
    </div>
  );
}
