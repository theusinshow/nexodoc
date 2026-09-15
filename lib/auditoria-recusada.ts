/**
 * A AUDITORIA RECUSADA ANTES DE COMEÇAR não deixa rastro.
 *
 * `createPendingAudit` cria a linha em PROCESSING logo depois das validações, e
 * isso está certo: um F5 durante a extração precisa achar a auditoria, senão a
 * tela declara "não encontrada" sobre uma análise que está começando. Mas a
 * recusa por documento idêntico vem DEPOIS, e o `return` dela não fechava a
 * linha — medido em 15/09/2026 pela jornada a5: cada recusa deixava uma
 * auditoria "rodando" para sempre, e o evento "Auditoria criada" no histórico
 * do projeto, de um trabalho que nunca existiu.
 *
 * Apagar, e não marcar: nenhum token foi gasto e nenhum achado nasceu. O filtro
 * por PROCESSING é a trava — auditoria com desfecho nunca sai daqui.
 *
 * PURO na forma: recebe o cliente do banco, para o teste rodar em node cru.
 */
export type BancoDoDescarte = {
  audit: {
    deleteMany(args: {
      where: { id: string; status: "PROCESSING" };
    }): Promise<{ count: number }>;
  };
  projectEvent: {
    deleteMany(args: {
      where: {
        type: "AUDIT_CREATED";
        details: { path: string[]; equals: string };
      };
    }): Promise<{ count: number }>;
  };
};

export async function descartarAuditoriaRecusada(
  db: BancoDoDescarte,
  auditId: string | null,
): Promise<{ auditorias: number; eventos: number }> {
  if (!auditId) return { auditorias: 0, eventos: 0 };
  try {
    const eventos = await db.projectEvent.deleteMany({
      where: {
        type: "AUDIT_CREATED",
        details: { path: ["auditId"], equals: auditId },
      },
    });
    const auditorias = await db.audit.deleteMany({
      where: { id: auditId, status: "PROCESSING" },
    });
    return { auditorias: auditorias.count, eventos: eventos.count };
  } catch (err) {
    // A recusa é o que a pessoa precisa ler; falhar em limpar não pode trocá-la
    // por um 500.
    console.error("[audit] não consegui descartar a auditoria recusada", err);
    return { auditorias: 0, eventos: 0 };
  }
}
