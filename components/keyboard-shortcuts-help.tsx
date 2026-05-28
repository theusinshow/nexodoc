"use client";

import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

type ShortcutItem = {
  keys: string[];
  description: string;
};

export const GLOBAL_SHORTCUTS: ShortcutItem[] = [
  { keys: ["Ctrl", "G"], description: "Ir para o dashboard" },
  { keys: ["Ctrl", "A"], description: "Ir para auditoria" },
  { keys: ["Ctrl", "L"], description: "Ir para montagem de LDs" },
  { keys: ["Ctrl", "Shift", "A"], description: "Ir para painel admin" },
  { keys: ["?"], description: "Mostrar atalhos de teclado" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "?",
        handler: () => setOpen((prev) => !prev),
        description: "Mostrar atalhos de teclado",
        shift: true,
      },
      {
        key: "Escape",
        handler: () => setOpen(false),
        description: "Fechar ajuda de teclado",
      },
    ],
  });

  useEffect(() => {
    if (open) {
      function handleEsc(event: KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      }
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-md rounded-md border border-border bg-card p-6 shadow-panel"
        role="dialog"
        aria-label="Atalhos de teclado"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
            <Keyboard className="size-4" />
            Atalhos
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
          >
            <span aria-hidden="true">&times;</span>
          </Button>
        </div>
        <div className="mt-4 divide-y divide-border">
          {GLOBAL_SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, idx) => (
                  <span key={idx}>
                    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
                      {key === "Shift" ? "⇧" : key}
                    </kbd>
                    {idx < shortcut.keys.length - 1 && (
                      <span className="mx-0.5 text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Pressione <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1 font-mono text-[11px]">?</kbd> para abrir e <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1 font-mono text-[11px]">Esc</kbd> para fechar.
        </p>
      </div>
    </div>
  );
}
