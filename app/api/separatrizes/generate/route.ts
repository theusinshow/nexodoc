import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

import { generateSeparatorOdtBuffer } from "@/server/odt/separator";
import { convertOdtToPdf } from "@/server/pdf";

interface GenerateRequest {
  titles: string[];
  codigo?: string;
  revisao?: string;
}

function buildFileName(codigo: string, revisao: string, ext: string): string {
  return (
    [codigo.trim(), "separatrizes", revisao.trim()]
      .filter((part) => part)
      .join("_") + `.${ext}`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const titles = Array.isArray(body.titles)
      ? body.titles.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
      : [];

    if (titles.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos uma disciplina (titles)." },
        { status: 400 }
      );
    }

    if (titles.length > 200) {
      return NextResponse.json(
        { error: "Limite de 200 separatrizes excedido." },
        { status: 400 }
      );
    }

    const codigo = body.codigo?.trim() || "";
    const revisao = body.revisao?.trim() || "r";

    const odtFileName = buildFileName(codigo, revisao, "odt");
    const pdfFileName = buildFileName(codigo, revisao, "pdf");
    const zipFileName = buildFileName(codigo, revisao, "zip");

    const odtBuffer = await generateSeparatorOdtBuffer(titles);
    const { pdfBuffer, error: pdfError } = await convertOdtToPdf(odtBuffer);

    const zip = new JSZip();
    zip.file(odtFileName, odtBuffer);
    if (pdfBuffer) zip.file(pdfFileName, pdfBuffer);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return NextResponse.json({
      files: {
        odt: { name: odtFileName, data: Buffer.from(odtBuffer).toString("base64") },
        pdf: pdfBuffer
          ? { name: pdfFileName, data: Buffer.from(pdfBuffer).toString("base64") }
          : null,
        zip: { name: zipFileName, data: Buffer.from(zipBuffer).toString("base64") },
      },
      pdfError: pdfError || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
