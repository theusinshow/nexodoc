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

import type { ReactNode, RefObject } from "react";
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
  trailing,
  motivoDesabilitado,
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
  /** Peça opcional à esquerda do enviar (hoje: o anel de consumo). */
  trailing?: ReactNode;
  /**
   * Desabilita o campo E diz por quê, no placeholder. Vazio = habilitado.
   * Nunca desabilite sem passar isto.
   */
  motivoDesabilitado?: string;
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
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
          disabled={Boolean(motivoDesabilitado)}
          /*
           * Campo desabilitado MUDO é uma parede sem porta: o engenheiro clica,
           * nada acontece, e ele não tem como saber se é a rede, a conta ou um
           * defeito. O motivo ocupa o próprio placeholder.
           */
          placeholder={
            motivoDesabilitado
              ? motivoDesabilitado
              : isHero
                ? "Peça em texto: “cria a LD e a capa dessas pranchas”…"
                : "Escreva para o Nexo…"
          }
          className="max-h-32 min-h-9 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
        />
        {trailing}
        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden />
          </button>
        ) : (
          /*
           * Enviar ACENDE em teal quando há o que enviar — é a única mudança de
           * cor do composer. Cinza sem texto, teal com texto: o botão diz se a
           * ação existe antes do clique.
           */
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim() || Boolean(motivoDesabilitado)}
            aria-label="Enviar"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-40 disabled:hover:bg-transparent",
              value.trim() && !busy && !motivoDesabilitado
                ? "text-primary hover:bg-accent"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
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
