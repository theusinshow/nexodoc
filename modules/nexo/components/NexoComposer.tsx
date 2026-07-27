"use client";

/**
 * NexoComposer — o dock unificado (§8, primitivo #1). GlassPanel com anel teal no
 * foco (chrome ambiente = vidro; §6/Apêndice H). Duas variantes da MESMA instância
 * (o nó é reposicionado, nunca remontado — §1): `hero` no welcome (com dica de
 * dropzone), `docked` na conversa. Enter envia; Shift+Enter quebra linha.
 *
 * Não é dono de estado: `value`/`onChange`/`onSubmit` vêm do NexoChat (que detém o
 * histórico e registra os controles do composer). O `inputRef` é do NexoChat, para
 * os chips `fill` focarem/posicionarem o cursor aqui.
 */

import type { RefObject } from "react";
import { Paperclip, Send, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/glass-panel";

export function NexoComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  variant,
  onAttach,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** Aborta o turno em andamento (o enviar vira parar enquanto `busy`). */
  onStop?: () => void;
  busy: boolean;
  variant: "hero" | "docked";
  onAttach?: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const isHero = variant === "hero";
  return (
    <GlassPanel className="nexo-composer">
      <div className="flex items-end gap-2 p-2">
        {onAttach && (
          <button
            type="button"
            onClick={onAttach}
            aria-label="Anexar PDFs"
            className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Paperclip className="h-4 w-4" aria-hidden />
          </button>
        )}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => {
            // Auto-grow: zera e reassume a altura do conteúdo (o max-h corta).
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy) onSubmit();
            }
          }}
          rows={1}
          placeholder={
            isHero
              ? "Peça em texto: “cria a LD e a capa dessas pranchas”…"
              : "Escreva para o Nexo…"
          }
          className="max-h-32 min-h-9 min-w-0 flex-1 resize-none self-center overflow-y-auto bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar"
            className="shrink-0 rounded-sm p-1.5 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            aria-label="Enviar"
            className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {isHero && (
        <p className={cn("px-3 pb-2 text-xs text-muted-foreground")}>
          Ou arraste os PDFs do projeto para qualquer lugar da tela.
        </p>
      )}
    </GlassPanel>
  );
}
