import { NextRequest, NextResponse } from "next/server";
import { generateOdtBuffer } from "@/server/odt";
import { convertOdtToPdf } from "@/server/pdf";
import { createZipBuffer } from "@/server/zip";
import { getFileName } from "@/lib/cover-utils";
import type { GeneralData, CoverPage } from "@/modules/cover-generator/types";

interface GenerateRequest {
  generalData: GeneralData;
  pages: CoverPage[];
  outputFormat?: "odt" | "pdf" | "zip";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateRequest;
    const { generalData, pages, outputFormat = "zip" } = body;

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

    if (!["odt", "pdf", "zip"].includes(outputFormat)) {
      return NextResponse.json(
        { error: "Formato invalido. Use odt, pdf ou zip." },
        { status: 400 }
      );
    }

    const odtBuffer = await generateOdtBuffer({
      templateId: generalData.templateId,
      generalData,
      pages,
    });

    const sigla = generalData.siglaArquivo || "";
    const revisao = generalData.revisao || "r";
    const codigoInterno = generalData.codigoInterno || "codigo";

    const odtFileName = getFileName(codigoInterno, sigla, revisao, "odt");
    const pdfFileName = getFileName(codigoInterno, sigla, revisao, "pdf");

    if (outputFormat === "odt") {
      const resp = new NextResponse(new Uint8Array(odtBuffer), {
        status: 200,
      });
      resp.headers.set(
        "Content-Type",
        "application/vnd.oasis.opendocument.text"
      );
      resp.headers.set(
        "Content-Disposition",
        `attachment; filename="${odtFileName}"`
      );
      return resp;
    }

    const { pdfBuffer, error: pdfError } = await convertOdtToPdf(odtBuffer);

    if (outputFormat === "pdf") {
      if (!pdfBuffer) {
        return NextResponse.json(
          { error: pdfError || "PDF nao disponivel" },
          { status: 503 }
        );
      }

      const resp = new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
      });
      resp.headers.set("Content-Type", "application/pdf");
      resp.headers.set(
        "Content-Disposition",
        `attachment; filename="${pdfFileName}"`
      );
      return resp;
    }

    if (pdfBuffer) {
      const zipFileName = getFileName(codigoInterno, sigla, revisao, "zip");
      const zipBuffer = await createZipBuffer(
        odtBuffer,
        pdfBuffer,
        odtFileName,
        pdfFileName
      );

      const resp = new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
      });
      resp.headers.set("Content-Type", "application/zip");
      resp.headers.set(
        "Content-Disposition",
        `attachment; filename="${zipFileName}"`
      );
      return resp;
    }

    const resp = new NextResponse(new Uint8Array(odtBuffer), {
      status: 200,
    });
    resp.headers.set(
      "Content-Type",
      "application/vnd.oasis.opendocument.text"
    );
    resp.headers.set(
      "Content-Disposition",
      `attachment; filename="${odtFileName}"`
    );
    resp.headers.set("X-PDF-Error", pdfError || "PDF nao disponivel");
    return resp;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
