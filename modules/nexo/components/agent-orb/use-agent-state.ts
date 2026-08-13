"use client";

/**
 * Converte os SINAIS reais do app (arrastar, ler selos, pensar, erro) no
 * `AgentState` visual do Nexo Core — com transientes: `complete` (pulso breve ao
 * terminar) e `error` (instabilidade curta), que voltam sozinhos pro fluxo. A
 * esfera não conhece IA/API; esta é a camada que a aplicação usa pra traduzir.
 *
 * Prioridade: error > dragging > reading > responding > analyzing > auditing >
 * complete > idle.
 */

import { useEffect, useRef, useState } from "react";

import type { AgentState } from "./agent-orb.types";

export interface AgentSignals {
  /** Arrastando arquivo sobre a interface. */
  dragging?: boolean;
  /** Lendo selos das pranchas (upload/leitura). */
  reading?: boolean;
  /** Turno do agente em andamento (analisando). */
  thinking?: boolean;
  /** Turno já está ESCREVENDO (primeiro delta chegou). */
  responding?: boolean;
  /**
   * Auditoria de memorial em curso. Trabalho do agente que NÃO passa pelo turno
   * do chat e dura minutos, não segundos — por isso tem estado próprio, em vez
   * de entrar como `thinking`.
   */
  auditing?: boolean;
  /** Falha no turno/leitura. */
  error?: boolean;
}

const COMPLETE_MS = 1200;
const ERROR_MS = 2200;

export function useAgentState({
  dragging,
  reading,
  thinking,
  responding,
  auditing,
  error,
}: AgentSignals): AgentState {
  const [transient, setTransient] = useState<null | "complete" | "error">(null);
  const wasThinking = useRef(false);

  // `complete`: o turno estava pensando e terminou SEM erro → pulso breve.
  // O set é adiado (rAF) para não ser setState SÍNCRONO no corpo do effect.
  useEffect(() => {
    const finished = wasThinking.current && !thinking && !error;
    wasThinking.current = Boolean(thinking);
    if (!finished) return;
    const raf = requestAnimationFrame(() => setTransient("complete"));
    const id = setTimeout(() => setTransient(null), COMPLETE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(id);
    };
  }, [thinking, error]);

  // `error`: instabilidade curta e estabiliza.
  useEffect(() => {
    if (!error) return;
    const raf = requestAnimationFrame(() => setTransient("error"));
    const id = setTimeout(() => setTransient(null), ERROR_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(id);
    };
  }, [error]);

  // `error` é TRANSIENTE (instabilidade curta) — a mensagem persiste na UI, mas a
  // esfera estabiliza. Por isso o retorno usa o transiente, não o `error` cru.
  if (transient === "error") return "error";
  if (dragging) return "dragging";
  if (reading) return "reading";
  if (responding) return "responding";
  if (thinking) return "analyzing";
  /*
   * A auditoria fica ABAIXO do turno de chat, e não acima.
   *
   * Ela é o trabalho mais longo do produto, mas quem digitou uma pergunta agora
   * espera resposta agora — e durante esses segundos é a resposta que precisa
   * da cara do agente. A auditoria continua correndo, o palco continua a
   * mostrando, e o orbe a retoma assim que o turno fecha.
   */
  if (auditing) return "auditing";
  if (transient === "complete") return "complete";
  return "idle";
}
