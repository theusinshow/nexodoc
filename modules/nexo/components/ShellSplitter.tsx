"use client";

/**
 * Separador arrastável entre o canvas e o chat. Só existe no layout `active`
 * (no welcome não há canvas para dividir).
 *
 * Ele não move um elemento: escreve a largura da coluna do chat
 * (`--nexo-copilot-w`) no shell, que é grid. A preferência fica em
 * `localStorage` — quem trabalha mais no canvas quer o chat estreito, e
 * reajustar isso a cada visita seria irritante.
 *
 * Teclado é obrigatório, não enfeite: sem as setas, a única forma de usar seria
 * o mouse.
 */

import { useCallback, useEffect } from "react";

import {
  MAX,
  MIN,
  PADRAO,
  PASSO,
  restaurarPreferencia,
  usarLarguraDoCopiloto,
} from "../lib/largura-do-copiloto";

/*
 * A LARGURA NÃO MORA MAIS AQUI.
 *
 * Ela era estado local deste componente, e funcionava enquanto o splitter era o
 * único a mexer nela. O botão "ver como sai" do frame também mexe, e dois donos
 * escrevendo a mesma variável CSS é como este estado ficaria velho: a coluna
 * alargaria por fora, e a próxima seta do teclado devolveria a largura que ele
 * ainda achava ser a atual. Ver [[largura-do-copiloto.ts]].
 */
export function ShellSplitter() {
  const { largura, definir } = usarLarguraDoCopiloto();

  useEffect(() => {
    restaurarPreferencia();
  }, []);

  const arrastar = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);

    // A coluna do chat é a da DIREITA: a largura é a distância do ponteiro até
    // a borda direita da janela.
    const mover = (ev: PointerEvent) =>
      definir(window.innerWidth - ev.clientX);
    const soltar = () => {
      alvo.releasePointerCapture(e.pointerId);
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
  }, [definir]);

  const teclado = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Esquerda ALARGA o chat (ele está à direita) — o sentido que a mão espera.
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      definir(largura + PASSO);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      definir(largura - PASSO);
    } else if (e.key === "Home") {
      e.preventDefault();
      definir(PADRAO);
    }
  }, [definir, largura]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura do chat"
      aria-valuenow={largura}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      onPointerDown={arrastar}
      onKeyDown={teclado}
      className="nexo-shell__splitter group flex cursor-col-resize items-center justify-center focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="h-16 w-[3px] rounded-full bg-border transition-colors group-hover:bg-[var(--ring)] group-focus-visible:bg-[var(--ring)]"
      />
    </div>
  );
}
