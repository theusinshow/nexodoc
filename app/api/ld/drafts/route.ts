import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const MAX_DRAFTS = 30;

type LdDraftPayload = {
  id?: string;
  activeStep?: number;
  ldData?: Prisma.InputJsonValue;
  rows?: Prisma.InputJsonValue;
  tomos?: Prisma.InputJsonValue;
  referenceTotal?: number | null;
  manualTotal?: string;
  uploadedFileNames?: Prisma.InputJsonValue;
  uploadedFileCount?: number;
  generatedFileNames?: Prisma.InputJsonValue;
  status?: "DRAFT" | "GENERATED" | "ARCHIVED";
};

function getUserIdentity(session: Session | null) {
  const email = session?.user?.email?.trim().toLocaleLowerCase("pt-BR");

  if (!email) {
    return null;
  }

  return {
    email,
    name: session?.user?.name ?? null,
  };
}

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildTitle(ldData: unknown) {
  if (!ldData || typeof ldData !== "object") {
    return "LD sem identificação";
  }

  const data = ldData as Record<string, unknown>;
  const projectCode = getStringField(data.projectCode);
  const workName = getStringField(data.workName);

  return [projectCode, workName || "LD em montagem"].filter(Boolean).join(" - ");
}

function pickProjectCode(ldData: unknown) {
  return ldData && typeof ldData === "object"
    ? getStringField((ldData as Record<string, unknown>).projectCode)
    : "";
}

function pickWorkName(ldData: unknown) {
  return ldData && typeof ldData === "object"
    ? getStringField((ldData as Record<string, unknown>).workName)
    : "";
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;
}

function asJson(value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (value === undefined) {
    return fallback;
  }

  return value as Prisma.InputJsonValue;
}

function toNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function getJsonArrayLength(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.length : 0;
}

function serializeDraft(draft: {
  id: string;
  title: string;
  projectCode: string;
  workName: string;
  status: string;
  activeStep: number;
  ldData: Prisma.JsonValue;
  rows: Prisma.JsonValue;
  tomos: Prisma.JsonValue;
  referenceTotal: number | null;
  manualTotal: string;
  uploadedFileNames: Prisma.JsonValue;
  uploadedFileCount: number;
  generatedFileNames: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  generatedAt: Date | null;
  _count?: { events: number };
}) {
  return {
    ...draft,
    uploadedFileNames: [],
    uploadedFileCount: draft.uploadedFileCount || getJsonArrayLength(draft.uploadedFileNames),
    eventCount: draft._count?.events ?? 0,
    _count: undefined,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    generatedAt: draft.generatedAt?.toISOString() ?? null,
  };
}

function getListFilters(request: Request, userEmail: string): Prisma.LdDraftWhereInput {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const where: Prisma.LdDraftWhereInput = {
    userEmail,
  };

  if (status && ["DRAFT", "GENERATED", "ARCHIVED"].includes(status)) {
    where.status = status as "DRAFT" | "GENERATED" | "ARCHIVED";
  } else if (url.searchParams.get("includeArchived") !== "true") {
    where.status = { not: "ARCHIVED" };
  }

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { projectCode: { contains: query, mode: "insensitive" } },
      { workName: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}

function getJsonField(value: Prisma.JsonValue, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const field = value[key];
  return typeof field === "string" ? field.trim() : "";
}

function buildUpdateSummary(
  previous: {
    ldData: Prisma.JsonValue;
    rows: Prisma.JsonValue;
    tomos: Prisma.JsonValue;
    status: string;
  },
  next: {
    ldData: Prisma.InputJsonValue;
    rows: Prisma.InputJsonValue;
    tomos: Prisma.InputJsonValue;
    status: string;
  },
) {
  if (previous.status !== "GENERATED" && next.status === "GENERATED") {
    return { action: "GENERATED", summary: "Arquivos finais da LD foram gerados." };
  }

  const fields = [
    ["projectCode", "código do projeto"],
    ["workName", "nome da obra"],
    ["client", "órgão/cliente"],
    ["phase", "fase"],
    ["sectionTitle", "título da seção"],
  ];
  const changedLabels = fields
    .filter(([key]) => getJsonField(previous.ldData, key) !== getJsonField(next.ldData as Prisma.JsonValue, key))
    .map(([, label]) => label);

  if (JSON.stringify(previous.tomos) !== JSON.stringify(next.tomos)) {
    changedLabels.push("divisão de tomos");
  }

  if (JSON.stringify(previous.rows) !== JSON.stringify(next.rows)) {
    changedLabels.push("revisão das pranchas");
  }

  if (changedLabels.length === 0) {
    return null;
  }

  return {
    action: "UPDATED",
    summary: `Alterado: ${changedLabels.join(", ")}.`,
  };
}

export async function GET(request: Request) {
  const session = await auth();
  const user = getUserIdentity(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      drafts: [],
      disabledReason: "DATABASE_URL não configurada.",
    });
  }

  const drafts = await getPrisma().ldDraft.findMany({
    where: getListFilters(request, user.email),
    orderBy: {
      updatedAt: "desc",
    },
    take: Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? MAX_DRAFTS) || MAX_DRAFTS)),
    include: {
      _count: {
        select: {
          events: true,
        },
      },
    },
  });

  return NextResponse.json({
    drafts: drafts.map(serializeDraft),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = getUserIdentity(session);

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
  const ldData = asJson(body.ldData, {});
  const rows = asJson(body.rows, []);
  const tomos = asJson(body.tomos, []);
  const uploadedFileNames: Prisma.InputJsonValue = [];
  const generatedFileNames = asJson(body.generatedFileNames, []);
  const status = body.status ?? "DRAFT";
  const data = {
    userEmail: user.email,
    userName: user.name,
    title: buildTitle(body.ldData),
    projectCode: pickProjectCode(body.ldData),
    workName: pickWorkName(body.ldData),
    status,
    activeStep: typeof body.activeStep === "number" ? Math.max(0, Math.floor(body.activeStep)) : 0,
    ldData,
    rows,
    tomos,
    referenceTotal: toNumberOrNull(body.referenceTotal),
    manualTotal: body.manualTotal ?? "",
    uploadedFileNames,
    uploadedFileCount: toNonNegativeInteger(body.uploadedFileCount),
    generatedFileNames,
    generatedAt: status === "GENERATED" ? new Date() : undefined,
  };

  let draft;

  if (body.id) {
    const previous = await getPrisma().ldDraft.findFirst({
      where: {
        id: body.id,
        userEmail: user.email,
      },
    });

    if (!previous) {
      return NextResponse.json({ error: "Rascunho de LD não encontrado." }, { status: 404 });
    }

    const change = buildUpdateSummary(previous, data);
    const updateData = {
      ...data,
      generatedAt:
        previous.generatedAt ??
        (status === "GENERATED" ? new Date() : undefined),
    };

    draft = await getPrisma().$transaction(async (transaction) => {
      const updated = await transaction.ldDraft.update({
        where: { id: previous.id },
        data: updateData,
      });

      if (change) {
        await transaction.ldDraftEvent.create({
          data: {
            draftId: previous.id,
            actorEmail: user.email,
            actorName: user.name,
            action: change.action,
            summary: change.summary,
          },
        });
      }

      return updated;
    });
  } else {
    draft = await getPrisma().ldDraft.create({
      data: {
        ...data,
        events: {
          create: {
            actorEmail: user.email,
            actorName: user.name,
            action: "CREATED",
            summary: "Rascunho da LD criado.",
          },
        },
      },
    });
  }

  return NextResponse.json({
    draft: serializeDraft(draft),
  });
}
