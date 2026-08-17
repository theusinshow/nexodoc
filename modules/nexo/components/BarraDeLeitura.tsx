"use client";

/**
 * O AVANÇO DA LEITURA, uma folha por retângulo.
 *
 * Era uma linha de texto — "Lendo os selos — 6 de 24 folhas analisadas". O
 * número diz quanto falta, mas não dá a forma do lote: 24 folhas e 200 folhas
 * lêem-se igual, e a diferença entre elas é o que decide se dá tempo de ir
 * buscar um café.
 *
 * A régua se ADAPTA à contagem em vez de ter largura fixa por folha: os
 * segmentos dividem a largura disponível (`1fr` cada), então cinco folhas viram
 * cinco blocos largos e duzentas viram uma fita de traços finos. Largura fixa
 * estouraria a linha no volume grande; altura fixa some no volume pequeno.
 *
 * O ERRO NÃO ENTRA AQUI. A barra mostra só o avanço. Folha ilegível ou sem
 * título é assunto do canvas e da lista de títulos logo abaixo, onde se vê QUAL
 * folha e dá para agir sobre ela. Aviso em barra de progresso não tem o que se
 * faça a respeito — e some junto com a barra quando a leitura acaba, levando o
 * aviso embora.
 */

import { cn } from "@/lib/utils";
import { densidadeDaBarra } from "../lib/densidade-da-barra";

export function BarraDeLeitura({
  done,
  total,
}: {
  /** Folhas já analisadas. */
  done: number;
  /** Folhas do lote. Zero = ainda contando; o chamador não deve renderizar. */
  total: number;
}) {
  if (total <= 0) return null;

  const lidas = Math.max(0, Math.min(done, total));
  const { alturaPx, gapPx } = densidadeDaBarra(total);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={lidas}
      aria-label={`${lidas} de ${total} folhas analisadas`}
      className="grid w-full"
      style={{
        gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
        gap: `${gapPx}px`,
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isLida = i < lidas;
        const isAtual = i === lidas;
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "rounded-[1px] transition-all duration-200",
              isAtual && "animate-pulse",
            )}
            style={{
              height: `${alturaPx}px`,
              /*
               * Lida = cor de destaque; atual = destaque pulsando suave;
               * pendente = o recesso do próprio card.
               */
              background: isLida
                ? "var(--nexodoc-accent)"
                : isAtual
                  ? "rgb(91 218 198 / 0.35)"
                  : "var(--nexodoc-recessed)",
              border: isLida || isAtual ? "none" : "1px solid var(--border)",
            }}
          />
        );
      })}
    </div>
  );
}
