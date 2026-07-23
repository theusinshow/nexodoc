"use client";

/**
 * NexoShell (§1 da ARQUITETURA.md) — a topologia do reflow, DERIVADA do latch
 * `started` (nunca setada à mão). `started:false` = welcome (coluna única
 * centralizada); `true` = active (rail | stage | copiloto).
 *
 * Invariante de continuidade (§1): o nó do copiloto (chat+composer) está SEMPRE
 * no DOM — só muda de área no layout. Por isso `copilot` é renderizado fora do
 * `if`; welcome-chrome, rail e stage é que montam/desmontam na transição. Assim o
 * slide (FLIP nativo, via `view-transition-name` no CSS) preserva histórico,
 * scroll e foco do copiloto.
 *
 * É PRESENTACIONAL: o latch e o `runShellTransition` vivem no dono do estado
 * (NexoWorkspace, que também detém os selos compartilhados por stage e copiloto).
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function NexoShell({
  started,
  welcome,
  rail,
  stage,
  copilot,
}: {
  started: boolean;
  welcome: ReactNode;
  rail: ReactNode;
  stage: ReactNode;
  copilot: ReactNode;
}) {
  return (
    <div
      data-started={started}
      className={cn(
        "nexo-shell",
        started ? "nexo-shell--active" : "nexo-shell--welcome",
      )}
    >
      {!started && <div className="nexo-shell__welcome">{welcome}</div>}
      {started && <div className="nexo-shell__rail">{rail}</div>}
      {started && (
        <main className="nexo-shell__stage" aria-label="Trabalho">
          {stage}
        </main>
      )}
      {/* SEMPRE montado — reposicionado, nunca desmontado (invariante §1). */}
      <aside className="nexo-shell__copilot" aria-label="Nexo">
        {copilot}
      </aside>
    </div>
  );
}
