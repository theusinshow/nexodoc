/**
 * A POLÍTICA do teto de gasto — sem banco, sem rede.
 *
 * Separada de `ai-budget.ts` porque decidir "há teto?" e "o que o usuário lê ao
 * ser barrado?" não precisa de Prisma. Misturar as duas coisas obrigava quem só
 * quer formatar uma mensagem a carregar o cliente do banco junto, e tornava a
 * regra impossível de testar sem subir infraestrutura.
 */

export interface EstadoDoTeto {
  /** Há teto configurado neste ambiente. */
  ativo: boolean;
  /** Dólares gastos no mês corrente (0 quando não dá para saber). */
  gastoUsd: number;
  /** O teto em dólares, quando ativo. */
  tetoUsd: number | null;
  /** Estourou — a chamada deve ser recusada. */
  estourou: boolean;
}

/**
 * Sem `NEXODOC_MONTHLY_BUDGET_USD`, não há teto.
 *
 * Ligar um limite por padrão quebraria ambientes existentes sem aviso, e um
 * número inventado aqui não seria mais seguro que nenhum — quanto vale o mês é
 * decisão comercial, não técnica.
 */
export function getMonthlyBudgetUsd(): number | null {
  const value = Number(process.env.NEXODOC_MONTHLY_BUDGET_USD);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Primeiro instante do mês corrente, em UTC. */
export function inicioDoMes(agora = new Date()): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

/** A mensagem que o usuário lê ao ser recusado — diz o número, não só "não". */
export function mensagemDeTetoEstourado(estado: EstadoDoTeto): string {
  const gasto = estado.gastoUsd.toFixed(2);
  const teto = (estado.tetoUsd ?? 0).toFixed(2);
  return `Limite mensal de uso atingido: US$ ${gasto} de US$ ${teto}. Novas auditorias voltam a rodar no próximo mês, ou quando o limite for ampliado.`;
}
