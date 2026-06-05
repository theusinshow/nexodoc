import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { createStoredDocumentArtifact } from "@/lib/project-files";
import {
  assertProjectAccess,
  getUserActor,
  normalizeEmail,
} from "@/lib/project-store";

export class VolumeArtifactPersistenceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VolumeArtifactPersistenceError";
    this.status = status;
  }
}

export async function persistVolumeReportArtifact(args: {
  projectId: string;
  userEmail?: string | null;
  userName?: string | null;
  report: string;
  fileName: string;
  importedFileCount: number;
  rowCount: number;
}) {
  const actor = await getVolumeActor(args);

  await getPrisma().$transaction((tx) =>
    createStoredDocumentArtifact(tx, {
      data: args.report,
      projectId: args.projectId,
      actor,
      module: "volumes",
      kind: "VOLUME_REPORT",
      fileName: args.fileName,
      mimeType: "text/markdown",
      metadata: {
        artifactRole: "assembly-report",
        importedFileCount: args.importedFileCount,
        rowCount: args.rowCount,
      },
    }),
  );
}

export async function persistVolumeBuildArtifacts(args: {
  projectId: string;
  userEmail?: string | null;
  userName?: string | null;
  report: string;
  reportFileName: string;
  importedFileCount: number;
  rowCount: number;
  pdfFiles: Array<{
    fileName: string;
    data: Uint8Array;
  }>;
  zip?: {
    fileName: string;
    data: Uint8Array;
  } | null;
}) {
  const actor = await getVolumeActor(args);

  await getPrisma().$transaction(async (tx) => {
    for (const pdf of args.pdfFiles) {
      await createStoredDocumentArtifact(tx, {
        data: Buffer.from(pdf.data),
        projectId: args.projectId,
        actor,
        module: "volumes",
        kind: "VOLUME_PDF",
        fileName: pdf.fileName,
        mimeType: "application/pdf",
        metadata: {
          artifactRole: "assembled-volume",
          importedFileCount: args.importedFileCount,
          rowCount: args.rowCount,
        },
      });
    }

    if (args.zip) {
      await createStoredDocumentArtifact(tx, {
        data: Buffer.from(args.zip.data),
        projectId: args.projectId,
        actor,
        module: "volumes",
        kind: "VOLUME_ZIP",
        fileName: args.zip.fileName,
        mimeType: "application/zip",
        metadata: {
          artifactRole: "assembled-volume-package",
          importedFileCount: args.importedFileCount,
          rowCount: args.rowCount,
          pdfCount: args.pdfFiles.length,
        },
      });
    }

    await createStoredDocumentArtifact(tx, {
      data: args.report,
      projectId: args.projectId,
      actor,
      module: "volumes",
      kind: "VOLUME_REPORT",
      fileName: args.reportFileName,
      mimeType: "text/markdown",
      metadata: {
        artifactRole: "assembly-report",
        importedFileCount: args.importedFileCount,
        rowCount: args.rowCount,
        generatedWithBuild: true,
      },
    });
  });
}

async function getVolumeActor(args: {
  projectId: string;
  userEmail?: string | null;
  userName?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    throw new VolumeArtifactPersistenceError(
      "DATABASE_URL nao configurada para registrar artefatos.",
      503,
    );
  }

  const email = args.userEmail?.trim();

  if (!email) {
    throw new VolumeArtifactPersistenceError("Autenticacao necessaria.", 401);
  }

  const actor = await getUserActor(normalizeEmail(email), args.userName ?? null);

  try {
    await assertProjectAccess(args.projectId, actor);
  } catch {
    throw new VolumeArtifactPersistenceError("Projeto nao encontrado.", 404);
  }

  return actor;
}
