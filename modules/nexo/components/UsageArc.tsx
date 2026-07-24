"use client";

/**
 * Indicador SUTIL de consumo de IA: um pequeno arco que preenche conforme os
 * tokens da sessão (leitura de selos + agente). Cresce animando o traço; só
 * aparece quando houve consumo. O número exato fica no title (hover).
 */

import { useApiUsage } from "../state/api-usage";

// Referência SUAVE só p/ o preenchimento visual do arco (não é um limite real).
const SOFT_CAP = 200_000;
const R = 7;
const CIRC = 2 * Math.PI * R;

export function UsageArc() {
  const { tokens } = useApiUsage();
  if (tokens <= 0) return null;

  const frac = Math.min(1, tokens / SOFT_CAP);
  const offset = CIRC * (1 - frac);
  const label =
    tokens >= 1000 ? `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k` : String(tokens);

  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground/80"
      title={`${tokens.toLocaleString("pt-BR")} tokens de IA consumidos nesta sessão`}
    >
      <svg width="15" height="15" viewBox="0 0 18 18" className="-rotate-90" aria-hidden>
        <circle cx="9" cy="9" r={R} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="9"
          cy="9"
          r={R}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset var(--duration-slow) var(--ease-entrance)" }}
        />
      </svg>
      <span className="font-mono text-[9px] tabular-nums">{label}</span>
    </span>
  );
}
