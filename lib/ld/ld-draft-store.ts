import type { LdDraftStatus, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db";
import {
  assertProjectAccess,
  createDocumentArtifact,
  createProjectEvent,
  getUserActor,
} from "@/lib/project-store";

export const MAX_LD_DRAFTS = 30;

export type LdDraftUser = {
  email: string;
  name: string | null;
};

export type LdDraftPayload = {
  id?: string;
  projectId?: string;
  activeStep?: number;
  ldData?: Prisma.InputJsonValue;
  rows?: Prisma.InputJsonValue;
  tomos?: Prisma.InputJsonValue;
  referenceTotal?: number | null;
  manualTotal?: string;
  uploadedFileNames?: Prisma.InputJsonValue;
  uploadedFileCount?: number;
  generatedFileNames?: Prisma.InputJsonValue;
  status?: LdDraftStatus;
};

export class LdDraftProjectAccessError extends Error {
  constructor() {
    super("Projeto nao encontrado.");
    this.name = "LdDraftProjectAccessError";
  }
}

type LdDraftEventLike = {
  id: string;
  actorEmail: string;
  actorName: string | null;
  action: string;
  summary: string;
  details: Prisma.JsonValue | null;
  createdAt: Date;
};

type SerializableLdDraft = {
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
  projectId?: string | null;
  events?: LdDraftEventLike[];
  _count?: { events: number };
};

export function getLdUserIdentity(
  user?: { email?: string | null; name?: string | null } | null,
): LdDraftUser | null {
  const email = user?.email?.trim().toLocaleLowerCase("pt-BR");

  if (!email) {
    return null;
  }

  return {
    email,
    name: user?.name ?? null,
  };
}

export function serializeLdDraft(draft: SerializableLdDraft) {
  return {
    ...draft,
    uploadedFileNames: [],
    uploadedFileCount: draft.uploadedFileCount || getJsonArrayLength(draft.uploadedFileNames),
    eventCount: draft._count?.events ?? 0,
    _count: undefined,
    events: draft.events?.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    generatedAt: draft.generatedAt?.toISOString() ?? null,
  };
}

export async function listLdDrafts(args: { request: Request; userEmail: string }) {
  const prisma = getPrisma();
  const url = new URL(args.request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? MAX_LD_DRAFTS) || MAX_LD_DRAFTS),
  );

  const drafts = await prisma.ldDraft.findMany({
    where: getListFilters(url, args.userEmail),
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
    include: {
      _count: {
        select: {
          events: true,
        },
      },
    },
  });

  return drafts.map(serializeLdDraft);
}

export async function getLdDraftWithEvents(args: { id: string; userEmail: string }) {
  const draft = await getPrisma().ldDraft.findFirst({
    where: {
      id: args.id,
      userEmail: args.userEmail,
    },
    include: {
      events: {
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      },
    },
  });

  return draft ? serializeLdDraft(draft) : null;
}

export async function saveLdDraft(args: { user: LdDraftUser; payload: LdDraftPayload }) {
  const prisma = getPrisma();
  const body = args.payload;
  const ldData = asJson(body.ldData, {});
  const rows = asJson(body.rows, []);
  const tomos = asJson(body.tomos, []);
  const uploadedFileNames: Prisma.InputJsonValue = [];
  const generatedFileNames = asJson(body.generatedFileNames, []);
  const status = body.status ?? "DRAFT";
  const actor = await getUserActor(args.user.email, args.user.name);
  const requestedProjectId =
    body.projectId === undefined ? undefined : getStringField(body.projectId) || null;

  if (requestedProjectId) {
    try {
      await assertProjectAccess(requestedProjectId, actor);
    } catch {
      throw new LdDraftProjectAccessError();
    }
  }

  const data = {
    userEmail: args.user.email,
    userName: args.user.name,
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

  if (body.id) {
    const previous = await prisma.ldDraft.findFirst({
      where: {
        id: body.id,
        userEmail: args.user.email,
      },
    });

    if (!previous) {
      return null;
    }

    const change = buildUpdateSummary(previous, data);
    const updateData = {
      ...data,
      projectId: requestedProjectId === undefined ? previous.projectId : requestedProjectId,
      generatedAt:
        previous.generatedAt ??
        (status === "GENERATED" ? new Date() : undefined),
    };
    const effectiveProjectId = updateData.projectId;

    const draft = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.ldDraft.update({
        where: { id: previous.id },
        data: updateData,
      });

      if (change) {
        await transaction.ldDraftEvent.create({
          data: {
            draftId: previous.id,
            actorEmail: args.user.email,
            actorName: args.user.name,
            action: change.action,
            summary: change.summary,
          },
        });
      }

      if (effectiveProjectId && change?.action === "GENERATED") {
        await createProjectEvent(transaction, {
          projectId: effectiveProjectId,
          actor,
          type: "LD_GENERATED",
          title: "LD gerada",
          summary: updated.title,
          details: {
            draftId: updated.id,
            generatedFileNames,
          },
        });

        await createGeneratedArtifacts(transaction, {
          projectId: effectiveProjectId,
          draftId: updated.id,
          actor,
          generatedFileNames,
          status,
        });
      }

      return updated;
    });

    return serializeLdDraft(draft);
  }

  const draft = await prisma.$transaction(async (transaction) => {
    const created = await transaction.ldDraft.create({
      data: {
        ...data,
        projectId: requestedProjectId,
        events: {
          create: {
            actorEmail: args.user.email,
            actorName: args.user.name,
            action: "CREATED",
            summary: "Rascunho da LD criado.",
          },
        },
      },
    });

    if (requestedProjectId) {
      await createProjectEvent(transaction, {
        projectId: requestedProjectId,
        actor,
        type: "LD_DRAFT_CREATED",
        title: "Rascunho de LD criado",
        summary: created.title,
        details: {
          draftId: created.id,
        },
      });

      if (status === "GENERATED") {
        await createGeneratedArtifacts(transaction, {
          projectId: requestedProjectId,
          draftId: created.id,
          actor,
          generatedFileNames,
          status,
        });
      }
    }

    return created;
  });

  return serializeLdDraft(draft);
}

