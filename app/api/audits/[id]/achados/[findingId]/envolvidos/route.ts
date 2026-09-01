/**
 * OS ENVOLVIDOS de um achado — entrar e sair.
 *
 * `POST` envolve, `DELETE` tira. Os dois deixam linha na conversa, e sair NÃO
 * apaga o registro de ter entrado: é a diferença entre "a Carla nunca esteve
 * aqui" e "a Carla esteve e saiu".
 *
 * O RESPONSÁVEL NÃO MORA AQUI. Ele é um, e continua em
 * `AuditFeedback.assigneeEmail`, gravado por `POST /atribuir`. A assimetria é a
 * decisão do desenho: um responde, os outros acompanham.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { AchadoRecusado, desenvolver, envolver } from "@/lib/achado-compartilhado";
import { isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const VALID_ID = /^[A-Za-z0-9-]{1,80}$/;

function recusa(err: unknown) {
  const negado = accessDeniedResponse(err);
  if (negado) return negado;
  if (err instanceof AchadoRecusado) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

async function ler(request: Request) {
  const corpo = (await request.json().catch(() => null)) as {
    email?: unknown;
    nome?: unknown;
  } | null;

  return {
    email: typeof corpo?.email === "string" ? corpo.email : "",
    nome: typeof corpo?.nome === "string" ? corpo.nome : "",
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const { email, nome } = await ler(request);

    await envolver({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
      autor: { id: actor.userId, email: actor.email },
      email,
      nome,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const { email, nome } = await ler(request);

    await desenvolver({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
      autor: { id: actor.userId, email: actor.email },
      email,
      nome,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}
