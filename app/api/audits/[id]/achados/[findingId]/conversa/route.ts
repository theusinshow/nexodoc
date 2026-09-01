/**
 * A CONVERSA DE UM ACHADO — ler e escrever.
 *
 * Rota por ACHADO, e não por auditoria: é a granularidade em que o trabalho
 * acontece. Uma rota da auditoria inteira devolveria a conversa de trinta
 * achados para desenhar a de um.
 *
 * Quem pode: qualquer pessoa do escritório que enxergue a auditoria — a guarda
 * mora em `garantirLinhaDoAchado`, que busca a auditoria COM o escopo da
 * organização. Não há nível novo de permissão, e é decisão: num escritório de um
 * dígito de pessoas, portão gera pedido de liberação, não segurança. O que
 * existe no lugar é rastro — toda ação vira linha assinada.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { AchadoRecusado, comentar, garantirLinhaDoAchado } from "@/lib/achado-compartilhado";
import { linhaDoTempo, type LinhaCrua } from "@/lib/conversa-do-achado";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

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

/** Os nomes do escritório, numa consulta só — e não uma por linha. */
async function nomesDe(emails: string[], organizationId: string) {
  const unicos = [...new Set(emails.map((e) => e.toLowerCase()))].filter(Boolean);
  if (unicos.length === 0) return new Map<string, string>();

  const membros = await getPrisma().organizationMember.findMany({
    where: { organizationId, email: { in: unicos } },
    select: { email: true, name: true },
  });

  return new Map(membros.filter((m) => m.name).map((m) => [m.email, m.name as string]));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ linhas: [], envolvidos: [], euSou: actor.email });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const linha = await garantirLinhaDoAchado({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
    });

    const [mensagens, envolvidos] = await Promise.all([
      getPrisma().auditFindingMessage.findMany({
        where: { feedbackId: linha.id },
        orderBy: { createdAt: "asc" },
      }),
      getPrisma().auditFindingWatcher.findMany({
        where: { feedbackId: linha.id },
        orderBy: { addedAt: "asc" },
        select: { email: true },
      }),
    ]);

    const nomes = await nomesDe(
      [...mensagens.map((m) => m.authorEmail), ...envolvidos.map((e) => e.email)],
      actor.organizationId,
    );

    const cruas: LinhaCrua[] = mensagens.map((m) => ({
      kind: m.kind,
      authorEmail: m.authorEmail,
      authorNome: nomes.get(m.authorEmail) ?? "",
      body: m.body,
      details: (m.details as Record<string, unknown> | null) ?? null,
      createdAt: m.createdAt.getTime(),
    }));

    return NextResponse.json({
      linhas: linhaDoTempo(cruas),
      envolvidos: envolvidos.map((e) => ({
        email: e.email,
        // Melhor um endereço do que uma linha sem dono.
        nome: nomes.get(e.email) ?? e.email,
      })),
      /*
       * QUEM ESTÁ LENDO, do servidor — mesma razão do `euSou` na rota de
       * feedback: com duas fontes, o dia em que a sessão trocar sem a árvore
       * remontar a tela atribui a fala à pessoa errada.
       */
      euSou: actor.email.toLowerCase(),
    });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
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

    const corpo = (await request.json().catch(() => null)) as { body?: unknown } | null;

    await comentar({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
      autor: { id: actor.userId, email: actor.email },
      body: typeof corpo?.body === "string" ? corpo.body : "",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}
