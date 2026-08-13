"use client";

/**
 * O cartão que abre ao clicar no orbe — "o que o Nexo já entendeu". Só afirma
 * fatos lidos (via `summarizeSelos`); nunca inventa.
 *
 * A MANCHETE É O TRABALHO, não o estado. Antes o cartão abria com "Ocioso" em
 * cima de tudo: a palavra mais fria da tela ocupava a linha mais valiosa,
 * enquanto a obra — a única coisa que o engenheiro precisa reconhecer de
 * relance para saber que anexou o projeto certo — vinha truncada lá embaixo.
 * Agora a obra é o título, e o estado é uma linha de rodapé com o ponto.
 *
 * Presentational puro: recebe o estado visual do agente + o contexto derivado.
 */

import type { AgentState } from "./agent-orb.types";
import type { AgentContext } from "../../lib/agent-context";

type Tone = "idle" | "active" | "ok" | "error";

const STATE_UI: Record<AgentState, { label: string; tone: Tone; pulse: boolean }> = {
  idle: { label: "Em espera", tone: "idle", pulse: false },
  dragging: { label: "Solte os PDFs", tone: "active", pulse: true },
  reading: { label: "Lendo os carimbos", tone: "active", pulse: true },
  analyzing: { label: "Pensando", tone: "active", pulse: true },
  auditing: { label: "Auditando o memorial", tone: "active", pulse: true },
  responding: { label: "Respondendo", tone: "active", pulse: true },
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
  progresso,
}: {
  state: AgentState;
  context: AgentContext;
  /**
   * Progresso REAL do trabalho em curso (0..1), quando há. É o mesmo número que
   * move o orbe — mostrar aqui fecha a pergunta que o cartão existe para
   * responder ("está fazendo o quê, e falta quanto?").
   */
  progresso?: number | null;
}) {
  const ui = STATE_UI[state];
  const color = TONE_DOT[ui.tone];
  const hasFacts = context.folhas > 0;
  const codigoLinha = [context.codigo, context.revisao && `rev ${context.revisao}`]
    .filter(Boolean)
    .join(" · ");
  const trabalhando = ui.pulse;
  const pct =
    trabalhando && typeof progresso === "number" && progresso > 0
      ? Math.round(Math.max(0, Math.min(1, progresso)) * 100)
      : null;

  return (
    /*
     * `text-left` explícito: o cartão é filho do cabeçalho do copiloto, que é
     * centralizado — e sem isto os rótulos e os valores da tabela de fatos
     * chegavam centralizados, cada linha começando num lugar diferente.
     */
    <div className="space-y-3 text-left">
      {/* MANCHETE: o que ele entendeu. Sem fatos, o convite. */}
      <div className="space-y-1">
        {hasFacts ? (
          <>
            <p
              className="text-sm font-medium leading-snug tracking-[-0.01em] text-foreground"
              title={context.obra ?? undefined}
            >
              {/* A obra pode ter duas linhas. Truncar o nome da obra num cartão
                  que serve para reconhecer a obra é derrotar o próprio cartão. */}
              {context.obra ?? "Obra não lida no carimbo"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              {context.folhas} folha{context.folhas > 1 ? "s" : ""} no contexto
              {context.disciplinas.length > 0 && ` · ${context.disciplinas.join(", ")}`}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Ainda não li nenhuma prancha. Solte os PDFs aqui e eu leio os
            carimbos — ou solte o memorial e eu audito.
          </p>
        )}
      </div>

      {/* Os demais fatos, num painel recessed (dado é matte, nunca vidro). */}
      {hasFacts && codigoLinha && (
        <dl className="rounded-lg bg-[var(--nexodoc-recessed)] px-3 py-2.5">
          <Fact label="Código" value={codigoLinha} mono />
        </dl>
      )}

      {/*
        RODAPÉ: o estado. Fica embaixo e pequeno de propósito — quando o orbe
        está trabalhando, quem informa é o próprio orbe; aqui o texto só nomeia.
      */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
            {ui.pulse && (
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ background: color }}
              />
            )}
            <span
              aria-hidden
              className="relative h-2 w-2 rounded-full"
              style={{
                background: color,
                boxShadow: ui.tone !== "idle" ? `0 0 8px ${color}` : undefined,
              }}
            />
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {ui.label}
          </span>
        </div>
        {pct !== null && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--primary)]">
            {pct}%
          </span>
        )}
      </div>

      {/*
        A BARRA de progresso só existe quando há progresso de verdade. Uma barra
        indeterminada aqui seria movimento sem informação — e movimento sem
        informação é justamente o que este produto não faz.
      */}
      {pct !== null && (
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--nexodoc-recessed)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
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
      <dt className="w-[52px] shrink-0 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
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
