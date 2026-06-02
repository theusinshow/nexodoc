import { PDFDocument } from "pdf-lib";

export async function extractPages(
  pdfBuffer: ArrayBuffer,
  pages: number[]
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error("Nenhuma pagina especificada.");
  }

  const sourceDoc = await PDFDocument.load(pdfBuffer);
  const newDoc = await PDFDocument.create();

  const totalPages = sourceDoc.getPageCount();

  const validPages = pages.filter((p) => p >= 1 && p <= totalPages);

  if (validPages.length === 0) {
    throw new Error(
      `Nenhuma pagina valida. PDF tem ${totalPages} pagina(s).`
    );
  }

  const pageIndexes = validPages.map((p) => p - 1);
  const copiedPages = await newDoc.copyPages(sourceDoc, pageIndexes);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save();
}

export async function extractPageRange(
  pdfBuffer: ArrayBuffer,
  startPage: number,
  endPage: number
): Promise<Uint8Array> {
  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  return extractPages(pdfBuffer, pages);
}
