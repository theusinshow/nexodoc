"use client";

/**
 * Navegação do canvas: ir para um tomo e atalhos de teclado.
 *
 * Zoom e "ajustar à tela" já vêm do `<Controls />` do React Flow — o que faltava
 * era ORIENTAÇÃO. Com uma fileira por tomo, o problema deixou de ser ampliar e
 * passou a ser saber onde se está e chegar lá sem rolar procurando.
 */

import { useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

/** Uma fileira navegável: o tomo e os ids dos nós que moram nela. */
export interface FileiraNavegavel {
  tomo: number;
  ids: string[];
}

const MARGEM = 0.25;

export function NavegacaoDoCanvas({ fileiras }: { fileiras: FileiraNavegavel[] }) {
  const fluxo = useReactFlow();

  const irPara = useCallback(
    (ids: string[]) => {
      const nos = fluxo.getNodes().filter((n) => ids.includes(n.id));
      if (nos.length === 0) return;
      // Caixa que envolve a fileira inteira. `measured` traz o tamanho real
      // medido; sem ele o enquadramento sai apertado nos nós mais altos.
      const x1 = Math.min(...nos.map((n) => n.position.x));
      const y1 = Math.min(...nos.map((n) => n.position.y));
      const x2 = Math.max(...nos.map((n) => n.position.x + (n.measured?.width ?? 220)));
      const y2 = Math.max(...nos.map((n) => n.position.y + (n.measured?.height ?? 300)));
      fluxo.fitBounds(
        { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
        { padding: MARGEM, duration: 300 },
      );
    },
    [fluxo],
  );

  /*
   * Atalhos. Inertes quando o foco está num campo de texto: senão digitar "0"
   * no chat reenquadraria o canvas no meio da frase.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.isContentEditable;
      if (digitando || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        fluxo.zoomIn({ duration: 200 });
      } else if (e.key === "-") {
        e.preventDefault();
        fluxo.zoomOut({ duration: 200 });
      } else if (e.key === "0") {
        e.preventDefault();
        fluxo.fitView({ padding: MARGEM, duration: 300 });
      } else if (/^[1-9]$/.test(e.key)) {
        const alvoFileira = fileiras[Number(e.key) - 1];
        if (alvoFileira) {
          e.preventDefault();
          irPara(alvoFileira.ids);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fluxo, fileiras, irPara]);

  // Com uma fileira só, a barra seria ruído: não há para onde navegar.
  if (fileiras.length <= 1) return null;

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-border bg-[var(--nexodoc-panel)] p-1 shadow-[var(--shadow-panel)]">
      {fileiras.map((f, i) => (
        <button
          key={f.tomo}
          type="button"
          onClick={() => irPara(f.ids)}
          title={`Ir para ${f.tomo > 0 ? `o tomo ${f.tomo}` : "o que está fora da divisão"} (tecla ${i + 1})`}
          className={
            f.tomo === 0
              ? "rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.07em] text-[var(--status-warning)] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
              : "rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          }
        >
          {f.tomo > 0 ? `Tomo ${String(f.tomo).padStart(2, "0")}` : "Fora da divisão"}
        </button>
      ))}
    </div>
  );
}
