import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { Actor } from "@/lib/actor";
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

/**
 * O ESCRITÓRIO É O FILTRO, e era o dono.
 *
 * `ownerEmail` aqui é o motivo pelo qual o Victor nunca via o 063-26: a rota de
 * detalhe já honrava membership da organização (`lib/project-store.ts`), mas a
 * listagem montava o próprio `where` e contornava o helper. Ele abriria o
 * projeto por link direto e não o encontraria em lugar nenhum da interface.
 *
 * O `organizationId` deixou de vir da URL: escolher o escritório pela query
 * seria deixar o cliente dizer de quem é o dado que quer ver.
 */
function getProjectFilters(request: Request, organizationId: string): Prisma.ProjectWhereInput {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const where: Prisma.ProjectWhereInput = {
    organizationId,
  };

  if (!includeDeleted) {
    where.deletedAt = null;
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
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      projects: [],
      disabledReason: "DATABASE_URL não configurada.",
    });
  }

  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  const projects = await getPrisma().project.findMany({
    where: getProjectFilters(request, actor.organizationId),
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

  let actorDoEscritorio: Actor;
  try {
    actorDoEscritorio = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  /*
   * A ALÇADA. Cadastrar projeto é ato de coordenação, não de projetista.
   *
   * É o cadastro que define o centro de custo, e centro de custo errado manda a
   * auditoria — e, depois, os achados atribuídos — para a fila de outro
   * projeto. Ninguém percebe até alguém receber uma pendência que não é dele.
   *
   * O admin de plataforma passa junto para não ficar trancado fora do sistema
   * que administra.
   */
  if (actorDoEscritorio.orgRole === "MEMBER" && !actorDoEscritorio.isPlatformAdmin) {
    return NextResponse.json(
      { error: "Só a coordenação do escritório cadastra projeto." },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = getStringField(payload?.name);

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do projeto." }, { status: 400 });
  }

  const prisma = getPrisma();
  const actor = await getUserActor(user.email, user.name);

  /*
   * O ESCRITÓRIO VEM DO ATOR, e vinha do corpo da requisição.
   *
   * `organizationId` era lido do payload: o cliente dizia de que escritório era
   * o projeto que estava criando. Com uma organização só isso não tinha efeito
   * visível, e é justamente por isso que passaria despercebido até o dia em que
   * houvesse duas.
   */
  const organizationId = actorDoEscritorio.organizationId;
  const code = normalizeProjectCode(getStringField(payload?.code));

  if (!code) {
    return NextResponse.json({ error: "Informe o centro de custo do projeto." }, { status: 400 });
  }

  const project = await prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
        organizationId,
        createdById: actorDoEscritorio.userId ?? actor.id ?? undefined,
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
