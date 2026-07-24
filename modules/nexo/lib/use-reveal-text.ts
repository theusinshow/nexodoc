"use client";

/**
 * Reveal progressivo de texto ("streaming-feel"): o `reply` do assistente surge
 * aos poucos ao CHEGAR. Não é streaming real de token (o agente é single-shot);
 * é apresentação. Só anima quando `enabled` (mensagem recém-chegada nesta sessão)
 * — mensagens restauradas/antigas aparecem inteiras. Respeita reduced-motion.
 *
 * O estado começa vazio quando vai animar (via init do useState) e só é atualizado
 * dentro de callbacks assíncronos (interval/rAF) — o React Compiler proíbe
 * setState síncrono no corpo do effect.
 */
import { useEffect, useRef, useState } from "react";

export function useRevealText(text: string, enabled: boolean): string {
  const [shown, setShown] = useState(enabled ? "" : text);
  const doneRef = useRef(!enabled);

  useEffect(() => {
    if (!enabled || doneRef.current) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Sem animação: preenche no próximo frame (setState fora do corpo do effect).
      const raf = requestAnimationFrame(() => {
        setShown(text);
        doneRef.current = true;
      });
      return () => cancelAnimationFrame(raf);
    }
    // ~140 passos no máximo: curto = rápido, longo = ~2s.
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 140));
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        doneRef.current = true;
      }
    }, 16);
    return () => clearInterval(id);
  }, [text, enabled]);

  return shown;
}
