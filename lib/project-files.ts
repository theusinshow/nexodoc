import type { DocumentArtifactKind, DocumentArtifactStatus, Prisma } from "@prisma/client";

import { describeStoredFile, guardarArquivo } from "@/lib/file-storage";
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
    /**
     * O ESCRITÓRIO DONO DOS BYTES. Quando vem, o arquivo é GUARDADO de verdade;
     * quando não vem, o comportamento é o de sempre — só metadados.
     *
     * Explícito, e não deduzido do `projectId`: guardar 5 MB é decisão de quem
     * chama, e uma busca implícita faria isso acontecer em caminhos que nunca
     * pediram.
     */
    organizationId?: string | null;
    actor: ActorIdentity;
    module: string;
    source?: string;
    fileName: string;
    mimeType: string;
    pageCount?: number | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const { data, organizationId, ...upload } = input;
  const storage = describeStoredFile({
    data,
    module: upload.module,
    projectId: upload.projectId,
    fileName: upload.fileName,
  });

  /*
   * OS BYTES, quando há escritório para respondê-los.
   *
   * Fora da transação de propósito: um arquivo de 5 MB dentro da transação que
   * grava o parecer manteria o lock aberto pelo tempo do upload, e o parecer é o
   * que não pode falhar. Se isto falhar, a auditoria continua gravada e o botão
   * "ver no documento" apenas não aparece — degradação, não perda.
   */
  const guardado = organizationId
    ? await guardarArquivo({ data, organizationId, mimeType: upload.mimeType })
    : null;

  return createProjectUpload(tx, {
    ...upload,
    ...storage,
    ...(guardado
      ? { storageProvider: "postgres", storageKey: guardado.checksumSha256 }
      : {}),
  });
}
