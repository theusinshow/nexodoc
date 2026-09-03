import { numeroDoControle } from "@/lib/cache-de-controles";

/**
 * A POLÍTICA do teto de gasto — sem banco, sem rede.
 *
 * Separada de `ai-budget.ts` porque decidir "há teto?" e "o que o usuário lê ao
 * ser barrado?" não precisa de Prisma. Misturar as duas coisas obrigava quem só
 * quer formatar uma mensagem a carregar o cliente do banco junto, e tornava a
 * regra impossível de testar sem subir infraestrutura.
 */

/** Qual das duas paredes foi medida — muda o que o usuário lê ao ser barrado. */
export type EscopoDoTeto = "usuario" | "global";

export interface EstadoDoTeto {
  /** Há teto configurado neste ambiente. */
  ativo: boolean;
  /** Dólares gastos no mês corrente (0 quando não dá para saber). */
  gastoUsd: number;
  /** O teto em dólares, quando ativo. */
  tetoUsd: number | null;
  /** Estourou — a chamada deve ser recusada. */
  estourou: boolean;
  /**
   * Qual teto respondeu. Ausente equivale a `"usuario"`, que era o único que
   * existia antes do teto global — quem já lia este objeto continua lendo o
   * mesmo significado.
   */
  escopo?: EscopoDoTeto;
}

/**
 * Sem `NEXODOC_MONTHLY_BUDGET_USD`, não há teto.
 *
 * Ligar um limite por padrão quebraria ambientes existentes sem aviso, e um
 * número inventado aqui não seria mais seguro que nenhum — quanto vale o mês é
 * decisão comercial, não técnica.
 */
export function getMonthlyBudgetUsd(): number | null {
  /*
   * O PAINEL VENCE A VARIÁVEL — pela escada de [[cache-de-controles.ts]], que é
   * memória do processo e não banco: esta função é síncrona e roda em caminho
   * quente, e o cabeçalho acima continua valendo. Sem cache carregado, a escada
   * cai no ambiente, que é como isto funcionava antes do painel.
   */
  return numeroDoControle("teto.mensal.usd");
}

/**
 * O TETO DA CASA — a soma de todo mundo, no mês.
 *
 * O teto acima é POR USUÁRIO (`where: { userId }`), e essa é a proteção certa
 * contra o indivíduo que reprocessa o mesmo projeto vinte vezes. Ele não
 * protege contra a soma: quinze pessoas a US$ 20 são US$ 300 de exposição, e
 * nada no sistema conhecia esse número.
 *
 * Sem `NEXODOC_GLOBAL_MONTHLY_BUDGET_USD` não há teto global, e o
 * comportamento é exatamente o de antes desta função existir. É deliberado:
 * um número inventado aqui barraria a casa inteira num dia movimentado, e
 * quanto vale o mês do escritório é decisão comercial, não técnica.
 *
 * Como dimensionar: o consumo medido em 19/08/2026 foi US$ 0,91 no mês de um
 * usuário comum e US$ 19,31 no de quem desenvolve. Um teto global deve ficar
 * bem ACIMA da soma esperada — ele é a última parede contra a catástrofe (um
 * laço, uma chave vazada), não um instrumento de orçamento fino. Para isso já
 * existe o teto por usuário.
 */
export function getGlobalMonthlyBudgetUsd(): number | null {
  return numeroDoControle("teto.global.usd");
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

/**
 * A mensagem que o usuário lê ao ser recusado — diz o número, não só "não".
 *
 * O teto global tem texto próprio porque a ação que ele pede é outra: no teto
 * pessoal quem lê pode esperar o mês virar; no global, o limite é do
 * escritório e quem resolve é quem administra. Mandar alguém "esperar o
 * próximo mês" quando o vizinho é que gastou seria mentir sobre a causa.
 */
export function mensagemDeTetoEstourado(estado: EstadoDoTeto): string {
  const gasto = estado.gastoUsd.toFixed(2);
  const teto = (estado.tetoUsd ?? 0).toFixed(2);

  if (estado.escopo === "global") {
    return `Limite mensal do escritório atingido: US$ ${gasto} de US$ ${teto}. Nenhuma nova auditoria roda até o limite ser ampliado por quem administra, ou o mês virar.`;
  }

  return `Limite mensal de uso atingido: US$ ${gasto} de US$ ${teto}. Novas auditorias voltam a rodar no próximo mês, ou quando o limite for ampliado.`;
}
