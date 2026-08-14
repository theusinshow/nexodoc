import { AuditFeedbackVerdict } from "@prisma/client";
import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { Actor } from "@/lib/actor";
import {
  DesfechoInvalido,
  gravacaoDoDesfecho,
  type GravacaoDoDesfecho,
} from "@/lib/desfecho-do-achado";

export const runtime = "nodejs";

const VALID_ID = /^[A-Za-z0-9-]{8,80}$/;

function isFeedbackEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY === "true"
  );
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseVerdict(value: unknown) {
  if (
    value === AuditFeedbackVerdict.CONFIRMED ||
    value === AuditFeedbackVerdict.FALSE_POSITIVE ||
    value === AuditFeedbackVerdict.WRONG_SEVERITY ||
    value === AuditFeedbackVerdict.MISSING_FINDING
  ) {
    return value;
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isFeedbackEnabled() || !isDatabaseConfigured()) {
    return NextResponse.json({ feedback: [], enabled: false });
  }

  const { id } = await params;

  if (!VALID_ID.test(id)) {
    return jsonError("Identificador de auditoria inválido.");
  }

  const feedback = await getPrisma().auditFeedback.findMany({
    where: { auditId: id },
    orderBy: { createdAt: "asc" },
  });

  /*
   * O NOME de quem resolveu, junto da linha.
   *
   * A tarja do cartão é onde QUEM ENVIOU descobre o que aconteceu com o achado
   * que delegou — não há lista "enviados por mim" em lugar nenhum. "Corrigido"
   * sozinho não responde a pergunta que essa pessoa tem, que é "por quem".
   *
   * Uma consulta para todos, e não uma por linha: um parecer com quarenta
   * achados resolvidos pela mesma pessoa seriam quarenta idas ao banco pelo
   * mesmo nome.
   */
  const idsDeQuemResolveu = [
    ...new Set(feedback.map((f) => f.resolvedById).filter((x): x is string => Boolean(x))),
  ];

  const nomes = new Map<string, string>();

  if (idsDeQuemResolveu.length > 0) {
    const usuarios = await getPrisma().user.findMany({
      where: { id: { in: idsDeQuemResolveu } },
      select: { id: true, name: true, email: true },
    });

    for (const u of usuarios) nomes.set(u.id, u.name || u.email);
  }

  return NextResponse.json({
    feedback: feedback.map((f) => ({
      ...f,
      resolvedByName: f.resolvedById ? (nomes.get(f.resolvedById) ?? null) : null,
    })),
    enabled: true,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isFeedbackEnabled()) {
    return jsonError("Feedback público desabilitado neste ambiente.", 403);
  }

  if (!isDatabaseConfigured()) {
    return jsonError("Histórico persistente não configurado.", 503);
  }

  const { id } = await params;

  if (!VALID_ID.test(id)) {
    return jsonError("Identificador de auditoria inválido.");
  }

  const body = (await request.json()) as {
    findingId?: string;
    findingLabel?: string;
    page?: string;
    verdict?: string;
    /** Corrigido no memorial. Independente do veredito — ver o schema. */
    resolved?: boolean;
    /** COMO foi encerrado — ver [[lib/desfecho-do-achado.ts]]. */
    resolutionKind?: string;
    note?: string;
  };
  const verdict = parseVerdict(body.verdict);
  const temResolvido = typeof body.resolved === "boolean";

  /*
   * O DESFECHO é a terceira coisa que esta rota grava — e ela continua sendo
   * UMA rota porque tudo mora na MESMA LINHA. Uma rota separada para resolver
   * faria duas escritas concorrentes no mesmo registro, e a última a chegar
   * apagaria o que a outra tinha acabado de decidir.
   *
   * Quem julga se o desfecho é válido é o núcleo puro, e não esta rota: a regra
   * da nota obrigatória precisa valer para qualquer caminho que grave, e ter
   * teste que roda sem banco.
   */
  let desfecho: GravacaoDoDesfecho | null = null;

  if (body.resolutionKind !== undefined) {
    try {
      desfecho = gravacaoDoDesfecho({
        desfecho: String(body.resolutionKind),
        note: typeof body.note === "string" ? body.note : undefined,
        agora: new Date(),
      });
    } catch (err) {
      if (err instanceof DesfechoInvalido) return jsonError(err.motivo);
      throw err;
    }
  }

  /*
   * DUAS PERGUNTAS, UMA ROTA. O veredito julga a auditoria ("procede?"); o
   * `resolved` conta o trabalho ("já corrigi?"). Vir só um dos dois é o caso
   * comum — quem marca corrigido não está, com isso, avaliando o motor.
   * Recusar só quando não vier nenhum: aí a requisição não pede nada.
   */
  if (!verdict && !temResolvido && !desfecho) {
    return jsonError("Informe a avaliação do achado, o desfecho, ou se ele foi corrigido.");
  }

  if (body.verdict !== undefined && !verdict) {
    return jsonError("Classificação de feedback inválida.");
  }

  const audit = await getPrisma().audit.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!audit) {
    return jsonError("Auditoria não encontrada.", 404);
  }

  const findingId = String(body.findingId ?? "").trim().slice(0, 80);
  const note = String(body.note ?? "").trim().slice(0, 1000);
  const targetKey =
    verdict === AuditFeedbackVerdict.MISSING_FINDING
      ? `missing:${crypto.randomUUID()}`
      : `finding:${findingId}`;

  if (verdict !== AuditFeedbackVerdict.MISSING_FINDING && !findingId) {
    return jsonError("Informe o achado avaliado.");
  }

  const resolvedAt = temResolvido ? (body.resolved ? new Date() : null) : undefined;
  const data = {
    auditId: id,
    targetKey,
    findingId: findingId || null,
    findingLabel: String(body.findingLabel ?? "").trim().slice(0, 160) || null,
    page: String(body.page ?? "").trim().slice(0, 80) || null,
    /*
     * O DESFECHO VENCE, quando vem. Ele já embute o veredito no caso do falso
     * positivo, e sua nota já foi aparada e validada pelo núcleo puro — usar o
     * `note` cru aqui desfaria a validação que acabou de acontecer.
     */
    verdict: desfecho?.verdict ?? verdict,
    resolvedAt: desfecho ? desfecho.resolvedAt : (resolvedAt ?? null),
    note: desfecho ? desfecho.note : note,
    ...(desfecho
      ? { resolutionKind: desfecho.resolutionKind, resolvedById: actor.userId }
      : {}),
  };

  const feedback =
    verdict === AuditFeedbackVerdict.MISSING_FINDING
      ? await getPrisma().auditFeedback.create({ data })
      : await getPrisma().auditFeedback.upsert({
          where: { auditId_targetKey: { auditId: id, targetKey } },
          create: data,
          /*
           * SÓ SOBRESCREVE O QUE VEIO. A linha é uma só por achado e guarda as
           * duas decisões; um `update` cego zeraria o veredito toda vez que
           * alguém marcasse corrigido, e apagaria a marca de corrigido toda vez
           * que alguém julgasse o achado. `undefined` é o que o Prisma entende
           * por "não toque nesta coluna" — diferente de `null`, que apaga.
           */
          update: {
            findingLabel: data.findingLabel,
            page: data.page,
            ...(verdict ? { verdict } : {}),
            ...(resolvedAt !== undefined ? { resolvedAt } : {}),
            ...(body.note !== undefined ? { note } : {}),
            /*
             * O desfecho sobrescreve por último, e de propósito: quando ele vem,
             * é a decisão mais recente sobre o achado. A nota só é gravada se o
             * desfecho trouxe uma — senão apagaria a que já estava lá.
             */
            ...(desfecho
              ? {
                  resolutionKind: desfecho.resolutionKind,
                  resolvedAt: desfecho.resolvedAt,
                  resolvedById: actor.userId,
                  ...(desfecho.verdict ? { verdict: desfecho.verdict } : {}),
                  ...(desfecho.note ? { note: desfecho.note } : {}),
                }
              : {}),
          },
        });

  return NextResponse.json({ feedback });
}