export async function archiveLdDraft(args: { id: string; user: LdDraftUser }) {
  const prisma = getPrisma();
  const draft = await prisma.ldDraft.findFirst({
    where: {
      id: args.id,
      userEmail: args.user.email,
    },
  });

  if (!draft) {
    return false;
  }

  await prisma.$transaction([
    prisma.ldDraft.update({
      where: { id: draft.id },
      data: { status: "ARCHIVED" },
    }),
    prisma.ldDraftEvent.create({
      data: {
        draftId: draft.id,
        actorEmail: args.user.email,
        actorName: args.user.name,
        action: "ARCHIVED",
        summary: "LD arquivada no histórico.",
      },
    }),
  ]);

  return true;
}

export async function reopenLdDraft(args: { id: string; user: LdDraftUser }) {
  const prisma = getPrisma();
  const draft = await prisma.ldDraft.findFirst({
    where: {
      id: args.id,
      userEmail: args.user.email,
    },
  });

  if (!draft) {
    return false;
  }

  await prisma.ldDraftEvent.create({
    data: {
      draftId: args.id,
      actorEmail: args.user.email,
      actorName: args.user.name,
      action: "REOPENED",
      summary: "LD reaberta para continuidade da montagem.",
    },
  });

  return true;
}

export async function duplicateLdDraft(args: { id: string; user: LdDraftUser }) {
  const prisma = getPrisma();
  const source = await prisma.ldDraft.findFirst({
    where: {
      id: args.id,
      userEmail: args.user.email,
    },
  });

  if (!source) {
    return null;
  }

  const duplicate = await prisma.ldDraft.create({
    data: {
      userEmail: args.user.email,
      userName: args.user.name,
      title: `${source.title} (cópia)`,
      projectCode: source.projectCode,
      workName: source.workName,
      status: "DRAFT",
      activeStep: source.activeStep,
      ldData: copyJson(source.ldData),
      rows: copyJson(source.rows),
      tomos: copyJson(source.tomos),
      referenceTotal: source.referenceTotal,
      manualTotal: source.manualTotal,
      uploadedFileNames: [],
      uploadedFileCount: source.uploadedFileCount || getJsonArrayLength(source.uploadedFileNames),
      generatedFileNames: [],
      events: {
        create: {
          actorEmail: args.user.email,
          actorName: args.user.name,
          action: "DUPLICATED",
          summary: `LD duplicada a partir de "${source.title}".`,
          details: {
            sourceId: source.id,
          },
        },
      },
    },
  });

  return serializeLdDraft(duplicate);
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

function getJsonArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function getGeneratedFileNames(value: Prisma.InputJsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getLdArtifactKind(fileName: string) {
  const normalized = fileName.toLocaleLowerCase("pt-BR");

  if (normalized.endsWith(".zip")) {
    return "LD_ZIP" as const;
  }

  if (normalized.endsWith(".pdf")) {
    return "LD_PDF" as const;
  }

  if (normalized.endsWith(".md")) {
    return "LD_REPORT" as const;
  }

  return "LD_ODT" as const;
}

function getMimeType(fileName: string) {
  const normalized = fileName.toLocaleLowerCase("pt-BR");

  if (normalized.endsWith(".zip")) {
    return "application/zip";
  }

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalized.endsWith(".md")) {
    return "text/markdown";
  }

  return "application/vnd.oasis.opendocument.text";
}

function getListFilters(url: URL, userEmail: string): Prisma.LdDraftWhereInput {
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const where: Prisma.LdDraftWhereInput = {
    userEmail,
  };

  if (status && ["DRAFT", "GENERATED", "ARCHIVED"].includes(status)) {
    where.status = status as LdDraftStatus;
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

async function createGeneratedArtifacts(
  transaction: Prisma.TransactionClient,
  args: {
    projectId: string;
    draftId: string;
    actor: Awaited<ReturnType<typeof getUserActor>>;
    generatedFileNames: Prisma.InputJsonValue;
    status: LdDraftStatus;
  },
) {
  for (const fileName of getGeneratedFileNames(args.generatedFileNames)) {
    await createDocumentArtifact(transaction, {
      projectId: args.projectId,
      ldDraftId: args.draftId,
      actor: args.actor,
      module: "ld",
      kind: getLdArtifactKind(fileName),
      fileName,
      mimeType: getMimeType(fileName),
      metadata: {
        source: "ld-draft",
        status: args.status,
      },
    });
  }
}

function copyJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
