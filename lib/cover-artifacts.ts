import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { createStoredDocumentArtifact } from "@/lib/project-files";
import {
  assertProjectAccess,
  getUserActor,
  normalizeEmail,
} from "@/lib/project-store";
import type { GeneralData } from "@/modules/cover-generator/types";

export class CoverArtifactPersistenceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CoverArtifactPersistenceError";
    this.status = status;
  }
}

export async function persistCoverGenerationArtifacts(args: {
  projectId: string;
  userEmail?: string | null;
  userName?: string | null;
  generalData: GeneralData;
  pageCount: number;
  odt: {
    fileName: string;
    buffer: Buffer;
  };
  pdf?: {
    fileName: string;
    buffer: Buffer;
  } | null;
  zip: {
    fileName: string;
    buffer: Buffer;
  };
}) {
  if (!isDatabaseConfigured()) {
    throw new CoverArtifactPersistenceError(
      "DATABASE_URL nao configurada para registrar artefatos.",
      503,
    );
  }

  const email = args.userEmail?.trim();

  if (!email) {
    throw new CoverArtifactPersistenceError("Autenticacao necessaria.", 401);
  }

  const actor = await getUserActor(normalizeEmail(email), args.userName ?? null);

  try {
    await assertProjectAccess(args.projectId, actor);
  } catch {
    throw new CoverArtifactPersistenceError("Projeto nao encontrado.", 404);
  }

  await getPrisma().$transaction(async (tx) => {
    await createStoredDocumentArtifact(tx, {
      data: args.odt.buffer,
      projectId: args.projectId,
      actor,
      module: "capas",
      kind: "COVER_ODT",
      fileName: args.odt.fileName,
      mimeType: "application/vnd.oasis.opendocument.text",
      metadata: {
        templateId: args.generalData.templateId,
        pageCount: args.pageCount,
      },
    });

    if (args.pdf) {
      await createStoredDocumentArtifact(tx, {
        data: args.pdf.buffer,
        projectId: args.projectId,
        actor,
        module: "capas",
        kind: "COVER_PDF",
        fileName: args.pdf.fileName,
        mimeType: "application/pdf",
        metadata: {
          templateId: args.generalData.templateId,
          pageCount: args.pageCount,
        },
      });
    }

    await createStoredDocumentArtifact(tx, {
      data: args.zip.buffer,
      projectId: args.projectId,
      actor,
      module: "capas",
      kind: "COVER_ZIP",
      fileName: args.zip.fileName,
      mimeType: "application/zip",
      metadata: {
        templateId: args.generalData.templateId,
        pageCount: args.pageCount,
        pdfGenerated: Boolean(args.pdf),
      },
    });
  });
}
