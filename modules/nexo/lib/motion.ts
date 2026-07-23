"use client";

/**
 * Camada-fonte de motion do Nexo (§6 da ARQUITETURA.md). Espelha em JS os tokens
 * de motion que vivem no CSS (`--duration-*`, `--ease-*` em globals.css), para o
 * código que orquestra transições (GSAP no futuro, o adapter de shell aqui) ler os
 * mesmos números — uma fonte só, sem divergir.
 *
 * O `--duration-shell` (~320ms) é o único token novo, escopado à macro-transição
 * welcome↔active. Saídas ~75% da entrada (a DESIGN.md pede assimetria).
 */

/** Durações em ms — espelham `--duration-*` + o novo `--duration-shell`. */
export const DURATION = {
  fast: 120,
  base: 180,
  slow: 240,
  /** Macro-transição do shell (welcome↔active). Só aqui. */
  shell: 320,
} as const;

/** Curvas — espelham `--ease-*` do globals.css. */
export const EASE = {
  feedback: "cubic-bezier(0.25, 1, 0.5, 1)",
  entrance: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/**
 * `true` se o usuário pede menos movimento. Gate em JS PORQUE a media query CSS
 * (`prefers-reduced-motion`) NÃO desliga `document.startViewTransition`/FLIP — o
 * navegador anima o snapshot mesmo com o reset CSS. Só um teste em JS evita a
 * animação de shell. SSR-safe (sem `window` → false).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `true` se o navegador suporta a View Transitions API nativa. */
function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

type StartViewTransition = (callback: () => void) => { finished: Promise<void> };

/**
 * Executa a macro-transição do shell. O `apply` DEVE aplicar a mudança de DOM
 * de forma síncrona (o chamador usa `flushSync` em torno do `setState`) para o
 * navegador conseguir tirar os snapshots "antes/depois".
 *
 * - reduced-motion OU sem suporte → aplica direto, sem animar (o FLIP não roda).
 * - com suporte → `startViewTransition(apply)`; o browser faz o FLIP dos
 *   elementos com `view-transition-name` (nexo-copilot/nexo-stage), honrando
 *   "só transform+opacity". O fallback CSS (`@supports not`) cobre o Firefox.
 */
export function runShellTransition(apply: () => void): void {
  if (prefersReducedMotion() || !supportsViewTransitions()) {
    apply();
    return;
  }
  const doc = document as Document & { startViewTransition?: StartViewTransition };
  doc.startViewTransition!(apply);
}
