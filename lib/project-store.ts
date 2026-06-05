import type {
  DocumentArtifactKind,
  DocumentArtifactStatus,
  Prisma,
  ProjectDocumentStatus,
  ProjectEventType,
  ProjectStatus,
} from "@prisma/client";
import { createHash } from "crypto";

import { getPrisma } from "@/lib/db";

export type ActorIdentity = {
  id?: string | null;
  email: string;
  name?: string | null;
};

type PrismaClientOrTransaction = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeProjectCode(code: string) {
  return code.trim().toLocaleUpperCase("pt-BR");
}

export function getChecksumSha256(input: Buffer | Uint8Array | string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function getUserActor(email: string, name?: string | null): Promise<ActorIdentity> {
  const normalizedEmail = normalizeEmail(email);
  const user = await getPrisma().user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true },
  });

  return {
    id: user?.id ?? null,
    email: normalizedEmail,
    name: name?.trim() || user?.name || null,
  };
}

export async function assertProjectAccess(projectId: string, actor: ActorIdentity) {
  return getPrisma().project.findFirstOrThrow({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { ownerEmail: actor.email },
        {
          organization: {
            members: {
              some: {
                email: actor.email,
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    },
  });
}

export async function createProjectEvent(
  tx: PrismaClientOrTransaction,
  input: {
    projectId: string;
    actor: ActorIdentity;
    type: ProjectEventType;
    title: string;
    summary?: string;
    details?: Prisma.InputJsonValue;
  },
) {
  return tx.projectEvent.create({
    data: {
      projectId: input.projectId,
      actorId: input.actor.id ?? undefined,
      actorEmail: input.actor.email,
      actorName: input.actor.name ?? undefined,
      type: input.type,
      title: input.title,
      summary: input.summary ?? "",
      details: input.details,
    },
  });
}

export async function createProjectDocument(
  tx: PrismaClientOrTransaction,
  input: {
    projectId?: string | null;
    actor: ActorIdentity;
    module: string;
    documentType: string;
    fileName: string;
    mimeType?: string;
    sizeBytes?: number | null;
    pageCount?: number | null;
    checksumSha256?: string | null;
    status?: ProjectDocumentStatus;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const document = await tx.projectDocument.create({
    data: {
      projectId: input.projectId ?? undefined,
      userId: input.actor.id ?? undefined,
      userEmail: input.actor.email,
      module: input.module,
      documentType: input.documentType,
      fileName: input.fileName,
      mimeType: input.mimeType ?? "application/pdf",
      sizeBytes: input.sizeBytes ?? undefined,
      pageCount: input.pageCount ?? undefined,
      checksumSha256: input.checksumSha256 ?? undefined,
      status: input.status ?? "ACTIVE",
      metadata: input.metadata,
    },
  });

  if (input.projectId) {
    await createProjectEvent(tx, {
      projectId: input.projectId,
      actor: input.actor,
      type: "DOCUMENT_ADDED",
      title: "Documento registrado",
      summary: input.fileName,
      details: {
        documentId: document.id,
        module: input.module,
        documentType: input.documentType,
      },
    });
  }

  return document;
}

export async function createProjectUpload(
  tx: PrismaClientOrTransaction,
  input: {
    projectId?: string | null;
    actor: ActorIdentity;
    module: string;
    source?: string;
    fileName: string;
    mimeType: string;
    sizeBytes?: number | null;
    pageCount?: number | null;
    storageProvider?: string;
    storageKey?: string | null;
    checksumSha256?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const upload = await tx.projectUpload.create({
    data: {
      projectId: input.projectId ?? undefined,
      userId: input.actor.id ?? undefined,
      userEmail: input.actor.email,
      module: input.module,
      source: input.source ?? "manual",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes ?? undefined,
      pageCount: input.pageCount ?? undefined,
      storageProvider: input.storageProvider ?? "none",
      storageKey: input.storageKey ?? undefined,
      checksumSha256: input.checksumSha256 ?? undefined,
      metadata: input.metadata,
    },
  });

  if (input.projectId) {
    await createProjectEvent(tx, {
      projectId: input.projectId,
      actor: input.actor,
      type: "INPUT_UPLOADED",
      title: "Arquivo de entrada registrado",
      summary: input.fileName,
      details: {
        uploadId: upload.id,
        module: input.module,
        source: input.source ?? "manual",
      },
    });
  }

  return upload;
}

export async function createDocumentArtifact(
  tx: PrismaClientOrTransaction,
  input: {
    projectId?: string | null;
    auditId?: string | null;
    ldDraftId?: string | null;
    actor: ActorIdentity;
    module: string;
    kind: DocumentArtifactKind;
    status?: DocumentArtifactStatus;
    fileName: string;
    mimeType: string;
    sizeBytes?: number | null;
    storageProvider?: string;
    storageKey?: string | null;
    downloadUrl?: string | null;
    checksumSha256?: string | null;
    metadata?: Prisma.InputJsonValue;
    expiresAt?: Date | null;
  },
) {
  const artifact = await tx.documentArtifact.create({
    data: {
      projectId: input.projectId ?? undefined,
      auditId: input.auditId ?? undefined,
      ldDraftId: input.ldDraftId ?? undefined,
      userId: input.actor.id ?? undefined,
      userEmail: input.actor.email,
      module: input.module,
      kind: input.kind,
      status: input.status ?? "AVAILABLE",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes ?? undefined,
      storageProvider: input.storageProvider ?? "none",
      storageKey: input.storageKey ?? undefined,
      downloadUrl: input.downloadUrl ?? undefined,
      checksumSha256: input.checksumSha256 ?? undefined,
      metadata: input.metadata,
      expiresAt: input.expiresAt ?? undefined,
    },
  });

  if (input.projectId) {
    const eventType: ProjectEventType =
      input.kind.toString().startsWith("LD_") ? "LD_GENERATED" :
      input.kind.toString().startsWith("COVER_") ? "COVER_GENERATED" :
      input.kind.toString().startsWith("VOLUME_") ? "VOLUME_GENERATED" :
      input.kind.toString().startsWith("AUDIT_") ? "AUDIT_COMPLETED" :
      "ARTIFACT_CREATED";

    await createProjectEvent(tx, {
      projectId: input.projectId,
      actor: input.actor,
      type: eventType,
      title: "Artefato registrado",
      summary: input.fileName,
      details: {
        artifactId: artifact.id,
        module: input.module,
        kind: input.kind,
      },
    });
  }

  return artifact;
}

export async function updateProjectStatus(
  tx: PrismaClientOrTransaction,
  input: {
    projectId: string;
    actor: ActorIdentity;
    status: ProjectStatus;
    details?: Prisma.InputJsonValue;
  },
) {
  const now = new Date();
  const project = await tx.project.update({
    where: { id: input.projectId },
    data: {
      status: input.status,
      archivedAt: input.status === "ARCHIVED" ? now : null,
      deletedAt: input.status === "DELETED" ? now : null,
    },
  });

  await createProjectEvent(tx, {
    projectId: input.projectId,
    actor: input.actor,
    type:
      input.status === "ARCHIVED" ? "PROJECT_ARCHIVED" :
      input.status === "DELETED" ? "PROJECT_DELETED" :
      "STATUS_CHANGED",
    title: "Status alterado",
    summary: input.status,
    details: input.details,
  });

  return project;
}
