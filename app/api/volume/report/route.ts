import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  persistVolumeReportArtifact,
  VolumeArtifactPersistenceError,
} from "@/lib/volume-artifacts";
import type { AssemblyRow, VolumeMetadata, ImportedPdfFile } from "@/modules/volume-builder/lib/volume/volume-types";
import { generateMarkdownReport } from "@/modules/volume-builder/lib/pdf/generate-markdown-report";
import { generateReportFileName } from "@/modules/volume-builder/lib/volume/volume-naming";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export async function POST(request: NextRequest) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

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
      const session = await auth();

      try {
        await persistVolumeReportArtifact({
          projectId: body.projectId,
          userEmail: session?.user?.email,
          userName: session?.user?.name,
          report,
          fileName: reportFileName,
          importedFileCount: importedFiles?.length ?? 0,
          rowCount: rows.length,
        });
      } catch (error) {
        if (error instanceof VolumeArtifactPersistenceError) {
          return withVolumeCors(
            NextResponse.json({ error: error.message }, { status: error.status }),
            request,
          );
        }

        throw error;
      }
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
