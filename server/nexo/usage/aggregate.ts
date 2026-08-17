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
  /** A chamada especifica: "audit-global", "audit-chunk", "nexo-agent-turn". */
  operation: string;
  /** "success" ou o que a rota gravou. Falha que queimou token e gasto real. */
  status: string;
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
  operation: string;
  label: string;
  model: string;
  totalTokens: number;
  costUsd: number | null;
  /**
   * A chamada nao completou. Ela CONTINUA aqui porque queimou token — chamada
   * truncada gasta o teto de saida inteiro e devolve zero, que e o pior caso e
   * nao um caso degradado. Some-la seria esconder o gasto que mais dói.
   */
  falhou: boolean;
}

export interface UsageSummary {
  porModelo: UsageSlice[];
  porTarefa: UsageTaskRow[];
  totalTokens: number;
  totalCostUsd: number | null;
  /**
   * O que foi gasto em chamadas que FALHARAM. Zero e uma afirmacao ("nada foi
   * perdido"), por isso nunca e nulo.
   */
  desperdicioUsd: number;
}

/** Fluxo técnico → o nome que o engenheiro reconhece. */
const FLOW_LABELS: Record<string, string> = {
  "nexo-agent": "Turnos da conversa",
  "ld-extraction": "Leitura de selos",
  audit: "Auditoria do memorial",
};

/**
 * A OPERAÇÃO, com o nome do trabalho que ela faz.
 *
 * Agrupar só por fluxo fazia a auditoria inteira virar UMA linha — e foi assim
 * que 71% do gasto de uma corrida do 084_25 (blocos truncados, US$ 4,32) ficou
 * invisível na tela enquanto estava explícito no banco. Cada passada custa
 * diferente e falha diferente; juntá-las apaga exatamente a informação que
 * decide o que consertar.
 */
const OPERATION_LABELS: Record<string, string> = {
  "audit-global": "Leitura do documento inteiro",
  "audit-chunk": "Leitura por capítulo",
  "audit-identity": "Leitura de identidade",
  "audit-validation": "Revisão dos achados",
  "audit-coherence": "Coerência entre capítulos",
  "audit-cross-document": "Comparação entre arquivos",
  "audit-refutation": "Refutação dos achados",
  "audit-chat-answer": "Perguntas sobre o parecer",
  "nexo-agent-turn": "Turnos da conversa",
  "nexo-selo": "Leitura de selo",
  "nexo-selo-image": "Recorte do selo",
  "nexo-selo-identidade": "Conferência de identidade do selo",
  "nexo-volume-check": "Conferência do volume",
  "volume-batch-analysis": "Análise do volume",
  "volume-assembly-suggestion": "Sugestão de montagem",
};

/** Rótulo da tarefa. Fluxo novo cai no próprio nome — nunca string vazia. */
export function flowLabel(flow: string): string {
  return FLOW_LABELS[flow] ?? flow;
}

/**
 * Rótulo da operação. Operação nova cai no próprio nome, e depois no fluxo —
 * nunca string vazia, porque linha em branco numa tabela de gasto lê-se como
 * "não sei o que é isto", que é pior do que ler o nome técnico.
 */
export function operationLabel(operation: string, flow: string): string {
  return OPERATION_LABELS[operation] ?? operation ?? flowLabel(flow);
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
  let desperdicioUsd = 0;

  for (const row of rows) {
    // Item 4 (decisão fechada): filtra por CONSUMO, não por status. Uma chamada
    // "failed" que já queimou tokens é gasto real e continua aqui; uma chamada
    // que não queimou nada (sucesso ou falha) não gera fatia nem linha — ela só
    // poluiria o popover com "· 0 ·" e roubaria uma cor do anel à toa.
    if (row.totalTokens <= 0) {
      continue;
    }

    totalTokens += row.totalTokens;
    totalCostUsd = addCost(totalCostUsd, row.estimatedCostUsd);

    const falhou = row.status !== "success";
    if (falhou) desperdicioUsd += row.estimatedCostUsd ?? 0;

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

    /*
     * A chave inclui a OPERACAO e se FALHOU. Sem a operacao, a auditoria inteira
     * virava uma linha e a passada cara ficava indistinguivel da barata; sem o
     * `falhou`, o que truncou se somava ao que funcionou e o desperdicio
     * desaparecia dentro do total.
     */
    const key = `${row.flow} ${row.operation} ${row.model} ${falhou}`;
    const task = byTask.get(key);
    if (task) {
      task.totalTokens += row.totalTokens;
      task.costUsd = addCost(task.costUsd, row.estimatedCostUsd);
    } else {
      byTask.set(key, {
        flow: row.flow,
        operation: row.operation,
        label: operationLabel(row.operation, row.flow),
        model: row.model,
        totalTokens: row.totalTokens,
        costUsd: row.estimatedCostUsd,
        falhou,
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
    desperdicioUsd,
  };
}
