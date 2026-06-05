import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";
import {
  archiveLdDraft,
  getLdDraftWithEvents,
  getLdUserIdentity,
  reopenLdDraft,
} from "@/lib/ld/ld-draft-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getLdUserIdentity(session?.user);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const { id } = await params;
  const draft = await getLdDraftWithEvents({ id, userEmail: user.email });

  if (!draft) {
    return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ draft });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getLdUserIdentity(session?.user);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const { id } = await params;
  const archived = await archiveLdDraft({ id, user });

  if (!archived) {
    return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getLdUserIdentity(session?.user);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action !== "REOPENED") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const { id } = await params;
  const reopened = await reopenLdDraft({ id, user });

  if (!reopened) {
    return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
