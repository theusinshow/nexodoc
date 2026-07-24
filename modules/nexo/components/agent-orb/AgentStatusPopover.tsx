"use client";

/**
 * Conteúdo do popover de status do orb — "o que o Nexo já entendeu". Só afirma
 * fatos lidos (via `summarizeSelos`); nunca inventa. Presentational puro: recebe
 * o estado visual do agente + o contexto derivado.
 */

import type { AgentState } from "./agent-orb.types";
import type { AgentContext } from "../../lib/agent-context";

type Tone = "idle" | "active" | "ok" | "error";

const STATE_UI: Record<AgentState, { label: string; tone: Tone; pulse: boolean }> = {
  idle: { label: "Ocioso", tone: "idle", pulse: false },
  hover: { label: "Ocioso", tone: "idle", pulse: false },
  dragging: { label: "Solte os PDFs", tone: "active", pulse: false },
  uploading: { label: "Enviando…", tone: "active", pulse: true },
  reading: { label: "Lendo pranchas…", tone: "active", pulse: true },
  analyzing: { label: "Analisando…", tone: "active", pulse: true },
  responding: { label: "Respondendo…", tone: "active", pulse: true },
  complete: { label: "Pronto", tone: "ok", pulse: false },
  error: { label: "Instabilidade", tone: "error", pulse: false },
};

const TONE_DOT: Record<Tone, string> = {
  idle: "var(--muted-foreground)",
  active: "var(--primary)",
  ok: "var(--status-ok)",
  error: "var(--status-critical)",
};

export function AgentStatusPopover({
  state,
  context,
}: {
  state: AgentState;
  context: AgentContext;
}) {
  const ui = STATE_UI[state];
  const hasFacts = context.folhas > 0;
  const codigoLinha = [context.codigo, context.revisao && `rev ${context.revisao}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3 text-sm">
      {/* Cabeçalho: estado atual do agente */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={ui.pulse ? "h-2 w-2 shrink-0 rounded-full animate-pulse" : "h-2 w-2 shrink-0 rounded-full"}
          style={{ background: TONE_DOT[ui.tone] }}
        />
        <span className="font-medium">{ui.label}</span>
      </div>

      {/* Corpo: fatos lidos (ou vazio honesto) */}
      {hasFacts ? (
        <dl className="space-y-1.5 border-t border-border pt-2.5">
          <Fact label="Folhas lidas" value={String(context.folhas)} />
          <Fact label="Obra" value={context.obra} />
          <Fact
            label="Disciplina"
            value={context.disciplinas.length ? context.disciplinas.join(", ") : null}
          />
          <Fact label="Código" value={codigoLinha || null} />
        </dl>
      ) : (
        <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
          Ainda não li nenhuma prancha. Solte os PDFs das pranchas e eu leio os
          selos.
        </p>
      )}

      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Nexo · Beta
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}
