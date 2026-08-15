"use client";

/**
 * O ÍMÃ — o controle se inclina na direção de quem chega.
 *
 * SÓ EM CTA, e a restrição é o efeito. Um ímã em todo botão vira uma tela que
 * se mexe inteira quando o ponteiro passa, e aí ele deixa de significar "isto
 * aqui é a ação principal" para significar "esta interface é inquieta". Dois
 * controles em todo o produto: "Nova auditoria" e "Criar projeto".
 *
 * A ATRAÇÃO ACONTECE SOBRE O CONTROLE, e não a distância. A versão com zona de
 * atração precisa de uma área invisível maior que o botão, e essa área engole
 * o ponteiro de quem estava mirando o vizinho. Aqui o deslocamento nasce da
 * posição do cursor DENTRO do controle: entrar por um canto puxa para aquele
 * canto, e o efeito lê igual sem cobrar nada de quem passou por perto.
 *
 * O desenho inteiro do movimento está em `.nx-ima` (globals.css). Daqui saem só
 * `--ima-x` e `--ima-y`, em pixels — e nunca por estado, pelo mesmo motivo do
 * spotlight: escrever no `style` não passa pelo React.
 */

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Ima({
  children,
  /** Deslocamento máximo em pixels. Acima de ~3 ele briga com o clique. */
  alcance = 2,
  className,
}: {
  children: ReactNode;
  alcance?: number;
  className?: string;
}) {
  const caixa = useRef<HTMLSpanElement | null>(null);
  const pendente = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pendente.current !== null) cancelAnimationFrame(pendente.current);
    },
    [],
  );

  const mover = useCallback(
    (ev: ReactPointerEvent<HTMLSpanElement>) => {
      const alvo = ev.currentTarget;
      const { clientX, clientY } = ev;
      if (pendente.current !== null) return;
      pendente.current = requestAnimationFrame(() => {
        pendente.current = null;
        if (!alvo.isConnected) return;
        const r = alvo.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // -1..1 a partir do centro, e daí para pixels.
        const dx = ((clientX - r.left) / r.width - 0.5) * 2;
        const dy = ((clientY - r.top) / r.height - 0.5) * 2;
        alvo.style.setProperty("--ima-x", `${(dx * alcance).toFixed(2)}px`);
        alvo.style.setProperty("--ima-y", `${(dy * alcance).toFixed(2)}px`);
      });
    },
    [alcance],
  );

  const soltar = useCallback(() => {
    const alvo = caixa.current;
    if (!alvo) return;
    alvo.style.setProperty("--ima-x", "0px");
    alvo.style.setProperty("--ima-y", "0px");
  }, []);

  return (
    <span
      ref={caixa}
      data-ima=""
      className={cn("nx-ima", className)}
      onPointerMove={mover}
      onPointerLeave={soltar}
    >
      {children}
    </span>
  );
}
