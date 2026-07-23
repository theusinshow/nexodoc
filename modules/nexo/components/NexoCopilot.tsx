"use client";

/**
 * NexoCopilot — orb (acima) + chat, a unidade que VIAJA centro→direita no slide.
 * É o nó reposicionado pelo shell (view-transition-name); o `NexoChat` dentro é
 * montado UMA vez (continuidade §1) e o orb viaja junto, sempre acima do chat.
 *
 * Welcome: orb grande + saudação, chat como caixa centralizada. Active: orb
 * pequeno + chat docado alto (direita).
 */

import { cn } from "@/lib/utils";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { AgentOrb } from "./agent-orb";
import { NexoChat, type ReadStatus } from "./NexoChat";

export function NexoCopilot({
  started,
  selos,
  onSend,
  onAttach,
  readStatus,
}: {
  started: boolean;
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
  readStatus?: ReadStatus | null;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-3",
        !started && "justify-center",
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-2 pt-1 text-center">
        <AgentOrb state="idle" size={started ? "compact" : "hero"} interactive />
        {!started && (
          <div className="space-y-1.5">
            <h2 className="text-2xl font-medium tracking-[-0.01em]">
              O que vamos montar?
            </h2>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Solte os PDFs das pranchas e peça em texto — eu leio os selos,
              proponho e monto.
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "min-h-0 w-full",
          started ? "flex-1" : "h-[460px] max-h-full",
        )}
      >
        <NexoChat
          selos={selos}
          onSend={onSend}
          onAttach={onAttach}
          readStatus={readStatus}
        />
      </div>
    </div>
  );
}
