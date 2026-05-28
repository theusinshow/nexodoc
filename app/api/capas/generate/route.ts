import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { generateOdtBuffer } from "@/server/odt";
import { convertOdtToPdf } from "@/server/pdf";
import { getFileName } from "@/lib/cover-utils";
import type { GeneralData, CoverPage } from "@/modules/cover-generator/types";

interface GenerateRequest {
  generalData: GeneralData;
  pages: CoverPage[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateRequest;
    const { generalData, pages } = body;

    if (!generalData || typeof generalData !== "object") {
      return NextResponse.json(
        { error: "Dados gerais obrigatorios (generalData)." },
        { status: 400 }
      );
    }

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: "Lista de paginas obrigatoria (pages)." },
        { status: 400 }
      );
    }

    if (pages.length > 500) {
      return NextResponse.json(
        { error: "Limite de 500 paginas excedido." },
        { status: 400 }
      );
    }

    const sigla = generalData.siglaArquivo || "";
    const revisao = generalData.revisao || "r";
    const codigoInterno = generalData.codigoInterno || "codigo";

    const odtFileName = getFileName(codigoInterno, sigla, revisao, "odt");
    const pdfFileName = getFileName(codigoInterno, sigla, revisao, "pdf");
    const zipFileName = getFileName(codigoInterno, sigla, revisao, "zip");

    const odtBuffer = await generateOdtBuffer({
      templateId: generalData.templateId,
      generalData,
      pages,
    });

    const { pdfBuffer, error: pdfError } = await convertOdtToPdf(odtBuffer);

    let zipData: string;

    if (pdfBuffer) {
      const zip = new JSZip();
      zip.file(odtFileName, odtBuffer);
      zip.file(pdfFileName, pdfBuffer);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      zipData = Buffer.from(zipBuffer).toString("base64");
    } else {
      const zip = new JSZip();
      zip.file(odtFileName, odtBuffer);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      zipData = Buffer.from(zipBuffer).toString("base64");
    }

    return NextResponse.json({
      files: {
        odt: {
          name: odtFileName,
          data: Buffer.from(odtBuffer).toString("base64"),
        },
        pdf: pdfBuffer
          ? {
              name: pdfFileName,
              data: Buffer.from(pdfBuffer).toString("base64"),
            }
          : null,
        zip: {
          name: zipFileName,
          data: zipData,
        },
      },
      pdfError: pdfError || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
