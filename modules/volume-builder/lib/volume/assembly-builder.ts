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
import { generateSeparatorPdf } from "@/modules/volume-builder/lib/pdf/generate-separator";
import { PDFDocument } from "pdf-lib";

export async function buildRowPdf(
  row: AssemblyRow,
  fileBuffers: Map<string, ArrayBuffer>
): Promise<Uint8Array> {
  const outputDoc = await PDFDocument.create();
  const sourceDocs = new Map<string, PDFDocument>();
  let pageCount = 0;

  if (row.cover?.selection) {
    pageCount += await appendSelection(outputDoc, sourceDocs, row.cover.selection, fileBuffers);
  }

  for (const block of row.blocks) {
    if (block.separator?.selection) {
      pageCount += await appendSelection(outputDoc, sourceDocs, block.separator.selection, fileBuffers);
    } else {
      pageCount += await appendPdfBytes(
        outputDoc,
        await generateSeparatorPdf({
          title: block.separatorTitle || block.title,
        })
      );
    }

    if (block.ld?.selection) {
      pageCount += await appendSelection(outputDoc, sourceDocs, block.ld.selection, fileBuffers);
    }

    for (const doc of block.documents) {
      if (doc.selection) {
        pageCount += await appendSelection(outputDoc, sourceDocs, doc.selection, fileBuffers);
      }
    }

    if (block.appendices) {
      for (const appendix of block.appendices) {
        if (appendix.selection) {
          pageCount += await appendSelection(outputDoc, sourceDocs, appendix.selection, fileBuffers);
        }
      }
    }
  }

  if (pageCount === 0) {
    throw new Error(`Linha "${row.title}" nao tem conteudo para gerar PDF.`);
  }

  return await outputDoc.save();
}

async function appendSelection(
  outputDoc: PDFDocument,
  sourceDocs: Map<string, PDFDocument>,
  selection: PageSelection,
  fileBuffers: Map<string, ArrayBuffer>
): Promise<number> {
  const pdfBuffer = fileBuffers.get(selection.sourceFileId);
  if (!pdfBuffer) {
    throw new Error(`Arquivo "${selection.sourceFileName}" nao encontrado.`);
  }

  let sourceDoc = sourceDocs.get(selection.sourceFileId);
  if (!sourceDoc) {
    sourceDoc = await PDFDocument.load(pdfBuffer);
    sourceDocs.set(selection.sourceFileId, sourceDoc);
  }

  const totalPages = sourceDoc.getPageCount();
  let pages: number[] = [];

  if (selection.mode === "entire_file") {
    pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  } else if (
    selection.mode === "page_range" &&
    selection.startPage !== undefined &&
    selection.endPage !== undefined
  ) {
    for (let page = selection.startPage; page <= selection.endPage; page++) {
      pages.push(page);
    }
  } else if (selection.mode === "specific_pages" && selection.pages) {
    pages = selection.pages;
  }

  const validPages = pages.filter((page) => page >= 1 && page <= totalPages);
  if (validPages.length === 0) {
    throw new Error(
      `Nenhuma pagina valida em "${selection.sourceFileName}". PDF tem ${totalPages} pagina(s).`
    );
  }

  const copiedPages = await outputDoc.copyPages(
    sourceDoc,
    validPages.map((page) => page - 1)
  );

  for (const page of copiedPages) {
    outputDoc.addPage(page);
  }

  return copiedPages.length;
}

async function appendPdfBytes(outputDoc: PDFDocument, pdfBytes: Uint8Array) {
  const sourceDoc = await PDFDocument.load(pdfBytes);
  const copiedPages = await outputDoc.copyPages(
    sourceDoc,
    Array.from({ length: sourceDoc.getPageCount() }, (_, index) => index)
  );

  for (const page of copiedPages) {
    outputDoc.addPage(page);
  }

  return copiedPages.length;
}
