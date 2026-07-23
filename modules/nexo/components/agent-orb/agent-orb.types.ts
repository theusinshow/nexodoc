/**
 * Nexo Core — tipos e a máquina de estados VISUAL do agente. A esfera não conhece
 * IA/backend/API: recebe só props abstratas (`state`/`fileCount`/`activity`) e a
 * aplicação converte eventos reais nesses estados.
 */

export type AgentState =
  | "idle"
  | "hover"
  | "dragging"
  | "uploading"
  | "reading"
  | "analyzing"
  | "responding"
  | "complete"
  | "error";

export interface AgentOrbProps {
  /** Estado do agente (a app mapeia eventos reais → este enum). */
  state?: AgentState;
  /** Nº de documentos no contexto (satélites — Fase 3). */
  fileCount?: number;
  /** Atividade real 0..1 (streaming/análise — Fase 2). */
  activity?: number;
  /** Tamanho no layout: hero (home) ou compact (workspace). */
  size?: "hero" | "compact";
  /** Reage a hover/click (drop-target chega na Fase 3). */
  interactive?: boolean;
  /** Abre o menu do agente (arquitetura pronta; conteúdo é da UI). */
  onActivate?: () => void;
  className?: string;
}

/**
 * Parâmetros VISUAIS que dirigem os uniforms/transform da esfera. São ALVOS por
 * estado; o loop faz damping do atual → alvo (nada de re-render por frame).
 */
export interface OrbVisualParams {
  /** Deslocamento procedural dos vértices (deformação). */
  distortion: number;
  /** Glow pulsante do núcleo. */
  pulse: number;
  /** Força do Fresnel (aro do vidro). */
  rim: number;
  /** Plano de leitura (scanner técnico) 0..1. */
  scan: number;
  /** Multiplicador de rotação lenta. */
  spin: number;
  /** Instabilidade (erro) 0..1. */
  jitter: number;
}

/**
 * Alvos por estado. Coerente com engenharia/CAD: movimento lento, nada frenético.
 * `responding` soma `activity` (reservado p/ streaming futuro; hoje o tradutor
 * usa `analyzing`).
 */
export function paramsForState(
  state: AgentState,
  activity = 0,
): OrbVisualParams {
  const a = Math.max(0, Math.min(1, activity));
  switch (state) {
    case "hover":
      return { distortion: 0.09, pulse: 0.28, rim: 0.8, scan: 0, spin: 0.22, jitter: 0 };
    case "dragging":
      return { distortion: 0.12, pulse: 0.4, rim: 0.95, scan: 0, spin: 0.26, jitter: 0 };
    case "uploading":
      return { distortion: 0.11, pulse: 0.5, rim: 0.85, scan: 0.35, spin: 0.3, jitter: 0 };
    case "reading":
      return { distortion: 0.08, pulse: 0.32, rim: 0.72, scan: 1, spin: 0.2, jitter: 0 };
    case "analyzing":
      return { distortion: 0.17, pulse: 0.62, rim: 0.88, scan: 0.25, spin: 0.36, jitter: 0 };
    case "responding":
      return {
        distortion: 0.1 + a * 0.1,
        pulse: 0.35 + a * 0.4,
        rim: 0.8,
        scan: 0,
        spin: 0.28 + a * 0.12,
        jitter: 0,
      };
    case "complete":
      return { distortion: 0.05, pulse: 0.7, rim: 0.92, scan: 0, spin: 0.16, jitter: 0 };
    case "error":
      return { distortion: 0.14, pulse: 0.3, rim: 0.62, scan: 0, spin: 0.1, jitter: 1 };
    case "idle":
    default:
      return { distortion: 0.06, pulse: 0.16, rim: 0.52, scan: 0, spin: 0.15, jitter: 0 };
  }
}
