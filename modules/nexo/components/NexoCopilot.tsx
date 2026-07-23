"use client";

/**
 * NexoCopilot — a unidade orb + saudação + chat que VIAJA (centro no welcome →
 * direita no active). É o nó reposicionado pelo shell (via view-transition-name);
 * o `NexoChat` dentro dele é montado UMA vez (continuidade §1).
 *
 * No welcome o orb é grande e a saudação aparece; no active o orb encolhe e vira
 * um rótulo compacto acima do chat docado.
 */

import { cn } from "@/lib/utils";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { NexoOrb } from "./NexoOrb";
import { NexoChat } from "./NexoChat";

export function NexoCopilot({
  started,
  selos,
  onSend,
  onAttach,
}: {
  started: boolean;
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-4",
        !started && "nexo-welcome-wash justify-center",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-col items-center gap-2 text-center",
          started ? "pt-1" : "pt-2",
        )}
      >
        <NexoOrb state="idle" className={started ? "w-9" : "w-16"} />
        {started ? (
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Nexo
          </span>
        ) : (
          <>
            <h2 className="text-2xl font-medium tracking-[-0.01em]">
              O que vamos montar?
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Solte os PDFs do projeto e peça em texto — eu leio os selos, proponho
              e monto.
            </p>
          </>
        )}
      </div>

      <div
        className={cn(
          "min-h-0 w-full",
          started ? "flex-1" : "h-[520px] max-h-full",
        )}
      >
        <NexoChat selos={selos} onSend={onSend} onAttach={onAttach} />
      </div>
    </div>
  );
}
