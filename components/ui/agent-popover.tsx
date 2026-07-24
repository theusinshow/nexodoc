"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Popover de STATUS controlado, ancorado abaixo do gatilho. Irmão do `Dropdown`
 * (mesma mecânica: fecha no clique-fora e no Escape), mas com semântica de
 * `role="dialog"` — é um cartão de status, não um menu de ações.
 *
 * O `anchor` (ex.: o orb) mantém o próprio clique/toggle; este componente só
 * cuida do painel e do fechamento. O ref envolve anchor + painel, então clicar
 * de novo no gatilho não conta como "clique fora".
 */
export function AgentPopover({
  open,
  onClose,
  anchor,
  label,
  children,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.ReactNode;
  /** aria-label do diálogo. */
  label: string;
  children: React.ReactNode;
  panelClassName?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  // Move o foco pro painel ao abrir (Escape + leitor de tela). Via rAF p/ não
  // roubar o foco antes do painel montar.
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {anchor}
      {open ? (
        // Posicionador (X estático — sobrevive ao reduced-motion) + painel animado.
        <div className="absolute left-1/2 top-[calc(100%+10px)] z-50 -translate-x-1/2">
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            className={cn(
              "nexo-popover relative w-[248px] rounded-xl border border-border bg-[var(--nexodoc-panel)] p-3.5 outline-none",
              panelClassName,
            )}
          >
            {/* Bico apontando para o orb (conexão visual, some a sensação de flutuar solto). */}
            <span
              aria-hidden
              className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border-l border-t border-border bg-[var(--nexodoc-panel)]"
            />
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
