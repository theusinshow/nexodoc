"use client";

/**
 * Hooks utilitários do Nexo Core (fora do Canvas): preferência de motion,
 * visibilidade da aba e suporte a WebGL — para pausar/congelar/cair no fallback
 * (perf + a11y). `useSyncExternalStore` para evitar setState-em-effect e casar SSR.
 */

import { useSyncExternalStore } from "react";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** `true` se o usuário pede menos movimento (reativo à mudança da preferência). */
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCE_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
}

/** `true` enquanto a aba está visível (pausa a animação em background). */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
    () => !document.hidden,
    () => true,
  );
}

// Checagem de WebGL feita UMA vez (getSnapshot precisa ser barato e estável).
let webglSupport: boolean | null = null;
function detectWebGL(): boolean {
  if (webglSupport === null) {
    try {
      const c = document.createElement("canvas");
      webglSupport = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

/** `false` se o navegador não tem WebGL → cai no fallback CSS (sem Canvas). */
export function useWebGLSupported(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => detectWebGL(),
    () => true,
  );
}
