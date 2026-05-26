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
    note?: string;
  };
  const verdict = parseVerdict(body.verdict);

  if (!verdict) {
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

  const data = {
    auditId: id,
    targetKey,
    findingId: findingId || null,
    findingLabel: String(body.findingLabel ?? "").trim().slice(0, 160) || null,
    page: String(body.page ?? "").trim().slice(0, 80) || null,
    verdict,
    note,
  };

  const feedback =
    verdict === AuditFeedbackVerdict.MISSING_FINDING
      ? await getPrisma().auditFeedback.create({ data })
      : await getPrisma().auditFeedback.upsert({
          where: { auditId_targetKey: { auditId: id, targetKey } },
          create: data,
          update: {
            findingLabel: data.findingLabel,
            page: data.page,
            verdict: data.verdict,
            note: data.note,
          },
        });

  return NextResponse.json({ feedback });
}
