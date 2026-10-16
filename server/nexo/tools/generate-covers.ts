import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { persistCoverGenerationArtifacts } from "@/lib/cover-artifacts";
import { generateOdtBuffer } from "@/server/odt";
import { convertOdtToPdf } from "@/server/pdf";
import { semPaginasEmBranco } from "./pagina-em-branco";
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
  /**
   * Marcadores que o modelo tem e o Nexo não conhece, preenchidos à mão no
   * frame do documento. Sem este repasse, um `{{RESPONSAVEL}}` acrescentado ao
   * ODT sairia literal na capa.
   */
  extras?: Record<string, string>;
  /** Bytes do modelo de capa do projeto (cofre). Vence o `templateId`. */
  templateBytes?: Buffer;
  /**
   * Páginas físicas de UMA capa no modelo (2 com contracapa). É a régua do
   * aviso de transbordo. Ausente = 1.
   */
  paginasPorCapa?: number;
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
  /**
   * Páginas que o PDF tem A MAIS do que as capas pedidas ocupariam — o modelo
   * transbordou (16/10/2026). Antes, uma capa de 2 páginas entrava no volume
   * calada: Chapecó e Criciúma já fizeram isso. 0 quando bate ou sem PDF.
   */
  paginasAMais: number;
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
    ...(input.extras ? { extras: input.extras } : {}),
    ...(input.templateBytes ? { templateBytes: input.templateBytes } : {}),
  });

  let pdfBuffer: Buffer | null = null;
  let pdfError: string | undefined;

  if (input.includePdf !== false) {
    const result = await convertOdtToPdf(odtBuffer);
    // Obra longa enche a folha e o parágrafo obrigatório do fim do modelo cai
    // numa página nova, vazia — ver `pagina-em-branco.ts`.
    pdfBuffer = result.pdfBuffer ? (await semPaginasEmBranco(result.pdfBuffer).catch(() => ({ buffer: result.pdfBuffer! }))).buffer : null;
    pdfError = result.error;
  }

  let paginasAMais = 0;
  if (pdfBuffer) {
    const esperadas = pages.length * Math.max(1, input.paginasPorCapa ?? 1);
    const paginas = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true, updateMetadata: false })
      .then((d) => d.getPageCount())
      .catch(() => esperadas);
    paginasAMais = Math.max(0, paginas - esperadas);
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
    paginasAMais,
  };
}
