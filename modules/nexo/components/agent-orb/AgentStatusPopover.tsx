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
  dragging: { label: "Solte os PDFs", tone: "active", pulse: true },
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
  const color = TONE_DOT[ui.tone];
  const hasFacts = context.folhas > 0;
  const codigoLinha = [context.codigo, context.revisao && `rev ${context.revisao}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      {/* Cabeçalho: estado atual (dot pulsante quando trabalhando) + marca. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
            {ui.pulse && (
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ background: color }}
              />
            )}
            <span
              aria-hidden
              className="relative h-2.5 w-2.5 rounded-full"
              style={{
                background: color,
                boxShadow: ui.tone !== "idle" ? `0 0 8px ${color}` : undefined,
              }}
            />
          </span>
          <span className="text-sm font-medium tracking-[-0.01em]">{ui.label}</span>
        </div>
        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
          Nexo
        </span>
      </div>

      {/* Corpo: fatos lidos (ou vazio honesto) num painel recessed. */}
      {hasFacts ? (
        <dl className="space-y-2 rounded-lg bg-[var(--nexodoc-recessed)] px-3 py-2.5">
          <Fact label="Folhas" value={String(context.folhas)} mono />
          <Fact label="Obra" value={context.obra} />
          <Fact
            label="Disciplina"
            value={context.disciplinas.length ? context.disciplinas.join(", ") : null}
          />
          <Fact label="Código" value={codigoLinha || null} mono />
        </dl>
      ) : (
        <p className="rounded-lg bg-[var(--nexodoc-recessed)] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Ainda não li nenhuma prancha. Solte os PDFs e eu leio os selos.
        </p>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2.5">
      <dt className="w-[62px] shrink-0 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "min-w-0 flex-1 truncate font-mono text-[12px] tabular-nums text-foreground"
            : "min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground"
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
