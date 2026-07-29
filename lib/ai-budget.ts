/**
 * Teto de gasto de IA por conta, no mês.
 *
 * Uma auditoria Profunda são minutos de modelo; sem teto, um laço acidental —
 * ou um cliente entusiasmado — vira fatura. O consumo já é registrado por
 * evento em `AiUsageEvent` com `estimatedCostUsd`; aqui ele só é somado e
 * comparado contra a política de `ai-budget-policy.ts`.
 *
 * DECISÕES:
 *
 * - Quando não há usuário identificado, o teto vale para o consumo GLOBAL do
 *   mês. Atribuir só a quem tem sessão deixaria a proteção trivial de burlar, e
 *   é justamente o caminho anônimo que não tem dono para cobrar.
 *
 * - O gasto conta pelo que JÁ foi registrado. Uma auditoria em curso ainda não
 *   entrou na soma, então o estouro pode passar por uma corrida — o teto é uma
 *   barreira de entrada, não um freio no meio do trabalho já pago.
 */
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  getMonthlyBudgetUsd,
  inicioDoMes,
  type EstadoDoTeto,
} from "@/lib/ai-budget-policy";

export {
  getMonthlyBudgetUsd,
  mensagemDeTetoEstourado,
  type EstadoDoTeto,
} from "@/lib/ai-budget-policy";

export async function verificarTetoMensal(args: {
  userId?: string | null;
  userEmail?: string | null;
}): Promise<EstadoDoTeto> {
  const tetoUsd = getMonthlyBudgetUsd();
  if (!tetoUsd || !isDatabaseConfigured()) {
    return { ativo: false, gastoUsd: 0, tetoUsd, estourou: false };
  }

  try {
    const dono = args.userId
      ? { userId: args.userId }
      : args.userEmail
        ? { userEmail: args.userEmail }
        : {};

    const soma = await getPrisma().aiUsageEvent.aggregate({
      _sum: { estimatedCostUsd: true },
      where: { createdAt: { gte: inicioDoMes() }, ...dono },
    });

    const gastoUsd = soma._sum.estimatedCostUsd ?? 0;
    return { ativo: true, gastoUsd, tetoUsd, estourou: gastoUsd >= tetoUsd };
  } catch {
    /*
     * Banco fora do ar NÃO bloqueia o trabalho.
     *
     * O teto protege a fatura; recusar auditoria porque a contabilidade está
     * indisponível transformaria um problema de infraestrutura em paralisação
     * do produto. O risco assumido é gastar um pouco além num incidente.
     */
    return { ativo: true, gastoUsd: 0, tetoUsd, estourou: false };
  }
}
