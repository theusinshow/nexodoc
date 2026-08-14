/**
 * O estado de UMA auditoria, por id.
 *
 * Existe para RECONECTAR: a análise roda de 3 a 6 minutos e vivia presa à aba
 * que a disparou — um F5 ou uma troca de conversa matava a espera, e com ela os
 * minutos de modelo que já tinham sido pagos. O servidor nunca parou de
 * trabalhar nesses casos; o que faltava era como perguntar o que aconteceu.
 *
 * O cliente gera o `auditId` ANTES de começar (a rota de auditoria aceita o id
 * de quem chama) e o guarda junto da conversa. Ao voltar, pergunta aqui.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { Actor } from "@/lib/actor";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import type { AuditReport } from "@/lib/audit-report";

export const runtime = "nodejs";

const VALID_ID = /^[A-Za-z0-9-]{8,80}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!VALID_ID.test(id)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  /*
   * Sem banco não há o que reconectar — e é importante dizer isso em vez de
   * responder "não encontrei": a interface precisa distinguir "essa auditoria
   * não existe" de "este ambiente não guarda auditoria nenhuma", senão fica
   * perguntando para sempre por algo que nunca vai chegar.
   */
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ status: "SEM_HISTORICO" });
  }

  /*
   * O PARECER É DO ESCRITÓRIO, e esta rota não perguntava nada: quem tivesse o
   * id lia a auditoria inteira, sem sessão. O id é gerado pelo cliente antes de
   * começar, então não é segredo nem finge ser.
   */
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  try {
    const audit = await getPrisma().audit.findFirst({
      where: {
        id,
        OR: [
          { project: { organizationId: actor.organizationId } },
          /*
           * O LEGADO. Auditoria do Nexo anterior a este trabalho não tem projeto
           * (`projectId` nulo), e ela precisa continuar legível: escopar só por
           * organização a tornaria invisível para quem a rodou, o que é apagar
           * histórico pela porta dos fundos.
           *
           * A condição é estreita de propósito — SEM projeto E de quem está
           * pedindo. Auditoria órfã de outra pessoa continua fora.
           *
           * E o `userId` do ator PRECISA existir para esta cláusula entrar. A
           * rota antiga não exigia sessão, então gravou auditoria com `userId`
           * nulo; um ator sem conta (convidado recém-ativado) casaria nulo com
           * nulo e leria TODAS elas. Sem id, sem cláusula.
           */
          ...(actor.userId ? [{ projectId: null, userId: actor.userId }] : []),
        ],
      },
      select: { status: true, report: true, result: true, error: true },
    });

    if (!audit) {
      return NextResponse.json({ status: "DESCONHECIDA" }, { status: 404 });
    }

    return NextResponse.json({
      status: audit.status,
      report: (audit.report as AuditReport | null) ?? null,
      result: audit.result ?? "",
      error: audit.error ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Banco não respondeu." }, { status: 503 });
  }
}
