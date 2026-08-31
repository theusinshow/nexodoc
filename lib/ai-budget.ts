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
  getGlobalMonthlyBudgetUsd,
  getMonthlyBudgetUsd,
  inicioDoMes,
  isentoDoTeto,
  type EstadoDoTeto,
} from "@/lib/ai-budget-policy";

export {
  getGlobalMonthlyBudgetUsd,
  getMonthlyBudgetUsd,
  mensagemDeTetoEstourado,
  type EscopoDoTeto,
  type EstadoDoTeto,
} from "@/lib/ai-budget-policy";

/**
 * O TETO DA CASA, medido antes do individual.
 *
 * Roda primeiro porque é o mais grave: se a soma do escritório estourou, saber
 * que este usuário específico ainda tinha saldo não muda nada — e a mensagem
 * que ele precisa ler é a do escritório, não a dele.
 *
 * NÃO ISENTA NINGUÉM, nem quem administra. A isenção do teto pessoal existe
 * para não bater a trave no meio de uma demonstração, e o custo dela é
 * limitado a um usuário. Aqui o custo é a fatura inteira: se o teto global
 * estourou, algo saiu do lugar (um laço, uma chave vazada), e o caminho certo
 * é olhar antes de continuar gastando. Quem administra amplia a variável em
 * meio minuto; a fatura não se desfaz.
 */
async function verificarTetoGlobal(): Promise<EstadoDoTeto | null> {
  const tetoUsd = getGlobalMonthlyBudgetUsd();
  if (!tetoUsd) {
    return null;
  }

  const soma = await getPrisma().aiUsageEvent.aggregate({
    _sum: { estimatedCostUsd: true },
    where: { createdAt: { gte: inicioDoMes() } },
  });

  const gastoUsd = soma._sum.estimatedCostUsd ?? 0;
  if (gastoUsd < tetoUsd) {
    return null;
  }

  return { ativo: true, gastoUsd, tetoUsd, estourou: true, escopo: "global" };
}

export async function verificarTetoMensal(args: {
  userId?: string | null;
  userEmail?: string | null;
}): Promise<EstadoDoTeto> {
  const tetoUsd = getMonthlyBudgetUsd();
  const tetoGlobalUsd = getGlobalMonthlyBudgetUsd();

  /*
   * Sem NENHUM dos dois tetos não há o que medir. A checagem olha os dois
   * porque o teto global precisa valer mesmo em ambiente que nunca configurou
   * o pessoal — do contrário a parede da casa dependeria da parede do quarto.
   */
  if ((!tetoUsd && !tetoGlobalUsd) || !isDatabaseConfigured()) {
    return { ativo: false, gastoUsd: 0, tetoUsd, estourou: false, escopo: "usuario" };
  }

  try {
    const global = await verificarTetoGlobal();
    if (global) {
      return global;
    }

    /*
     * O teto global pode existir sozinho. Sem o pessoal configurado, a medição
     * por usuário não tem régua para comparar e o trabalho segue — o que já foi
     * decidido acima é que a casa ainda tem saldo.
     */
    if (!tetoUsd) {
      return { ativo: true, gastoUsd: 0, tetoUsd: null, estourou: false, escopo: "usuario" };
    }

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
    /*
     * O ADMIN NÃO É BARRADO — mas é CONTADO.
     *
     * A soma acima roda para ele igual, e é de propósito: quem administra é o
     * maior consumidor (medido em 19/08/2026: US$ 19,31 num mês, contra US$
     * 0,91 de um usuário comum), e esconder esse gasto cegaria justamente o
     * número que define o teto dos outros. A isenção tira a PAREDE, não a conta.
     *
     * Ver `isentoDoTeto` para por que a exceção existe.
     */
    const isento = isentoDoTeto(args.userEmail, process.env.NEXODOC_ADMIN_EMAILS);
    return {
      ativo: true,
      gastoUsd,
      tetoUsd,
      estourou: !isento && gastoUsd >= tetoUsd,
      escopo: "usuario",
    };
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
