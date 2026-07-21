import JSZip from "jszip";

import { generateSeparatorOdtBuffer } from "@/server/odt/separator";
import { convertOdtToPdf } from "@/server/pdf";

/**
 * Ferramenta headless do Nexo (Fase 0): gera as "folhas separatrizes" (ODT +
 * opcionalmente PDF, empacotados em ZIP) sem passar por HTTP. O agente de
 * orquestracao chama esta funcao diretamente e recebe Buffers crus — base64 e
 * responsabilidade da camada HTTP, nao desta. Espelha o fluxo de
 * app/api/separatrizes/generate/route.ts.
 */

export interface GenerateSeparatrizesInput {
  titles: string[];
  codigo?: string;
  revisao?: string;
  includePdf?: boolean;
}

export interface GeneratedFile {
  name: string;
  buffer: Buffer;
}

export interface GenerateSeparatrizesOutput {
  odt: GeneratedFile;
  pdf: GeneratedFile | null;
  zip: GeneratedFile;
  pdfError?: string;
}

function buildFileName(codigo: string, revisao: string, ext: string): string {
  return (
    [codigo.trim(), "separatrizes", revisao.trim()]
      .filter((part) => part)
      .join("_") + `.${ext}`
  );
}

export async function generateSeparatrizes(
  input: GenerateSeparatrizesInput
): Promise<GenerateSeparatrizesOutput> {
  const titles = Array.isArray(input.titles)
    ? input.titles
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
    : [];

  if (titles.length === 0) {
    throw new Error("Informe ao menos uma disciplina (titles).");
  }

  if (titles.length > 200) {
    throw new Error("Limite de 200 separatrizes excedido.");
  }

  const codigo = input.codigo?.trim() || "";
  const revisao = input.revisao?.trim() || "r";

  const odtFileName = buildFileName(codigo, revisao, "odt");
  const pdfFileName = buildFileName(codigo, revisao, "pdf");
  const zipFileName = buildFileName(codigo, revisao, "zip");

  const odtBuffer = await generateSeparatorOdtBuffer(titles);

  let pdfBuffer: Buffer | null = null;
  let pdfError: string | undefined;

  if (input.includePdf !== false) {
    const result = await convertOdtToPdf(odtBuffer);
    pdfBuffer = result.pdfBuffer;
    pdfError = result.error;
  }

  const zip = new JSZip();
  zip.file(odtFileName, odtBuffer);
  if (pdfBuffer) zip.file(pdfFileName, pdfBuffer);
  const zipBuffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

  return {
    odt: { name: odtFileName, buffer: odtBuffer },
    pdf: pdfBuffer ? { name: pdfFileName, buffer: pdfBuffer } : null,
    zip: { name: zipFileName, buffer: zipBuffer },
    pdfError: pdfError || undefined,
  };
}
