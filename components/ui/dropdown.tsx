"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  medirLugarDaSobreposicao,
  type LugarDaSobreposicao,
} from "./posicao-da-sobreposicao";

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
  const [lugar, setLugar] = React.useState<LugarDaSobreposicao | null>(null);

  /*
   * ONDE O MENU CABE.
   *
   * Este primitivo abria SEMPRE para baixo, sem teto de altura — o mesmo padrão
   * que fez um popover do canvas descer para fora da janela mostrando só o
   * cabeçalho, com os itens no DOM e toda asserção passando verde. Aqui morde
   * no menu de ações de um achado do fim de uma lista longa, e dentro de um
   * cartão `overflow-hidden` morde independentemente da posição na janela.
   *
   * O deslocamento horizontal não se aplica: o menu alinha pela borda do
   * gatilho (`left-0`/`right-0`), não pelo centro dele.
   */
  React.useLayoutEffect(() => {
    if (!open) return;
    function medir() {
      if (ref.current) setLugar(medirLugarDaSobreposicao(ref.current, null));
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [open]);

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
        /* O pai existe SO para a sombra: `filter` no painel recortado seria
           cortado junto (filter e aplicado ANTES de clip-path), e `box-shadow`
           externo idem. Num pai nao recortado, o drop-shadow segue a silhueta
           chanfrada do filho -- que e exatamente o que se quer. */
        <div
          className={cn(
            "nx-elev absolute z-50",
            lugar?.lado === "acima"
              ? "bottom-[calc(100%+4px)]"
              : "top-[calc(100%+4px)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div
            role="menu"
            style={lugar ? { maxHeight: lugar.alturaMax } : undefined}
            className={cn(
              "nexodoc-enter nx-edge-6 min-w-[180px] overflow-y-auto overscroll-contain p-1 [--nx-fill:var(--nexodoc-panel)]",
              panelClassName,
            )}
          >
            {children({ close: () => setOpen(false) })}
          </div>
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
        "nx-cut-5 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-foreground outline-none transition-colors hover:bg-[var(--nexodoc-raised)] focus-visible:bg-[var(--nexodoc-raised)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
