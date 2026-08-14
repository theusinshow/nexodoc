import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import {
  persistVolumeBuildArtifacts,
  VolumeArtifactPersistenceError,
} from "@/lib/volume-artifacts";
import type { AssemblyRow, VolumeMetadata, ImportedPdfFile } from "@/modules/volume-builder/lib/volume/volume-types";
import { buildRowPdf } from "@/modules/volume-builder/lib/volume/assembly-builder";
import { generateZip } from "@/modules/volume-builder/lib/pdf/generate-zip";
import { generateMarkdownReport } from "@/modules/volume-builder/lib/pdf/generate-markdown-report";
import { generateReportFileName, generateZipFileName } from "@/modules/volume-builder/lib/volume/volume-naming";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";

export async function POST(request: NextRequest) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   *
   * Havia um `auth()` mais abaixo, e ele enganava: morava dentro de
   * `if (projectId)` e servia so para ROTULAR o artefato com o e-mail de quem
   * gerou. Cracha, nao tranca -- sem sessao a etiqueta saia vazia e o volume era
   * montado do mesmo jeito, de graca, para quem chamasse.
   *
   * A rota irma `analyze` recebeu este mesmo trecho quando as demais foram
   * convertidas; esta ficou para tras, e quem a encontrou foi a varredura.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  try {
    const formData = await request.formData();

    const rowsJson = formData.get("rows");
    const metadataJson = formData.get("metadata");
    const importedFilesJson = formData.get("importedFiles");
    const projectIdValue = formData.get("projectId");
    const projectId =
      typeof projectIdValue === "string" && projectIdValue.trim().length > 0
        ? projectIdValue.trim()
        : null;

    if (!rowsJson || typeof rowsJson !== "string") {
      return withVolumeCors(
        NextResponse.json(
          { error: "Dados das linhas nao fornecidos." },
          { status: 400 }
        ),
        request
      );
    }

    const rows: AssemblyRow[] = JSON.parse(rowsJson);
    const metadata: VolumeMetadata = metadataJson
      ? JSON.parse(metadataJson as string)
      : { projectCode: "", projectName: "" };
    const importedFiles: ImportedPdfFile[] = importedFilesJson
      ? JSON.parse(importedFilesJson as string)
      : [];

    if (rows.length === 0) {
      return withVolumeCors(
        NextResponse.json(
          { error: "Nenhuma linha de montagem fornecida." },
          { status: 400 }
        ),
        request
      );
    }

    const fileBuffers = new Map<string, ArrayBuffer>();
    for (const importedFile of importedFiles) {
      const file = formData.get(`file_${importedFile.id}`);
      if (file instanceof File) {
        const buffer = await file.arrayBuffer();
        fileBuffers.set(importedFile.id, buffer);
      }
    }

    const pdfResults: { name: string; data: Uint8Array }[] = [];

    for (const row of rows) {
      try {
        const pdfBytes = await buildRowPdf(row, fileBuffers);
        const fileName = row.outputFileName || `volume_${row.order}.pdf`;
        pdfResults.push({ name: fileName, data: pdfBytes });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return withVolumeCors(
          NextResponse.json(
            { error: `Erro ao gerar PDF da linha "${row.title}": ${message}` },
            { status: 500 }
          ),
          request
        );
      }
    }

    const report = generateMarkdownReport({
      metadata,
      importedFiles,
      rows,
      generatedAt: new Date(),
    });
    const reportFileName = generateReportFileName(metadata);

    if (pdfResults.length === 1) {
      const pdf = pdfResults[0];

      if (projectId) {
        const session = await auth();

        try {
          await persistVolumeBuildArtifacts({
            projectId,
            userEmail: session?.user?.email,
            userName: session?.user?.name,
            report,
            reportFileName,
            importedFileCount: importedFiles.length,
            rowCount: rows.length,
            pdfFiles: [{
              fileName: pdf.name,
              data: pdf.data,
            }],
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

      return withVolumeCors(new NextResponse(new Uint8Array(pdf.data) as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdf.name}"`,
        },
      }), request);
    }

    const zipFiles = [
      ...pdfResults.map((r) => ({ name: r.name, data: r.data })),
      { name: reportFileName, data: report },
    ];

    const zipBytes = await generateZip(zipFiles);
    const zipFileName = generateZipFileName(metadata);

    if (projectId) {
      const session = await auth();

      try {
        await persistVolumeBuildArtifacts({
          projectId,
          userEmail: session?.user?.email,
          userName: session?.user?.name,
          report,
          reportFileName,
          importedFileCount: importedFiles.length,
          rowCount: rows.length,
          pdfFiles: pdfResults.map((pdf) => ({
            fileName: pdf.name,
            data: pdf.data,
          })),
          zip: {
            fileName: zipFileName,
            data: zipBytes,
          },
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

    return withVolumeCors(new NextResponse(new Uint8Array(zipBytes) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
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
