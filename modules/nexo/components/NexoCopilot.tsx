"use client";

/**
 * NexoCopilot — orb (acima) + chat, a unidade que VIAJA centro→direita no slide.
 * É o nó reposicionado pelo shell (view-transition-name); o `NexoChat` dentro é
 * montado UMA vez (continuidade §1) e o orb viaja junto, sempre acima do chat.
 *
 * Welcome: orb grande + saudação, chat como caixa centralizada. Active: orb
 * pequeno + chat docado alto (direita).
 */

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { AgentPopover } from "@/components/ui/agent-popover";
import { AgentOrb, AgentStatusPopover, type AgentState } from "./agent-orb";
import type { AgentContext } from "../lib/agent-context";
import { NexoChat, type ReadStatus } from "./NexoChat";

export function NexoCopilot({
  started,
  selos,
  onSend,
  onAttach,
  readStatus,
  agentState = "idle",
  fileCount = 0,
  context,
  onTurnStatus,
}: {
  started: boolean;
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
  readStatus?: ReadStatus | null;
  /** Estado do Nexo Core (derivado dos sinais do app pelo NexoWorkspace). */
  agentState?: AgentState;
  fileCount?: number;
  /** Contexto derivado dos selos (o que o Nexo já entendeu) — popover do orb. */
  context: AgentContext;
  onTurnStatus?: (s: { thinking: boolean; error: boolean }) => void;
}) {
  // Popover de status: clique no orb "espia a cabeça" do agente.
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-3",
        !started && "justify-center",
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-2 pt-1 text-center">
        <AgentPopover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          label="Status do Nexo"
          anchor={
            <AgentOrb
              state={agentState}
              fileCount={fileCount}
              size={started ? "compact" : "hero"}
              interactive
              onActivate={() => setPopoverOpen((o) => !o)}
            />
          }
        >
          <AgentStatusPopover state={agentState} context={context} />
        </AgentPopover>
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
          onTurnStatus={onTurnStatus}
        />
      </div>
    </div>
  );
}
