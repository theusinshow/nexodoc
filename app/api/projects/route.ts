import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { createProjectEvent, getUserActor, normalizeProjectCode } from "@/lib/project-store";

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

function serializeProject(project: {
  id: string;
  ownerEmail: string;
  ownerName: string | null;
  organizationId: string | null;
  code: string;
  name: string;
  client: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    audits: number;
    ldDrafts: number;
    documents: number;
    artifacts: number;
    events: number;
  };
}) {
  return {
    ...project,
    auditCount: project._count?.audits ?? 0,
    ldDraftCount: project._count?.ldDrafts ?? 0,
    documentCount: project._count?.documents ?? 0,
    artifactCount: project._count?.artifacts ?? 0,
    eventCount: project._count?.events ?? 0,
    _count: undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function getProjectFilters(request: Request, ownerEmail: string): Prisma.ProjectWhereInput {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const organizationId = url.searchParams.get("organizationId")?.trim();
  const where: Prisma.ProjectWhereInput = {
    ownerEmail,
  };

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (organizationId) {
    where.organizationId = organizationId;
  }

  if (!includeArchived && !includeDeleted) {
    where.status = "ACTIVE";
  }

  if (query) {
    where.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { client: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function GET(request: Request) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      projects: [],
      disabledReason: "DATABASE_URL não configurada.",
    });
  }

  const projects = await getPrisma().project.findMany({
    where: getProjectFilters(request, user.email),
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: {
        select: {
          audits: true,
          ldDrafts: true,
          documents: true,
          artifacts: true,
          events: true,
        },
      },
    },
  });

  return NextResponse.json({ projects: projects.map(serializeProject) });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL não configurada." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = getStringField(payload?.name);

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do projeto." }, { status: 400 });
  }

  const prisma = getPrisma();
  const actor = await getUserActor(user.email, user.name);
  const organizationId = getStringField(payload?.organizationId) || null;
  const code = normalizeProjectCode(getStringField(payload?.code));

  const project = await prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
        organizationId,
        ownerId: actor.id ?? undefined,
        ownerEmail: user.email,
        ownerName: user.name,
        code,
        name,
        client: getStringField(payload?.client),
        description: getStringField(payload?.description),
      },
    });

    await createProjectEvent(tx, {
      projectId: createdProject.id,
      actor,
      type: "PROJECT_CREATED",
      title: "Projeto criado",
      summary: createdProject.code
        ? `${createdProject.code} - ${createdProject.name}`
        : createdProject.name,
    });

    return tx.project.findUniqueOrThrow({
      where: { id: createdProject.id },
      include: {
        _count: {
          select: {
            audits: true,
            ldDrafts: true,
            documents: true,
            artifacts: true,
            events: true,
          },
        },
      },
    });
  }).catch((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return null;
    }

    throw error;
  });

  if (!project) {
    return NextResponse.json(
      { error: "Ja existe um projeto com este codigo para este usuario." },
      { status: 409 },
    );
  }

  return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
}
