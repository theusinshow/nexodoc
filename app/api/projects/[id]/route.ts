import { NextResponse } from "next/server";
import type { Prisma, ProjectStatus } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { getUserActor, normalizeProjectCode, updateProjectStatus } from "@/lib/project-store";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

function getUserIdentity(session: Session | null) {
  const email = session?.user?.email?.trim().toLocaleLowerCase("pt-BR");

  if (!email) {
    return null;
  }

  return {
    email,
    name: session?.user?.name?.trim() || null,
  };
}

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStatusField(value: unknown): ProjectStatus | undefined {
  return value === "ACTIVE" || value === "ARCHIVED" ? value : undefined;
}

function serializeProjectDetail(project: Awaited<ReturnType<typeof getProjectById>>) {
  return {
    ...project,
    auditCount: project._count.audits,
    ldDraftCount: project._count.ldDrafts,
    documentCount: project._count.documents,
    uploadCount: project._count.uploads,
    artifactCount: project._count.artifacts,
    eventCount: project._count.events,
    _count: undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    documents: project.documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })),
    uploads: project.uploads.map((upload) => ({
      ...upload,
      createdAt: upload.createdAt.toISOString(),
    })),
    artifacts: project.artifacts.map((artifact) => ({
      ...artifact,
      createdAt: artifact.createdAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
    })),
    events: project.events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function getProjectById(id: string, ownerEmail: string) {
  return getPrisma().project.findFirstOrThrow({
    where: {
      id,
      deletedAt: null,
      OR: [
        { ownerEmail },
        {
          organization: {
            members: {
              some: {
                email: ownerEmail,
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          audits: true,
          ldDrafts: true,
          documents: true,
          uploads: true,
          artifacts: true,
          events: true,
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      uploads: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  /*
   * O PORTAO, DEPOIS da identidade.
   *
   * `getUserIdentity` continua porque o resto do arquivo usa `user.email` para
   * falar com `lib/project-store.ts`, e ela estreita o tipo. Mas ela so
   * respondia "tem sessao?" -- pertencer a um escritorio nunca foi perguntado.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL não configurada." },
      { status: 503 },
    );
  }

  const { id } = await params;

  try {
    const project = await getProjectById(id, user.email);
    return NextResponse.json({ project: serializeProjectDetail(project) });
  } catch {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  /*
   * O PORTAO, DEPOIS da identidade.
   *
   * `getUserIdentity` continua porque o resto do arquivo usa `user.email` para
   * falar com `lib/project-store.ts`, e ela estreita o tipo. Mas ela so
   * respondia "tem sessao?" -- pertencer a um escritorio nunca foi perguntado.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL não configurada." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const prisma = getPrisma();
  const existing = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [
        { ownerEmail: user.email },
        {
          organization: {
            members: {
              some: {
                email: user.email,
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      status: true,
      name: true,
      ownerId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const nextStatus = getStatusField(payload?.status);
  const nextName = getStringField(payload?.name);
  const updateData = {
    ...(payload?.code !== undefined ? { code: normalizeProjectCode(getStringField(payload.code)) } : {}),
    ...(nextName ? { name: nextName } : {}),
    ...(payload?.client !== undefined ? { client: getStringField(payload.client) } : {}),
    ...(payload?.description !== undefined
      ? { description: getStringField(payload.description) }
      : {}),
    ...(nextStatus ? { status: nextStatus } : {}),
  };

  if (Object.keys(updateData).length === 0) {
    const project = await getProjectById(existing.id, user.email);
    return NextResponse.json({ project: serializeProjectDetail(project) });
  }

  const project = await prisma.$transaction(async (tx) => {
    const actor = await getUserActor(user.email, user.name);

    if (nextStatus) {
      await updateProjectStatus(tx, {
        projectId: existing.id,
        actor,
        status: nextStatus,
        details: updateData as Prisma.InputJsonValue,
      });
    } else {
      await tx.project.update({
        where: { id: existing.id },
        data: updateData,
      });

      await tx.projectEvent.create({
        data: {
        projectId: existing.id,
        actorId: existing.ownerId,
        actorEmail: user.email,
        actorName: user.name,
        type: "PROJECT_UPDATED",
        title: "Projeto atualizado",
        summary: nextName || existing.name,
        details: updateData,
        },
      });
    }

    return getProjectById(existing.id, user.email);
  });

  return NextResponse.json({ project: serializeProjectDetail(project) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  /*
   * O PORTAO, DEPOIS da identidade.
   *
   * `getUserIdentity` continua porque o resto do arquivo usa `user.email` para
   * falar com `lib/project-store.ts`, e ela estreita o tipo. Mas ela so
   * respondia "tem sessao?" -- pertencer a um escritorio nunca foi perguntado.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL nao configurada." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const prisma = getPrisma();
  const existing = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [
        { ownerEmail: user.email },
        {
          organization: {
            members: {
              some: {
                email: user.email,
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
  }

  const actor = await getUserActor(user.email, user.name);

  await prisma.$transaction(async (tx) => {
    await updateProjectStatus(tx, {
      projectId: existing.id,
      actor,
      status: "DELETED",
    });
  });

  return NextResponse.json({ deleted: true });
}
