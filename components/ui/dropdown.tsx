"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TriggerState = { open: boolean; toggle: () => void };
type PanelState = { close: () => void };

// Popover controlado e reutilizável: fecha ao clicar fora e no Escape.
// Não há dependência de dropdown no Radix instalada; este primitivo cobre os
// menus de ação (Exportar, overflow) e o popover de configuração da auditoria.
export function Dropdown({
  trigger,
  children,
  align = "end",
  panelClassName,
}: {
  trigger: (state: TriggerState) => React.ReactNode;
  children: (state: PanelState) => React.ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open ? (
        <div
          role="menu"
          className={cn(
            "nexodoc-enter absolute top-[calc(100%+4px)] z-50 min-w-[180px] rounded-md border bg-[var(--nexodoc-panel)] p-1 shadow-lg shadow-black/20",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-foreground outline-none transition-colors hover:bg-[var(--nexodoc-raised)] focus-visible:bg-[var(--nexodoc-raised)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
