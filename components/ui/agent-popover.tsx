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
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={cn(
            "nexodoc-enter absolute left-1/2 top-[calc(100%+8px)] z-50 w-64 -translate-x-1/2",
            "rounded-lg border bg-[var(--nexodoc-panel)] p-3 shadow-lg shadow-black/20 outline-none",
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
