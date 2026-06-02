import type { AssemblyRow, AssemblyBlock, AssemblySlot } from "./volume-types";

let rowCounter = 0;
let blockCounter = 0;
let slotCounter = 0;

export function createEmptyRow(order: number): AssemblyRow {
  rowCounter++;
  return {
    id: `row-${Date.now()}-${rowCounter}`,
    order,
    title: `Linha ${String(order).padStart(2, "0")}`,
    blocks: [],
    outputFileName: "",
    status: "sem_problemas",
    warnings: [],
    requiresManualConfirmation: false,
  };
}

export function createEmptyBlock(index: number): AssemblyBlock {
  blockCounter++;
  return {
    id: `block-${Date.now()}-${blockCounter}`,
    title: `Grupo ${index}`,
    disciplineCode: "",
    separatorTitle: `GRUPO ${index}`,
    documents: [],
    status: "sem_problemas",
    warnings: [],
  };
}

export function createEmptySlot(
  type: AssemblySlot["type"],
  label: string
): AssemblySlot {
  slotCounter++;
  return {
    id: `slot-${Date.now()}-${slotCounter}`,
    type,
    label,
    warnings: [],
  };
}

export function duplicateRow(row: AssemblyRow, newOrder: number): AssemblyRow {
  rowCounter++;
  return {
    ...row,
    id: `row-${Date.now()}-${rowCounter}`,
    order: newOrder,
    title: `${row.title} (copia)`,
    blocks: row.blocks.map((block) => duplicateBlock(block)),
  };
}

export function duplicateBlock(block: AssemblyBlock): AssemblyBlock {
  blockCounter++;
  return {
    ...block,
    id: `block-${Date.now()}-${blockCounter}`,
    documents: block.documents.map((doc) => duplicateSlot(doc)),
    separator: block.separator ? duplicateSlot(block.separator) : undefined,
    ld: block.ld ? duplicateSlot(block.ld) : undefined,
    appendices: block.appendices?.map((a) => duplicateSlot(a)),
  };
}

export function duplicateSlot(slot: AssemblySlot): AssemblySlot {
  slotCounter++;
  return {
    ...slot,
    id: `slot-${Date.now()}-${slotCounter}`,
  };
}

import type { PageSelection } from "./volume-types";
import { extractPages, extractPageRange } from "@/modules/volume-builder/lib/pdf/extract-pages";
import { mergePdfs } from "@/modules/volume-builder/lib/pdf/merge-pdfs";
import { generateSeparatorPdf } from "@/modules/volume-builder/lib/pdf/generate-separator";

export async function buildRowPdf(
  row: AssemblyRow,
  fileBuffers: Map<string, ArrayBuffer>
): Promise<Uint8Array> {
  const pdfParts: Uint8Array[] = [];

  if (row.cover?.selection) {
    const coverPdf = await extractSelection(row.cover.selection, fileBuffers);
    pdfParts.push(coverPdf);
  }

  for (const block of row.blocks) {
    const separatorPdf = block.separator?.selection
      ? await extractSelection(block.separator.selection, fileBuffers)
      : await generateSeparatorPdf({
          title: block.separatorTitle || block.title,
        });
    pdfParts.push(separatorPdf);

    if (block.ld?.selection) {
      const ldPdf = await extractSelection(block.ld.selection, fileBuffers);
      pdfParts.push(ldPdf);
    }

    for (const doc of block.documents) {
      if (doc.selection) {
        const docPdf = await extractSelection(doc.selection, fileBuffers);
        pdfParts.push(docPdf);
      }
    }

    if (block.appendices) {
      for (const appendix of block.appendices) {
        if (appendix.selection) {
          const appendixPdf = await extractSelection(
            appendix.selection,
            fileBuffers
          );
          pdfParts.push(appendixPdf);
        }
      }
    }
  }

  if (pdfParts.length === 0) {
    throw new Error(`Linha "${row.title}" nao tem conteudo para gerar PDF.`);
  }

  return await mergePdfs(pdfParts);
}

async function extractSelection(
  selection: PageSelection,
  fileBuffers: Map<string, ArrayBuffer>
): Promise<Uint8Array> {
  const pdfBuffer = fileBuffers.get(selection.sourceFileId);
  if (!pdfBuffer) {
    throw new Error(`Arquivo "${selection.sourceFileName}" nao encontrado.`);
  }

  if (selection.mode === "entire_file") {
    return new Uint8Array(pdfBuffer);
  }

  if (selection.mode === "page_range") {
    if (
      selection.startPage !== undefined &&
      selection.endPage !== undefined
    ) {
      return await extractPageRange(
        pdfBuffer,
        selection.startPage,
        selection.endPage
      );
    }
  }

  if (selection.mode === "specific_pages" && selection.pages) {
    return await extractPages(pdfBuffer, selection.pages);
  }

  throw new Error(`Selecao invalida para "${selection.sourceFileName}".`);
}
