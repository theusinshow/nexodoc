import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getLdUserIdentity,
  LdDraftProjectAccessError,
  listLdDrafts,
  saveLdDraft,
  type LdDraftPayload,
} from "@/lib/ld/ld-draft-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const user = getLdUserIdentity(session?.user);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      drafts: [],
      disabledReason: "DATABASE_URL não configurada.",
    });
  }

  const drafts = await listLdDrafts({ request, userEmail: user.email });

  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = getLdUserIdentity(session?.user);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL não configurada. Autosave de LD indisponível." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as LdDraftPayload;

  try {
    const draft = await saveLdDraft({ user, payload: body });

    if (!draft) {
      return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof LdDraftProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    throw error;
  }
}
