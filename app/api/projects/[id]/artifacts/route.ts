import { NextResponse } from "next/server";
import type { DocumentArtifactKind, DocumentArtifactStatus, Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { assertProjectAccess, createDocumentArtifact, getUserActor, normalizeEmail } from "@/lib/project-store";

export const runtime = "nodejs";

const ARTIFACT_KINDS = new Set<DocumentArtifactKind>([
  "COVER_ODT",
  "COVER_PDF",
  "COVER_ZIP",
  "LD_ODT",
  "LD_PDF",
  "LD_REPORT",
  "LD_ZIP",
  "AUDIT_MARKDOWN",
  "AUDIT_PDF",
  "VOLUME_REPORT",
  "VOLUME_PDF",
  "VOLUME_ZIP",
  "OTHER",
]);

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

function getKindField(value: unknown): DocumentArtifactKind | null {
  return typeof value === "string" && ARTIFACT_KINDS.has(value as DocumentArtifactKind)
    ? value as DocumentArtifactKind
    : null;
}

function getStatusField(value: unknown): DocumentArtifactStatus | undefined {
  return value === "AVAILABLE" || value === "FAILED" || value === "EXPIRED" || value === "DELETED"
    ? value
    : undefined;
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
    return NextResponse.json({ artifacts: [], disabledReason: "DATABASE_URL nao configurada." });
  }

  const { id } = await params;
  const actor = await getUserActor(user.email, user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const artifacts = await getPrisma().documentArtifact.findMany({
    where: {
      projectId: id,
      ...(includeDeleted ? {} : { status: { not: "DELETED" as const } }),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
  });

  return NextResponse.json({
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      createdAt: artifact.createdAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
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
  const kind = getKindField(payload?.kind);
  const fileName = getStringField(payload?.fileName);
  const sourceModule = getStringField(payload?.module);
  const mimeType = getStringField(payload?.mimeType);

  if (!kind || !fileName || !sourceModule || !mimeType) {
    return NextResponse.json(
      { error: "Informe kind, fileName, module e mimeType." },
      { status: 400 },
    );
  }

  const actor = await getUserActor(user.email, user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const expiresAtValue = getStringField(payload?.expiresAt);
  const artifact = await getPrisma().$transaction((tx) =>
    createDocumentArtifact(tx, {
      projectId: id,
      auditId: getStringField(payload?.auditId) || undefined,
      ldDraftId: getStringField(payload?.ldDraftId) || undefined,
      actor,
      module: sourceModule,
      kind,
      status: getStatusField(payload?.status),
      fileName,
      mimeType,
      sizeBytes: getNumberField(payload?.sizeBytes),
      storageProvider: getStringField(payload?.storageProvider) || "none",
      storageKey: getStringField(payload?.storageKey) || undefined,
      downloadUrl: getStringField(payload?.downloadUrl) || undefined,
      checksumSha256: getStringField(payload?.checksumSha256) || undefined,
      metadata: payload?.metadata as Prisma.InputJsonValue | undefined,
      expiresAt: expiresAtValue ? new Date(expiresAtValue) : undefined,
    }),
  );

  return NextResponse.json({
    artifact: {
      ...artifact,
      createdAt: artifact.createdAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
    },
  }, { status: 201 });
}
