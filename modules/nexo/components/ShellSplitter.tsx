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

import { useCallback, useEffect, useState } from "react";

const CHAVE = "nexo:copilot-w";
const PADRAO = 520;
const MIN = 320; // abaixo disto o composer e os cards ficam apertados demais
const MAX = 760; // acima disto o canvas deixa de caber como área de trabalho
const PASSO = 24;

function limitar(px: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(px)));
}

export function ShellSplitter() {
  const [largura, setLargura] = useState(PADRAO);

  // Lê a preferência DEPOIS de montar: no servidor não existe localStorage, e
  // ler no primeiro render faria o HTML do servidor divergir do cliente.
  useEffect(() => {
    const salvo = Number(window.localStorage.getItem(CHAVE));
    if (Number.isFinite(salvo) && salvo > 0) {
      const raf = requestAnimationFrame(() => setLargura(limitar(salvo)));
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  // Aplica no shell (o grid inteiro deriva desta variável) e guarda.
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".nexo-shell");
    shell?.style.setProperty("--nexo-copilot-w", `${largura}px`);
    try {
      window.localStorage.setItem(CHAVE, String(largura));
    } catch {
      /* modo privado / cota cheia: a largura vale só para esta sessão */
    }
  }, [largura]);

  const arrastar = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);

    // A coluna do chat é a da DIREITA: a largura é a distância do ponteiro até
    // a borda direita da janela.
    const mover = (ev: PointerEvent) =>
      setLargura(limitar(window.innerWidth - ev.clientX));
    const soltar = () => {
      alvo.releasePointerCapture(e.pointerId);
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
  }, []);

  const teclado = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Esquerda ALARGA o chat (ele está à direita) — o sentido que a mão espera.
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setLargura((w) => limitar(w + PASSO));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setLargura((w) => limitar(w - PASSO));
    } else if (e.key === "Home") {
      e.preventDefault();
      setLargura(PADRAO);
    }
  }, []);

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
