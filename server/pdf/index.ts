import { execFile } from "child_process";
import { join } from "path";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export interface ConvertToPdfResult {
  pdfBuffer: Buffer | null;
  error?: string;
}

export async function convertOdtToPdf(odtBuffer: Buffer): Promise<ConvertToPdfResult> {
  const tmpDir = join(/*turbopackIgnore: true*/ tmpdir(), `nexodoc-pdf-${randomUUID()}`);
  const odtPath = join(/*turbopackIgnore: true*/ tmpDir, "document.odt");
  const pdfPath = join(/*turbopackIgnore: true*/ tmpDir, "document.pdf");

  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(odtPath, odtBuffer);

    await execLibreOffice(tmpDir);

    try {
      const pdfBuffer = await readFile(pdfPath);
      return { pdfBuffer };
    } catch {
      return {
        pdfBuffer: null,
        error:
          "LibreOffice executado mas o PDF nao foi encontrado no caminho esperado.",
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      pdfBuffer: null,
      error: `Falha na conversao PDF. LibreOffice headless nao encontrado ou erro na execucao. Instale o LibreOffice para habilitar a conversao PDF. Detalhes: ${message}`,
    };
  } finally {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup failure is non-critical
    }
  }
}

function execLibreOffice(workDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const possiblePaths = [
      "libreoffice",
      "soffice",
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];

    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      join(/*turbopackIgnore: true*/ workDir, "document.odt"),
    ];

    function tryExec(index: number) {
      if (index >= possiblePaths.length) {
        reject(new Error("LibreOffice not found in any known path"));
        return;
      }

      execFile(possiblePaths[index], args, { timeout: 30000 }, (error) => {
        if (error) {
          tryExec(index + 1);
        } else {
          resolve();
        }
      });
    }

    tryExec(0);
  });
}
