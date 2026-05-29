const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const { mkdtemp, writeFile, readFile, rm } = require("fs/promises");
const os = require("os");
const path = require("path");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();

app.get("/", (_req, res) => {
  res.json({ service: "nexodoc-converter", status: "ok" });
});

const LIBREOFFICE_BINARIES = ["soffice", "libreoffice"];

async function tryConvert(workDir, odtPath) {
  let lastError = "";

  for (const binary of LIBREOFFICE_BINARIES) {
    try {
      await execFileAsync(binary, [
        "--headless",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        odtPath,
      ], { timeout: 60000 });
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`LibreOffice falhou: ${lastError}`);
}

app.post("/convert", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado. Envie um ODT no campo 'file'." });
  }

  const originalName = req.file.originalname || "document.odt";
  const odtBuffer = req.file.buffer;
  const workDir = await mkdtemp(path.join(os.tmpdir(), "nexodoc-convert-"));
  const odtPath = path.join(workDir, originalName);
  const pdfName = originalName.replace(/\.odt$/i, ".pdf");
  const pdfPath = path.join(workDir, pdfName);

  try {
    await writeFile(odtPath, odtBuffer);
    await tryConvert(workDir, odtPath);

    const pdfBuffer = await readFile(pdfPath);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(500).json({ error: "PDF gerado esta vazio." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdfName}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Falha na conversao ODT para PDF: ${message}` });
  } finally {
    try { await rm(workDir, { recursive: true, force: true }); } catch { /* cleanup non-critical */ }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`nexodoc-converter running on port ${PORT}`);
});
