import { PDFDocument } from "pdf-lib";

export async function mergePdfs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
  if (pdfBuffers.length === 0) {
    throw new Error("Nenhum PDF para fazer merge.");
  }

  if (pdfBuffers.length === 1) {
    return pdfBuffers[0];
  }

  const mergedDoc = await PDFDocument.create();

  for (const pdfBytes of pdfBuffers) {
    const sourceDoc = await PDFDocument.load(pdfBytes);
    const pageCount = sourceDoc.getPageCount();
    const pageIndexes = Array.from({ length: pageCount }, (_, i) => i);
    const copiedPages = await mergedDoc.copyPages(sourceDoc, pageIndexes);

    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  return await mergedDoc.save();
}
