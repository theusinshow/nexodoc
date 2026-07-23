"use client";

/**
 * NexoShell — layout estilo ChatGPT (direção 2026-07-23): DUAS colunas full-height,
 * sidebar (histórico) + main (coluna de chat centralizada). Sem slide, sem canvas
 * na tela principal — o chat é o protagonista. As ferramentas/canvas vivem atrás
 * de `NEXT_PUBLIC_NEXO_DEBUG` (fora daqui).
 */

import type { ReactNode } from "react";

export function NexoShell({
  sidebar,
  main,
}: {
  sidebar: ReactNode;
  main: ReactNode;
}) {
  return (
    <div className="nexo-shell">
      <div className="nexo-shell__sidebar">{sidebar}</div>
      <main className="nexo-shell__main" aria-label="Nexo">
        {main}
      </main>
    </div>
  );
}
