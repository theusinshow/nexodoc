"use client";

import * as React from "react";
import { createPortal } from "react-dom";

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
  const painelRef = React.useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = React.useState<LugarDaSobreposicao | null>(null);
  /** Coordenadas de TELA do painel. Nulas antes da primeira medida. */
  const [caixa, setCaixa] = React.useState<React.CSSProperties | null>(null);

  /*
   * O PAINEL SAI DA ÁRVORE, e vai para o `<body>`.
   *
   * Ele era `absolute` dentro do gatilho, e por isso qualquer ancestral que
   * recorte o levava junto: `overflow-hidden` cortava, e `clip-path` corta
   * SEMPRE, esteja onde estiver na janela. O cartão de achado carregava a
   * cicatriz disso — um comentário pedindo para ninguém pôr `overflow-hidden`
   * nele, e a geometria travada em `rounded-md` porque o chanfro cortaria o
   * menu. Contornar a falta de portal em cada consumidor não escala: o próximo
   * a recortar um ancestral não vai saber que existe essa dívida.
   *
   * Com o portal o painel é `fixed` e não tem ancestral que o recorte. O preço
   * é que `fixed` não acompanha rolagem de contêiner — por isso a medida se
   * refaz no `scroll` (em captura, para pegar QUALQUER contêiner que role, e
   * não só a janela) e no `resize`.
   */
  React.useLayoutEffect(() => {
    if (!open) return;

    function medir() {
      const gatilho = ref.current;
      if (!gatilho) return;

      const onde = medirLugarDaSobreposicao(gatilho, painelRef.current);
      const r = gatilho.getBoundingClientRect();

      setLugar(onde);
      setCaixa({
        position: "fixed",
        /*
         * Ancorado pela BORDA, e não pelo centro: o menu alinha com a lateral
         * do gatilho (era `right-0` / `left-0`). Usar `right`/`bottom` evita
         * precisar da largura do painel, que ainda não existe na primeira
         * medida — a conta não depende do resultado dela mesma.
         */
        ...(onde.lado === "acima"
          ? { bottom: window.innerHeight - r.top + 4 }
          : { top: r.bottom + 4 }),
        ...(align === "end"
          ? { right: window.innerWidth - r.right }
          : { left: r.left }),
      });
    }

    medir();
    window.addEventListener("resize", medir);
    // `true` = fase de captura: pega a rolagem de qualquer contêiner no caminho,
    // e não só a da janela. Sem isso o menu fica parado no ar ao rolar a lista.
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [open, align]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      const alvo = event.target as Node;
      // O painel NÃO é mais descendente do gatilho: os dois precisam ser
      // consultados, senão clicar dentro do próprio menu o fecha.
      const dentroDoGatilho = ref.current?.contains(alvo);
      const dentroDoPainel = painelRef.current?.contains(alvo);
      if (!dentroDoGatilho && !dentroDoPainel) {
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

  const painel =
    open && caixa ? (
      /* O pai existe SO para a sombra: `filter` no painel recortado seria
         cortado junto (filter e aplicado ANTES de clip-path), e `box-shadow`
         externo idem. Num pai nao recortado, o drop-shadow segue a silhueta
         chanfrada do filho -- que e exatamente o que se quer. */
      <div className="nx-elev z-50" style={caixa}>
        <div
          ref={painelRef}
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
    ) : null;

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {painel && typeof document !== "undefined"
        ? createPortal(painel, document.body)
        : null}
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
        "nx-cut-5 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-foreground outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-feedback)] hover:bg-[var(--nexodoc-raised)] focus-visible:bg-[var(--nexodoc-raised)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
