import { PDFDocument } from "pdf-lib";

export async function countPages(pdfBuffer: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(pdfBuffer);
  return doc.getPageCount();
}
