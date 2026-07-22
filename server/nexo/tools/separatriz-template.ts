import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

/**
 * Preenche o TEMPLATE ODT oficial da separatriz (`templates/separatriz/
 * modelo-separatriz.odt`) — uma página limpa com o nome da disciplina em negrito,
 * maiúsculas, no canto inferior-direito (~55%), no padrão do escritório. Troca o
 * marcador {{TITULO}} pelo nome da disciplina. Devolve o ODT (Buffer); a conversão
 * p/ PDF é da camada chamadora (convertOdtToPdf).
 *
 * Usar o ODT oficial (em vez de gerar em código) garante fonte/posição/estilo
 * idênticos ao volume real.
 */

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "separatriz",
  "modelo-separatriz.odt",
);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Gera o ODT da separatriz de UMA disciplina a partir do template oficial. */
export async function buildSeparatrizOdt(title: string): Promise<Buffer> {
  const clean = title.trim();
  if (!clean) throw new Error("Informe o nome da disciplina da separatriz.");

  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const contentFile = zip.file("content.xml");
  if (!contentFile) throw new Error("Template de separatriz sem content.xml.");

  const content = await contentFile.async("string");
  const filled = content.replaceAll("{{TITULO}}", escapeXml(clean));
  zip.file("content.xml", filled);

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.from(out);
}
