/**
 * ENVIAR achados a alguém do escritório.
 *
 * Recebe uma LISTA porque é assim que o trabalho acontece: quem revê o memorial
 * marca os cinco erros de PPCI e manda todos de uma vez. Uma rota por achado
 * seriam cinco requisições e cinco chances de metade chegar — e nenhuma tela
 * sabe explicar "três dos cinco foram".
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { isDatabaseConfigured } from "@/lib/db";
import { atribuirAchados, FilaRecusada } from "@/lib/fila-de-achados";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }

    const corpo = (await request.json().catch(() => null)) as {
      findingIds?: unknown;
      assigneeEmail?: unknown;
    } | null;

    const findingIds = Array.isArray(corpo?.findingIds)
      ? corpo.findingIds.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const assigneeEmail =
      typeof corpo?.assigneeEmail === "string" ? corpo.assigneeEmail.trim().toLowerCase() : "";

    if (findingIds.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um achado." }, { status: 400 });
    }

    if (!assigneeEmail) {
      return NextResponse.json({ error: "Informe para quem enviar." }, { status: 400 });
    }

    const resultado = await atribuirAchados({
      auditId: id,
      findingIds,
      assigneeEmail,
      atribuidoPor: { id: actor.userId, email: actor.email },
      organizationId: actor.organizationId,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;

    if (err instanceof FilaRecusada) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    throw err;
  }
}
