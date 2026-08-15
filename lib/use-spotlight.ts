"use client";

/**
 * A LUZ QUE SEGUE O PONTEIRO — a metade em JS da classe `.nx-spot`.
 *
 * O desenho inteiro do brilho mora no CSS (`globals.css`, bloco AMBIENTE); daqui
 * saem só duas variáveis, `--mx` e `--my`, em porcentagem do próprio cartão.
 *
 * POR QUE VARIÁVEL E NÃO ESTADO: uma tela de parecer tem 45 cartões. Guardar a
 * posição do ponteiro em `useState` faria o React re-renderizar a lista a cada
 * pixel de movimento — o mesmo defeito que tirou `acesos` das dependências dos
 * nós do canvas. Escrever direto no `style` do elemento não passa pelo React.
 *
 * POR QUE `requestAnimationFrame`: o `pointermove` dispara mais vezes do que a
 * tela desenha. Sem o funil, cada quadro processa vários eventos e joga fora
 * todos menos o último — trabalho que ninguém vê.
 */

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export function useSpotlight() {
  const pendente = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pendente.current !== null) cancelAnimationFrame(pendente.current);
    },
    [],
  );

  return useCallback((ev: ReactPointerEvent<HTMLElement>) => {
    const alvo = ev.currentTarget;
    const { clientX, clientY } = ev;
    if (pendente.current !== null) return;
    pendente.current = requestAnimationFrame(() => {
      pendente.current = null;
      // O elemento pode ter saído da árvore entre o evento e o quadro.
      if (!alvo.isConnected) return;
      const caixa = alvo.getBoundingClientRect();
      if (caixa.width === 0 || caixa.height === 0) return;
      alvo.style.setProperty("--mx", `${((clientX - caixa.left) / caixa.width) * 100}%`);
      alvo.style.setProperty("--my", `${((clientY - caixa.top) / caixa.height) * 100}%`);
    });
  }, []);
}
