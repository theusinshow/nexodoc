import JSZip from "jszip";

export interface ZipFile {
  name: string;
  data: Uint8Array | string;
}

export async function generateZip(files: ZipFile[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error("Nenhum arquivo para adicionar ao ZIP.");
  }

  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.data);
  }

  const zipBlob = await zip.generateAsync({ type: "uint8array" });
  return zipBlob;
}
