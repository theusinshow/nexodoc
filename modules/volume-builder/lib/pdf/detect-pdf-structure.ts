export async function detectPdfStructure(_pdfBuffer: ArrayBuffer): Promise<{
  hasCover: boolean;
  hasLD: boolean;
  hasSeparator: boolean;
  pageCount: number;
}> {
  throw new Error("detectPdfStructure not implemented yet");
}
