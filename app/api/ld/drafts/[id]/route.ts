import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function getUserEmail(session: Session | null) {
  return session?.user?.email?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function serializeDraft(draft: {
  id: string;
  title: string;
  projectCode: string;
  workName: string;
  status: string;
  activeStep: number;
  ldData: unknown;
  rows: unknown;
  tomos: unknown;
  referenceTotal: number | null;
  manualTotal: string;
  uploadedFileNames: unknown;
  generatedFileNames: unknown;
  createdAt: Date;
  updatedAt: Date;
  generatedAt: Date | null;
  events?: Array<{
    id: string;
    actorEmail: string;
    actorName: string | null;
    action: string;
    summary: string;
    details: Prisma.JsonValue | null;
    createdAt: Date;
  }>;
}) {
  return {
    ...draft,
    events: draft.events?.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    generatedAt: draft.generatedAt?.toISOString() ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userEmail = getUserEmail(session);

  if (!userEmail) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const { id } = await params;
  const draft = await getPrisma().ldDraft.findFirst({
    where: {
      id,
      userEmail,
    },
    include: {
      events: {
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    draft: serializeDraft(draft),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userEmail = getUserEmail(session);

  if (!userEmail) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const { id } = await params;
  const draft = await getPrisma().ldDraft.findFirst({
    where: {
      id,
      userEmail,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
  }

  await getPrisma().$transaction([
    getPrisma().ldDraft.update({
      where: { id: draft.id },
      data: { status: "ARCHIVED" },
    }),
    getPrisma().ldDraftEvent.create({
      data: {
        draftId: draft.id,
        actorEmail: userEmail,
        actorName: session?.user?.name ?? null,
        action: "ARCHIVED",
        summary: "LD arquivada no histórico.",
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userEmail = getUserEmail(session);

  if (!userEmail) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "REOPENED" ? "REOPENED" : null;

  if (!action) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const draft = await getPrisma().ldDraft.findFirst({
    where: { id, userEmail },
  });

  if (!draft) {
    return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
  }

  await getPrisma().ldDraftEvent.create({
    data: {
      draftId: id,
      actorEmail: userEmail,
      actorName: session?.user?.name ?? null,
      action,
      summary: "LD reaberta para continuidade da montagem.",
    },
  });

  return NextResponse.json({ ok: true });
}
