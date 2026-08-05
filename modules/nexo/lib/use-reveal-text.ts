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
    /*
     * O RITMO da escrita. Antes eram ~140 passos a 16ms — dois segundos e meio
     * no texto longo, mas com passos GRANDES: numa frase de 400 caracteres cada
     * tique cuspia três letras de uma vez, e o olho lê isso como tremor, não
     * como alguém escrevendo.
     *
     * Agora o passo é sempre de UMA letra e quem se ajusta é o intervalo, com
     * um piso: frase curta escreve devagar de verdade, frase longa acelera até
     * o piso e não além. O movimento fica contínuo e legível em vez de rápido e
     * picotado — que é a diferença entre parecer vivo e parecer travado.
     */
    let i = 0;
    const DURACAO_ALVO_MS = 2600;
    const INTERVALO_MIN_MS = 18;
    const INTERVALO_MAX_MS = 55;
    const intervalo = Math.min(
      INTERVALO_MAX_MS,
      Math.max(INTERVALO_MIN_MS, Math.round(DURACAO_ALVO_MS / Math.max(1, text.length))),
    );
    const id = setInterval(() => {
      i = Math.min(text.length, i + 1);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        doneRef.current = true;
      }
    }, intervalo);
    return () => clearInterval(id);
  }, [text, enabled]);

  // Quando `enabled` vira false (ex.: chegou a próxima resposta e o revealId
  // mudou) o effect só faz cleanup — sem esta linha, `shown` ficaria travado no
  // valor PARCIAL. Devolver `text` garante a resposta inteira. (Bug #3 da revisão.)
  return enabled ? shown : text;
}
