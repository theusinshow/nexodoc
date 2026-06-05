import type { DocumentArtifactKind, DocumentArtifactStatus, Prisma } from "@prisma/client";

import { describeStoredFile } from "@/lib/file-storage";
import {
  createDocumentArtifact,
  createProjectUpload,
  type ActorIdentity,
} from "@/lib/project-store";

type StorableData = Parameters<typeof describeStoredFile>[0]["data"];
type ArtifactTx = Parameters<typeof createDocumentArtifact>[0];
type UploadTx = Parameters<typeof createProjectUpload>[0];

export async function createStoredDocumentArtifact(
  tx: ArtifactTx,
  input: {
    data: StorableData;
    projectId?: string | null;
    auditId?: string | null;
    ldDraftId?: string | null;
    actor: ActorIdentity;
    module: string;
    kind: DocumentArtifactKind;
    status?: DocumentArtifactStatus;
    fileName: string;
    mimeType: string;
    metadata?: Prisma.InputJsonValue;
    expiresAt?: Date | null;
  },
) {
  const { data, ...artifact } = input;
  const storage = describeStoredFile({
    data,
    module: artifact.module,
    projectId: artifact.projectId,
    fileName: artifact.fileName,
  });

  return createDocumentArtifact(tx, {
    ...artifact,
    ...storage,
  });
}

export async function createStoredProjectUpload(
  tx: UploadTx,
  input: {
    data: StorableData;
    projectId?: string | null;
    actor: ActorIdentity;
    module: string;
    source?: string;
    fileName: string;
    mimeType: string;
    pageCount?: number | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const { data, ...upload } = input;
  const storage = describeStoredFile({
    data,
    module: upload.module,
    projectId: upload.projectId,
    fileName: upload.fileName,
  });

  return createProjectUpload(tx, {
    ...upload,
    ...storage,
  });
}
