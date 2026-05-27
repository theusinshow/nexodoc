import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { auth } from "@/auth";
import {
  buildBaseFileName,
  buildInconsistencyReport,
  buildOdtFileName,
  generateOdtBuffer,
  type GeneratePayload,
} from "@/lib/ld/ld-generation";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

function getLibreOfficeCandidates() {
  return [
    process.env.LIBREOFFICE_PATH,
    "soffice",
    "libreoffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ].filter((candidate): candidate is string => Boolean(candidate));
}

async function convertOdtToPdf(odtBuffer: Buffer, fileName: string) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "nexodoc-ld-"));
  const odtPath = path.join(workDir, fileName);
  const pdfPath = path.join(workDir, fileName.replace(/\.odt$/i, ".pdf"));
  let lastError = "";

  try {
    await writeFile(odtPath, odtBuffer);

    for (const candidate of getLibreOfficeCandidates()) {
      try {
        await execFileAsync(candidate, [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          workDir,
          odtPath,
        ]);

        return await readFile(pdfPath);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(
      `LibreOffice headless não encontrado ou não conseguiu converter o ODT. Configure LIBREOFFICE_PATH. Último erro: ${lastError}`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const payload = (await request.json()) as GeneratePayload;

  if (!payload.ldData || !Array.isArray(payload.rows)) {
    return NextResponse.json({ error: "Dados da LD inválidos." }, { status: 400 });
  }

  try {
    const baseName = buildBaseFileName(payload.ldData);
    const odtFileName = buildOdtFileName(payload.ldData);
    const pdfFileName = `${baseName}.pdf`;
    const reportFileName = `${baseName}_inconsistencias.md`;
    const zipFileName = `${baseName}.zip`;
    const odtBuffer = await generateOdtBuffer(payload);
    const pdfBuffer = await convertOdtToPdf(odtBuffer, odtFileName);
    const report = buildInconsistencyReport(payload);
    const zip = new JSZip();

    zip.file(odtFileName, odtBuffer);
    zip.file(pdfFileName, pdfBuffer);

    if (report) {
      zip.file(reportFileName, report);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return NextResponse.json({
      files: {
        odt: {
          name: odtFileName,
          data: odtBuffer.toString("base64"),
        },
        pdf: {
          name: pdfFileName,
          data: pdfBuffer.toString("base64"),
        },
        report: report
          ? {
              name: reportFileName,
              data: Buffer.from(report, "utf8").toString("base64"),
            }
          : null,
        zip: {
          name: zipFileName,
          data: zipBuffer.toString("base64"),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar os arquivos finais." },
      { status: 500 },
    );
  }
}
