/**
 * QUEM FEZ O QUÊ no painel — o registro que não existia.
 *
 * Até aqui nada era gravado: quem promoveu quem a admin, quem apagou cinquenta
 * auditorias em lote. Enquanto o painel só lia, a lacuna era desconforto. Com o
 * expurgo — que apaga obra inteira, de todos os donos — ela vira risco: um gesto
 * irreversível sem autor não tem como ser auditado depois.
 *
 * NUNCA DERRUBA A AÇÃO QUE REGISTRA. Se a gravação da trilha falhar, a ação já
 * aconteceu, e recusá-la depois do fato seria mentir sobre o estado do banco. O
 * erro vai para o log do servidor e a ação segue — é a mesma postura de
 * `gravarNoServidor` no cliente, e pelo mesmo motivo: o registro é sobre a
 * ação, não é a ação.
 *
 * O `quem` vem SEMPRE do portão (`checkAdminRequest`), nunca do corpo do
 * pedido. Um autor que o cliente escolhe é um autor que o cliente forja.
 */
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

/** O que se fez. Texto e não enum: ação nova não deve pedir migração. */
export type AcaoDoPainel =
  | "expurgo"
  | "modelo"
  | "modelo-reset"
  | "cambio"
  | "metas"
  | "usuario"
  | "escritorio"
  | "teto"
  | "vazao"
  | "limites"
  | "escritorio-padrao";

export interface RegistroDeAcao {
  /** E-mail de quem executou, vindo do portão. */
  quem: string;
  acao: AcaoDoPainel;
  /**
   * Sobre o quê. "tudo", "obra:088-25-CRICIUMA", "selecao", o e-mail do usuário
   * alterado, o id do fluxo. Vazio quando a ação não tem alvo.
   */
  alcance?: string;
  /** As contagens ou o de/para. Forma livre porque cada ação conta outra coisa. */
  resumo: Record<string, unknown>;
}

export async function registrarAcao(registro: RegistroDeAcao): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    await getPrisma().acaoAdministrativa.create({
      data: {
        quem: registro.quem,
        acao: registro.acao,
        alcance: registro.alcance ?? "",
        resumo: registro.resumo as never,
      },
    });
  } catch (erro) {
    console.error("[trilha] não foi possível registrar a ação administrativa", {
      acao: registro.acao,
      alcance: registro.alcance,
      erro,
    });
  }
}

/** As últimas ações, para o cockpit. */
export async function ultimasAcoes(limite = 10) {
  if (!isDatabaseConfigured()) return [];

  const linhas = await getPrisma().acaoAdministrativa.findMany({
    take: Math.min(100, Math.max(1, limite)),
    orderBy: { quando: "desc" },
  });

  return linhas.map((linha) => ({
    id: linha.id,
    quando: linha.quando.toISOString(),
    quem: linha.quem,
    acao: linha.acao,
    alcance: linha.alcance,
    resumo: linha.resumo,
  }));
}
