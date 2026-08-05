"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Popover de STATUS controlado, ancorado ao gatilho. Irmão do `Dropdown`
 * (mesma mecânica: fecha no clique-fora e no Escape), mas com semântica de
 * `role="dialog"` — é um cartão de status, não um menu de ações.
 *
 * O `anchor` (ex.: o orb) mantém o próprio clique/toggle; este componente só
 * cuida do painel e do fechamento. O ref envolve anchor + painel, então clicar
 * de novo no gatilho não conta como "clique fora".
 *
 * ELE CABE NA TELA. Abria sempre para baixo, o que servia ao orb (que mora no
 * topo) e falhava calado no canvas: ancorado num nó da parte de baixo, o painel
 * descia para fora da janela e só o cabeçalho ficava visível. Os campos
 * continuavam no DOM — um teste que só consulta o DOM passa verde com o painel
 * invisível, e foi exatamente assim que o frame da capa "não funcionou".
 *
 * Por isso a medição roda no layout: escolhe o lado com mais espaço e limita a
 * altura ao que sobra, com rolagem por dentro. Dentro do React Flow o nó vive
 * sob um `transform: scale`, então o espaço em pixels de tela é convertido para
 * a escala local — senão o limite encolheria junto com o zoom.
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
  const [lugar, setLugar] = React.useState<{
    lado: "abaixo" | "acima";
    alturaMax: number;
  } | null>(null);

  /*
   * De que lado cabe. Mede a ÂNCORA (não o painel): o painel já está preso ao
   * lado antigo quando a medição roda, e usá-lo faria a decisão oscilar.
   */
  React.useLayoutEffect(() => {
    if (!open) return;

    function medir() {
      const raiz = rootRef.current;
      if (!raiz) return;
      const r = raiz.getBoundingClientRect();
      const MARGEM = 16;
      const BICO = 10;
      const abaixo = window.innerHeight - r.bottom - MARGEM - BICO;
      const acima = r.top - MARGEM - BICO;
      // A escala do React Flow: o rect vem em pixels de TELA, o max-height é
      // aplicado em pixels LOCAIS. Sem converter, o painel encolhe com o zoom.
      const escala = raiz.offsetHeight > 0 ? r.height / raiz.offsetHeight : 1;
      const lado = abaixo >= acima ? "abaixo" : "acima";
      const espaco = Math.max(abaixo, acima);
      setLugar({
        lado,
        alturaMax: Math.max(160, espaco / (escala || 1)),
      });
    }

    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [open]);

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
        <div
          className={cn(
            "absolute left-1/2 z-50 -translate-x-1/2",
            lugar?.lado === "acima"
              ? "bottom-[calc(100%+10px)]"
              : "top-[calc(100%+10px)]",
          )}
        >
          {/* Bico apontando para a âncora (conexão visual, some a sensação de
              flutuar solto). Vive FORA do painel porque ele agora rola: dentro,
              o `overflow` o cortaria e ainda pediria barra horizontal. Segue o
              lado escolhido — do contrário apontaria para o vazio ao subir. */}
          <span
            aria-hidden
            className={cn(
              "absolute left-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-[var(--nexodoc-panel)]",
              lugar?.lado === "acima"
                ? "-bottom-[5px] border-b border-r border-border"
                : "-top-[5px] border-l border-t border-border",
            )}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={lugar ? { maxHeight: lugar.alturaMax } : undefined}
            className={cn(
              "nexo-popover relative w-[248px] overflow-y-auto overscroll-contain rounded-xl border border-border bg-[var(--nexodoc-panel)] p-3.5 outline-none",
              panelClassName,
            )}
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
