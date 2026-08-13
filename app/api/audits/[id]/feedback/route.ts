import { AuditFeedbackVerdict } from "@prisma/client";
import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

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

  return NextResponse.json({ feedback, enabled: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    note?: string;
  };
  const verdict = parseVerdict(body.verdict);
  const temResolvido = typeof body.resolved === "boolean";

  /*
   * DUAS PERGUNTAS, UMA ROTA. O veredito julga a auditoria ("procede?"); o
   * `resolved` conta o trabalho ("já corrigi?"). Vir só um dos dois é o caso
   * comum — quem marca corrigido não está, com isso, avaliando o motor.
   * Recusar só quando não vier nenhum: aí a requisição não pede nada.
   */
  if (!verdict && !temResolvido) {
    return jsonError("Informe a avaliação do achado ou se ele foi corrigido.");
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
    verdict,
    resolvedAt: resolvedAt ?? null,
    note,
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
          },
        });

  return NextResponse.json({ feedback });
}
