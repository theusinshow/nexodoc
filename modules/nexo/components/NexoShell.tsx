"use client";

/**
 * NexoShell (§1 + nova direção de layout 2026-07-23) — 3 colunas full-height,
 * DERIVADAS do latch `started`:
 * - sidebar: SEMPRE (col 1).
 * - stage (trabalho/canvas): só no active (col 2, centro).
 * - copiloto (orb + chat): SEMPRE — no welcome ocupa o centro (col 2, centralizado
 *   com largura de leitura); no active vai pra col 3 (direita).
 *
 * Invariante de continuidade (§1): sidebar e copiloto estão SEMPRE no DOM — só o
 * stage monta/desmonta. O slide (FLIP nativo via `view-transition-name`) reposiciona
 * o copiloto centro→direita preservando histórico/scroll/foco do chat.
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
        <main className="nexo-shell__stage" aria-label="Trabalho">
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
