"use client";

/**
 * Barra do canvas: ir para um tomo, criar tomo, desfazer a divisão manual.
 *
 * É um SEGMENTED CONTROL (DESIGN.md §5): faixa recessada, rótulo mono à esquerda,
 * chips dentro. Antes era texto solto de 10px sem hierarquia — dava para ver que
 * havia algo clicável, mas não o que cada coisa fazia.
 *
 * As duas ações ficam depois de um divisor: navegar não muda nada, criar tomo e
 * voltar ao automático MUDAM o documento. A separação é o que impede o clique
 * distraído.
 */

import { useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { Plus, RotateCcw } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Uma fileira navegável: o tomo e os ids dos nós que moram nela. */
export interface FileiraNavegavel {
  tomo: number;
  ids: string[];
}

const MARGEM = 0.25;

export function NavegacaoDoCanvas({
  fileiras,
  temGrupoManual = false,
  onVoltarAoAutomatico,
  onCriarTomo,
  proximoTomo = 0,
}: {
  fileiras: FileiraNavegavel[];
  /** Alguma folha tem tomo decidido à mão — só aí faz sentido desfazer. */
  temGrupoManual?: boolean;
  onVoltarAoAutomatico?: () => void;
  /** Declara mais um tomo: a fileira nasce vazia e vira destino de arrasto. */
  onCriarTomo?: () => void;
  /** Qual tomo o botão vai criar — o rótulo diz o número, não "mais um". */
  proximoTomo?: number;
}) {
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

  const podeNavegar = fileiras.length > 1;
  // Sem nada a navegar E sem nada a desfazer, a barra seria só ruído. O criar
  // tomo sozinho não a justifica: sem divisão, não há tomo a criar.
  if (!podeNavegar && !temGrupoManual) return null;

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-[var(--nexodoc-panel)] px-2 py-1.5 shadow-[var(--shadow-panel)]">
      {podeNavegar && (
        <>
          <span className="pl-0.5 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            Ir para
          </span>
          <div className="flex items-center gap-1">
            {fileiras.map((f, i) => (
              <Tooltip key={f.tomo}>
                <TooltipTrigger asChild>
                  <Chip
                    variant="quiet"
                    onClick={() => irPara(f.ids)}
                    className={
                      f.tomo === 0
                        ? "min-h-7 px-2.5 py-0.5 text-[11px] text-[var(--status-warning)]"
                        : "min-h-7 px-2.5 py-0.5 text-[11px]"
                    }
                  >
                    {f.tomo > 0 ? `Tomo ${String(f.tomo).padStart(2, "0")}` : "Fora da divisão"}
                  </Chip>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {f.tomo > 0
                    ? `Enquadra o tomo ${f.tomo} no canvas. Tecla ${i + 1}.`
                    : "Documentos gerados antes da divisão em tomos. Não entram em volume nenhum."}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </>
      )}

      {(onCriarTomo || (temGrupoManual && onVoltarAoAutomatico)) && podeNavegar && (
        <Separator orientation="vertical" className="mx-0.5 h-5" />
      )}

      {/* As duas ações MUDAM a organização — por isso vêm depois do divisor. */}
      {onCriarTomo && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Chip onClick={onCriarTomo} className="min-h-7 px-2.5 py-0.5 text-[11px]">
              <Plus aria-hidden />
              {proximoTomo > 0 ? `Tomo ${String(proximoTomo).padStart(2, "0")}` : "Tomo"}
            </Chip>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Cria a fileira desse tomo, vazia. Arraste folhas para dentro dela e
            depois gere os documentos dele.
          </TooltipContent>
        </Tooltip>
      )}

      {temGrupoManual && onVoltarAoAutomatico && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Chip
              variant="quiet"
              onClick={onVoltarAoAutomatico}
              className="min-h-7 px-2.5 py-0.5 text-[11px]"
            >
              <RotateCcw aria-hidden />
              Voltar ao automático
            </Chip>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Apaga os tomos que você decidiu à mão e volta a dividir por
            quantidade. Os títulos corrigidos e a ordem continuam.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
