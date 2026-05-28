import JSZip from "jszip";

export async function createZipBuffer(
  odtBuffer: Buffer,
  pdfBuffer: Buffer | null,
  odtFileName: string,
  pdfFileName: string
): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(odtFileName, odtBuffer);

  if (pdfBuffer) {
    zip.file(pdfFileName, pdfBuffer);
  }

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return Buffer.from(arrayBuffer);
}
