import JSZip from "jszip";
import { auth } from "@/auth";
import {
  buildBaseFileName,
  buildInconsistencyReport,
  buildOdtFileName,
  generateOdtBuffer,
  type GeneratePayload,
} from "@/lib/ld/ld-generation";
import { convertOdtToPdf } from "@/server/pdf";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const payload = (await request.json()) as GeneratePayload;

  if (!payload.ldData || !Array.isArray(payload.rows)) {
    return NextResponse.json({ error: "Dados da LD inválidos." }, { status: 400 });
  }

  try {
    const baseName = buildBaseFileName(payload.ldData);
    const odtFileName = buildOdtFileName(payload.ldData);
    const pdfFileName = `${baseName}.pdf`;
    const reportFileName = `${baseName}_inconsistencias.md`;
    const zipFileName = `${baseName}.zip`;

    const odtBuffer = await generateOdtBuffer(payload);
    const { pdfBuffer } = await convertOdtToPdf(odtBuffer);
    const report = buildInconsistencyReport(payload);

    const zip = new JSZip();
    zip.file(odtFileName, odtBuffer);
    if (pdfBuffer) zip.file(pdfFileName, pdfBuffer);
    if (report) zip.file(reportFileName, report);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return NextResponse.json({
      files: {
        odt: {
          name: odtFileName,
          data: odtBuffer.toString("base64"),
        },
        pdf: pdfBuffer
          ? {
              name: pdfFileName,
              data: pdfBuffer.toString("base64"),
            }
          : null,
        report: report
          ? {
              name: reportFileName,
              data: Buffer.from(report, "utf8").toString("base64"),
            }
          : null,
        zip: {
          name: zipFileName,
          data: zipBuffer.toString("base64"),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar os arquivos finais." },
      { status: 500 },
    );
  }
}
