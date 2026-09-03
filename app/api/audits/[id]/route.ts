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
import { auditByIdWhereForActor } from "@/lib/audit-access";
import { marcarAuditoriaSemSinal } from "@/lib/audit-persistence";
import { MOTIVO_SEM_SINAL, auditoriaSemSinal } from "@/lib/batimento-da-auditoria";
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
      where: auditByIdWhereForActor(id, actor),
      select: {
        status: true,
        report: true,
        result: true,
        error: true,
        /* O batimento e a criação — juntos dizem se ainda há alguém do outro
           lado. Ver a checagem logo abaixo. */
        heartbeatAt: true,
        createdAt: true,
        /*
         * OS ARQUIVOS, para o parecer saber qual documento abrir. Quem chega
         * pelo link do e-mail não tem o memorial nesta máquina, e o checksum é
         * o que o leva até `/api/arquivos/<checksum>`.
         */
        files: { select: { fileName: true, checksumSha256: true } },
      },
    });

    if (!audit) {
      return NextResponse.json({ status: "DESCONHECIDA" }, { status: 404 });
    }

    /*
     * A AUDITORIA ÓRFÃ MORRE AQUI — e é esta rota que a encontra, porque é a
     * única que alguém consulta de propósito sobre uma análise em curso.
     *
     * A auditoria roda dentro do POST que a pediu. Quando o container reinicia
     * no meio (deploy, OOM), a linha fica em PROCESSING e ninguém a fecha: quem
     * a fecharia morreu junto. Do lado de cá, `use-reconectar-auditoria`
     * pergunta de cinco em cinco segundos e nunca desiste — a tela dizia "a
     * análise está rodando no servidor" por horas sobre trabalho que acabou no
     * primeiro minuto.
     *
     * FECHAR AQUI, e não numa varredura periódica: o custo é zero quando não há
     * ninguém esperando (não se consulta auditoria que ninguém abriu), e a
     * pessoa que está olhando a tela é exatamente quem precisa da resposta.
     * Uma varredura resolveria o mesmo com um processo a mais para manter vivo.
     *
     * A resposta sai como FAILED na MESMA requisição que descobriu: devolver
     * PROCESSING aqui e FAILED cinco segundos depois seria uma volta a mais de
     * espera por uma decisão já tomada.
     */
    if (auditoriaSemSinal(audit)) {
      await marcarAuditoriaSemSinal(id);
      return NextResponse.json({
        status: "FAILED",
        report: null,
        result: "",
        error: MOTIVO_SEM_SINAL,
        arquivos: audit.files,
      });
    }

    return NextResponse.json({
      status: audit.status,
      report: (audit.report as AuditReport | null) ?? null,
      result: audit.result ?? "",
      error: audit.error ?? null,
      arquivos: audit.files,
    });
  } catch {
    return NextResponse.json({ error: "Banco não respondeu." }, { status: 503 });
  }
}
