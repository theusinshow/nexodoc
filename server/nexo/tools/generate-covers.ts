import JSZip from "jszip";

import { persistCoverGenerationArtifacts } from "@/lib/cover-artifacts";
import { generateOdtBuffer } from "@/server/odt";
import { convertOdtToPdf } from "@/server/pdf";
import { getFileName } from "@/lib/cover-utils";
import type { GeneralData, CoverPage } from "@/modules/cover-generator/types";

/**
 * Ferramenta headless do Nexo (Fase 0): gera as capas dos volumes (ODT +
 * opcionalmente PDF, empacotados em ZIP) sem passar por HTTP. O agente de
 * orquestracao chama esta funcao diretamente e recebe Buffers crus — base64 e
 * responsabilidade da camada HTTP, nao desta. Espelha o fluxo de
 * app/api/capas/generate/route.ts, mas a autenticacao vem pronta do chamador
 * (userEmail/userName explicitos) — nunca chamamos auth() aqui.
 */

export interface GenerateCoversInput {
  generalData: GeneralData;
  pages: CoverPage[];
  includePdf?: boolean;
  persist?: { projectId: string; userEmail: string; userName?: string | null };
}

export interface GeneratedFile {
  name: string;
  buffer: Buffer;
}

export interface GenerateCoversOutput {
  odt: GeneratedFile;
  pdf: GeneratedFile | null;
  zip: GeneratedFile;
  pdfError?: string;
  persisted: boolean;
}

export async function generateCovers(
  input: GenerateCoversInput
): Promise<GenerateCoversOutput> {
  const { generalData, pages } = input;

  if (!generalData || typeof generalData !== "object") {
    throw new Error("Dados gerais obrigatorios (generalData).");
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("Lista de paginas obrigatoria (pages).");
  }

  if (pages.length > 500) {
    throw new Error("Limite de 500 paginas excedido.");
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

  let persisted = false;

  if (input.persist) {
    await persistCoverGenerationArtifacts({
      projectId: input.persist.projectId,
      userEmail: input.persist.userEmail,
      userName: input.persist.userName ?? null,
      generalData,
      pageCount: pages.length,
      odt: {
        fileName: odtFileName,
        buffer: odtBuffer,
      },
      pdf: pdfBuffer
        ? {
            fileName: pdfFileName,
            buffer: pdfBuffer,
          }
        : null,
      zip: {
        fileName: zipFileName,
        buffer: zipBuffer,
      },
    });
    persisted = true;
  }

  return {
    odt: { name: odtFileName, buffer: odtBuffer },
    pdf: pdfBuffer ? { name: pdfFileName, buffer: pdfBuffer } : null,
    zip: { name: zipFileName, buffer: zipBuffer },
    pdfError: pdfError || undefined,
    persisted,
  };
}
