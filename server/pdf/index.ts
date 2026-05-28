import { execFile } from "child_process";
import { join } from "path";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export interface ConvertToPdfResult {
  pdfBuffer: Buffer | null;
  error?: string;
}

const CONVERTER_URL = process.env.DOCUMENT_CONVERTER_URL?.trim();

export async function convertOdtToPdf(odtBuffer: Buffer): Promise<ConvertToPdfResult> {
  if (CONVERTER_URL) {
    return convertViaRender(odtBuffer);
  }

  if (process.env.LIBREOFFICE_PATH) {
    return convertViaLocal(odtBuffer);
  }

  return {
    pdfBuffer: null,
    error:
      "PDF indisponivel. Configure DOCUMENT_CONVERTER_URL (Render) ou LIBREOFFICE_PATH (local) para habilitar a conversao.",
  };
}

async function convertViaRender(odtBuffer: Buffer): Promise<ConvertToPdfResult> {
  try {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(odtBuffer)], { type: "application/vnd.oasis.opendocument.text" }), "document.odt");

    const response = await fetch(CONVERTER_URL!, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errPayload = await response.json().catch(() => null);
      throw new Error(errPayload?.error || `Render retornou status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      return { pdfBuffer: null, error: "Render retornou PDF vazio." };
    }

    return { pdfBuffer: Buffer.from(arrayBuffer) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { pdfBuffer: null, error: `Falha na conversao via Render (${CONVERTER_URL}): ${message}` };
  }
}

async function convertViaLocal(odtBuffer: Buffer): Promise<ConvertToPdfResult> {
  const tmpDir = join(tmpdir(), `nexodoc-pdf-${randomUUID()}`);
  const odtPath = join(tmpDir, "document.odt");
  const pdfPath = join(tmpDir, "document.pdf");

  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(odtPath, odtBuffer);

    await execLibreOffice(process.env.LIBREOFFICE_PATH!, tmpDir);

    const pdfBuffer = await readFile(pdfPath);

    if (pdfBuffer.length === 0) {
      return { pdfBuffer: null, error: "LibreOffice gerou PDF vazio." };
    }

    return { pdfBuffer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { pdfBuffer: null, error: `Falha na conversao local: ${message}` };
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* cleanup non-critical */ }
  }
}

function execLibreOffice(binaryPath: string, workDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      binaryPath,
      ["--headless", "--convert-to", "pdf", "--outdir", workDir, join(workDir, "document.odt")],
      { timeout: 30000 },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}
