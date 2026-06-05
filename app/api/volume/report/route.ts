import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  assertProjectAccess,
  createDocumentArtifact,
  getChecksumSha256,
  getUserActor,
  normalizeEmail,
} from "@/lib/project-store";
import type { AssemblyRow, VolumeMetadata, ImportedPdfFile } from "@/modules/volume-builder/lib/volume/volume-types";
import { generateMarkdownReport } from "@/modules/volume-builder/lib/pdf/generate-markdown-report";
import { generateReportFileName } from "@/modules/volume-builder/lib/volume/volume-naming";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { rows, metadata, importedFiles } = body as {
      rows: AssemblyRow[];
      metadata: VolumeMetadata;
      importedFiles: ImportedPdfFile[];
      projectId?: string;
    };

    if (!rows || rows.length === 0) {
      return withVolumeCors(
        NextResponse.json(
          { error: "Nenhuma linha de montagem fornecida." },
          { status: 400 }
        ),
        request
      );
    }

    const report = generateMarkdownReport({
      metadata: metadata || { projectCode: "", projectName: "" },
      importedFiles: importedFiles || [],
      rows,
      generatedAt: new Date(),
    });

    const reportFileName = generateReportFileName(metadata || { projectCode: "", projectName: "" });

    if (body.projectId) {
      if (!isDatabaseConfigured()) {
        return withVolumeCors(
          NextResponse.json(
            { error: "DATABASE_URL nao configurada para registrar artefatos." },
            { status: 503 },
          ),
          request,
        );
      }

      const session = await auth();
      const email = session?.user?.email?.trim();

      if (!email) {
        return withVolumeCors(
          NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 }),
          request,
        );
      }

      const actor = await getUserActor(normalizeEmail(email), session?.user?.name ?? null);

      try {
        await assertProjectAccess(body.projectId, actor);
      } catch {
        return withVolumeCors(
          NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 }),
          request,
        );
      }

      await getPrisma().$transaction((tx) =>
        createDocumentArtifact(tx, {
          projectId: body.projectId,
          actor,
          module: "volumes",
          kind: "VOLUME_REPORT",
          fileName: reportFileName,
          mimeType: "text/markdown",
          sizeBytes: Buffer.byteLength(report, "utf8"),
          checksumSha256: getChecksumSha256(report),
          metadata: {
            artifactRole: "assembly-report",
            importedFileCount: importedFiles?.length ?? 0,
            rowCount: rows.length,
          },
        }),
      );
    }

    return withVolumeCors(new NextResponse(report, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFileName}"`,
      },
    }), request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return withVolumeCors(NextResponse.json({ error: message }, { status: 500 }), request);
  }
}

export function OPTIONS(request: Request) {
  return volumeOptions(request, "POST, OPTIONS");
}
