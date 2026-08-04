import type { EmissionVerdict } from "@/lib/audit-report";
import type { AuditSeverity } from "@/server/nexo/audit/build-audit-graph";

/**
 * O veredito da auditoria traduzido para o vocabulário de status do sistema
 * (DESIGN.md §2): `ok` · `warning` · `critical`. Existe porque a MESMA tradução
 * estava escrita duas vezes, comparando emoji inline em cada tela — e a tela
 * seguinte só copiaria a cadeia de novo, com chance de esquecer um caso.
 *
 * O caso que não pode ser esquecido é a ANÁLISE PARCIAL: ela chega com ⚠️ e,
 * caindo no `else`, seria pintada de verde — a cor de "liberado" — justamente
 * quando o veredito manda NÃO usar o resultado.
 */
export type StatusDeSinal = "ok" | "warning" | "critical";

export function statusDoVeredito(verdict: EmissionVerdict): StatusDeSinal {
  if (verdict.emoji === "🔴") return "critical";
  if (verdict.emoji === "🟡" || verdict.emoji === "⚠️") return "warning";
  return "ok";
}

/** Borda + tint de fundo do veredito. Borda inteira de 1px: faixa lateral é proibida. */
export const MOLDURA_DE_SINAL: Record<StatusDeSinal, string> = {
  ok: "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)]",
  warning: "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)]",
  critical: "border-[var(--status-critical)]/30 bg-[var(--status-critical-bg)]",
};

/** O ponto de status — o substituto do emoji, que a interface não usa. */
export const PONTO_DE_SINAL: Record<StatusDeSinal, string> = {
  ok: "bg-[var(--status-ok)]",
  warning: "bg-[var(--status-warning)]",
  critical: "bg-[var(--status-critical)]",
};

/*
 * A severidade do achado no mesmo vocabulário. Editorial NÃO é sinal de status:
 * é ajuste sem impacto documental, e pintá-lo de âmbar diluiria o âmbar de quem
 * precisa conferir antes de emitir.
 */
export const PONTO_DA_SEVERIDADE: Record<AuditSeverity, string> = {
  critico: "bg-[var(--status-critical)]",
  tecnico: "bg-[var(--status-warning)]",
  editorial: "bg-muted-foreground",
};

/** A mesma escala onde só cabe valor de cor: pin sobre a página e linha do canvas. */
export const COR_DA_SEVERIDADE: Record<AuditSeverity, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};
