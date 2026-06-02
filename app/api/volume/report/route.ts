import { NextRequest, NextResponse } from "next/server";
import type { AssemblyRow, VolumeMetadata, ImportedPdfFile } from "@/modules/volume-builder/lib/volume/volume-types";
import { generateMarkdownReport } from "@/modules/volume-builder/lib/pdf/generate-markdown-report";
import { generateReportFileName } from "@/modules/volume-builder/lib/volume/volume-naming";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { rows, metadata, importedFiles } = body as {
      rows: AssemblyRow[];
      metadata: VolumeMetadata;
      importedFiles: ImportedPdfFile[];
    };

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma linha de montagem fornecida." },
        { status: 400 }
      );
    }

    const report = generateMarkdownReport({
      metadata: metadata || { projectCode: "", projectName: "" },
      importedFiles: importedFiles || [],
      rows,
      generatedAt: new Date(),
    });

    const reportFileName = generateReportFileName(metadata || { projectCode: "", projectName: "" });

    return new NextResponse(report, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFileName}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
