"use client";

/**
 * NexoShell — base ChatGPT + slide (direção 2026-07-23). DERIVA a topologia do
 * latch `started`:
 * - welcome: sidebar | chat centralizado (o copiloto ocupa o centro).
 * - active (após enviar): sidebar | CANVAS (centro, organização dos arquivos) |
 *   copiloto (chat docado à direita, com o orb acima).
 *
 * Continuidade (§1): sidebar e copiloto SEMPRE no DOM — só o stage (canvas) monta.
 * O slide (FLIP nativo via `view-transition-name`) reposiciona o copiloto
 * centro→direita preservando histórico/scroll/foco do chat; o orb viaja junto.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function NexoShell({
  started,
  sidebar,
  stage,
  copilot,
}: {
  started: boolean;
  sidebar: ReactNode;
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
      <div className="nexo-shell__sidebar">{sidebar}</div>
      {started && (
        <main className="nexo-shell__stage" aria-label="Organização dos arquivos">
          {stage}
        </main>
      )}
      {/* SEMPRE montado — reposicionado centro→direita (invariante §1). */}
      <aside className="nexo-shell__copilot" aria-label="Nexo">
        {copilot}
      </aside>
    </div>
  );
}
