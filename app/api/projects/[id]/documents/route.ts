import { NextResponse } from "next/server";
import type { Prisma, ProjectDocumentStatus } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { assertProjectAccess, createProjectDocument, getUserActor, normalizeEmail } from "@/lib/project-store";

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

function getStatusField(value: unknown): ProjectDocumentStatus | undefined {
  return value === "ACTIVE" || value === "ARCHIVED" || value === "DELETED" ? value : undefined;
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

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ documents: [], disabledReason: "DATABASE_URL nao configurada." });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const actor = await getUserActor(user.email, user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const documents = await getPrisma().projectDocument.findMany({
    where: {
      projectId: id,
      ...(includeDeleted ? {} : { status: { not: "DELETED" as const } }),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
  });

  return NextResponse.json({
    documents: documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
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

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL nao configurada." }, { status: 503 });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fileName = getStringField(payload?.fileName);
  const sourceModule = getStringField(payload?.module);
  const documentType = getStringField(payload?.documentType);

  if (!fileName || !sourceModule || !documentType) {
    return NextResponse.json(
      { error: "Informe fileName, module e documentType." },
      { status: 400 },
    );
  }

  const actor = await getUserActor(user.email, user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const document = await getPrisma().$transaction((tx) =>
    createProjectDocument(tx, {
      projectId: id,
      actor,
      module: sourceModule,
      documentType,
      fileName,
      mimeType: getStringField(payload?.mimeType) || "application/pdf",
      sizeBytes: getNumberField(payload?.sizeBytes),
      pageCount: getNumberField(payload?.pageCount),
      checksumSha256: getStringField(payload?.checksumSha256) || undefined,
      status: getStatusField(payload?.status),
      metadata: payload?.metadata as Prisma.InputJsonValue | undefined,
    }),
  );

  return NextResponse.json({
    document: {
      ...document,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    },
  }, { status: 201 });
}
