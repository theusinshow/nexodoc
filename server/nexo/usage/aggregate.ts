/**
 * Agregação do consumo de IA de UMA conversa: dois cortes do mesmo conjunto de
 * eventos — por modelo (as fatias do anel) e por tarefa+modelo (as linhas do
 * popover).
 *
 * PURO, SEM IMPORTS de runtime (padrão de `normalize.ts`/`split-stream.ts`):
 * roda em node cru, sem esbarrar no alias `@/`. A rota faz o I/O e chama isto.
 *
 * REGRA DO CUSTO: `estimatedCostUsd` é nulo quando o modelo não está na tabela
 * de preços (`lib/ai-usage.ts`). Somamos só o que existe, e devolvemos `null`
 * quando NENHUM evento do grupo tem preço — nunca zero, que se leria como
 * "de graça".
 */

/** Uma linha crua vinda do banco (`AiUsageEvent`). */
export interface UsageRow {
  flow: string;
  model: string;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

/** Uma fatia do anel. */
export interface UsageSlice {
  model: string;
  totalTokens: number;
  costUsd: number | null;
}

/** Uma linha do popover: par (tarefa, modelo). */
export interface UsageTaskRow {
  flow: string;
  label: string;
  model: string;
  totalTokens: number;
  costUsd: number | null;
}

export interface UsageSummary {
  porModelo: UsageSlice[];
  porTarefa: UsageTaskRow[];
  totalTokens: number;
  totalCostUsd: number | null;
}

/** Fluxo técnico → o nome que o engenheiro reconhece. */
const FLOW_LABELS: Record<string, string> = {
  "nexo-agent": "Turnos da conversa",
  "ld-extraction": "Leitura de selos",
  audit: "Auditoria do memorial",
};

/** Rótulo da tarefa. Fluxo novo cai no próprio nome — nunca string vazia. */
export function flowLabel(flow: string): string {
  return FLOW_LABELS[flow] ?? flow;
}

/** Soma tolerante a nulos: nulo só quando NADA no grupo tinha preço. */
function addCost(current: number | null, next: number | null): number | null {
  if (next == null) return current;
  return (current ?? 0) + next;
}

export function aggregateUsage(rows: UsageRow[]): UsageSummary {
  const byModel = new Map<string, UsageSlice>();
  const byTask = new Map<string, UsageTaskRow>();
  let totalTokens = 0;
  let totalCostUsd: number | null = null;

  for (const row of rows) {
    totalTokens += row.totalTokens;
    totalCostUsd = addCost(totalCostUsd, row.estimatedCostUsd);

    const slice = byModel.get(row.model);
    if (slice) {
      slice.totalTokens += row.totalTokens;
      slice.costUsd = addCost(slice.costUsd, row.estimatedCostUsd);
    } else {
      byModel.set(row.model, {
        model: row.model,
        totalTokens: row.totalTokens,
        costUsd: row.estimatedCostUsd,
      });
    }

    const key = `${row.flow} ${row.model}`;
    const task = byTask.get(key);
    if (task) {
      task.totalTokens += row.totalTokens;
      task.costUsd = addCost(task.costUsd, row.estimatedCostUsd);
    } else {
      byTask.set(key, {
        flow: row.flow,
        label: flowLabel(row.flow),
        model: row.model,
        totalTokens: row.totalTokens,
        costUsd: row.estimatedCostUsd,
      });
    }
  }

  const desc = (a: { totalTokens: number }, b: { totalTokens: number }) =>
    b.totalTokens - a.totalTokens;

  return {
    porModelo: [...byModel.values()].sort(desc),
    porTarefa: [...byTask.values()].sort(desc),
    totalTokens,
    totalCostUsd,
  };
}
