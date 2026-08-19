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

/**
 * QUEM É ISENTO DO BLOQUEIO — e a isenção é só do bloqueio.
 *
 * Quem administra é quem testa, reprocessa e demonstra. Medido no banco em
 * 19/08/2026: o mês mais pesado de um usuário comum foi US$ 0,91; o de quem
 * desenvolve, US$ 19,31. Vinte vezes mais, e nenhum dos dois é o uso de um
 * engenheiro montando volume. Bater a trave no meio de uma demonstração para o
 * diretor é pior do que a fatura que o teto existe para proteger.
 *
 * O GASTO DELE CONTINUA SENDO GRAVADO E SOMADO. Isento de bloqueio não é
 * isento de conta: esconder o consumo de quem mais consome cegaria justamente
 * o número que define o teto de todo mundo — e foi desse número que saiu o
 * US$ 20 dos demais.
 *
 * Lê a MESMA `NEXODOC_ADMIN_EMAILS` que `access-control.ts`, e não a importa:
 * aquele módulo puxa `next/server` e `auth`, e este precisa continuar puro para
 * rodar em node cru. A régua de normalização é a mesma (aparar + minúsculas);
 * mudou lá, muda aqui.
 *
 * Lista ausente ou vazia NÃO isenta ninguém — o modo de falhar seguro é o teto
 * valer, não sumir.
 */
export function isentoDoTeto(
  email: string | null | undefined,
  adminEmails: string | undefined,
): boolean {
  const alvo = (email ?? "").trim().toLowerCase();
  if (!alvo) return false;

  return (adminEmails ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(alvo);
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
