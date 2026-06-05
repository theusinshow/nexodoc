import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";
import {
  duplicateLdDraft,
  getLdUserIdentity,
} from "@/lib/ld/ld-draft-store";

export const runtime = "nodejs";

export async function POST(
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
  const draft = await duplicateLdDraft({ id, user });

  if (!draft) {
    return NextResponse.json({ error: "LD não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ draft });
}
