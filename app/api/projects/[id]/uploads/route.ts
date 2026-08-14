import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { assertProjectAccess, createProjectUpload, getUserActor, normalizeEmail } from "@/lib/project-store";

export const runtime = "nodejs";

function getUserIdentity(session: Session | null) {
  const email = session?.user?.email?.trim();

  if (!email) {
    return null;
  }

  return {
    email: normalizeEmail(email),
    name: session?.user?.name?.trim() || null,
  };
}

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  /*
   * O PORTAO, DEPOIS da identidade -- mesmo desenho de `documents` e
   * `artifacts`, que sao as rotas irmas. Esta ficou para tras na conversao do
   * substrato e so apareceu quando a varredura passou por ela.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ uploads: [], disabledReason: "DATABASE_URL nao configurada." });
  }

  const { id } = await params;
  const actor = await getUserActor(user.email, user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const url = new URL(request.url);
  const uploads = await getPrisma().projectUpload.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
  });

  return NextResponse.json({
    uploads: uploads.map((upload) => ({
      ...upload,
      createdAt: upload.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL nao configurada." }, { status: 503 });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fileName = getStringField(payload?.fileName);
  const sourceModule = getStringField(payload?.module);
  const mimeType = getStringField(payload?.mimeType);

  if (!fileName || !sourceModule || !mimeType) {
    return NextResponse.json(
      { error: "Informe fileName, module e mimeType." },
      { status: 400 },
    );
  }

  const actor = await getUserActor(user.email, user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const upload = await getPrisma().$transaction((tx) =>
    createProjectUpload(tx, {
      projectId: id,
      actor,
      module: sourceModule,
      source: getStringField(payload?.source) || "manual",
      fileName,
      mimeType,
      sizeBytes: getNumberField(payload?.sizeBytes),
      pageCount: getNumberField(payload?.pageCount),
      storageProvider: getStringField(payload?.storageProvider) || "none",
      storageKey: getStringField(payload?.storageKey) || undefined,
      checksumSha256: getStringField(payload?.checksumSha256) || undefined,
      metadata: payload?.metadata as Prisma.InputJsonValue | undefined,
    }),
  );

  return NextResponse.json({
    upload: {
      ...upload,
      createdAt: upload.createdAt.toISOString(),
    },
  }, { status: 201 });
}
