import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { removerVaziosAntesDoTitulo, repetirBlocoDoTitulo } from "./separatriz-content";

/**
 * Preenche o TEMPLATE ODT oficial da separatriz (`templates/separatriz/
 * modelo-separatriz.odt`) — uma página limpa com o nome da disciplina em negrito,
 * maiúsculas, no canto inferior-direito (~55%), no padrão do escritório. Troca o
 * marcador {{TITULO}} pelo nome da disciplina. Devolve o ODT (Buffer); a conversão
 * p/ PDF é da camada chamadora (convertOdtToPdf).
 *
 * Usar o ODT oficial (em vez de gerar em código) garante fonte/posição/estilo
 * idênticos ao volume real. É por isso que o Nexo NÃO usa o
 * `generateSeparatorOdtBuffer` do módulo standalone, que monta o ODT em código:
 * o template é o documento do escritório, o outro é uma aproximação.
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

/**
 * Gera o ODT das separatrizes a partir do template oficial: UMA FOLHA POR
 * DISCIPLINA, na ordem recebida. O volume real tem várias (elétrica, CFTV,
 * SPDA...), e era só isso que faltava ao Nexo para dispensar a tela
 * `/separatrizes`.
 */
export async function buildSeparatrizOdt(titles: string[]): Promise<Buffer> {
  const clean = titles
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
  if (clean.length === 0) {
    throw new Error("Informe o nome da disciplina da separatriz.");
  }
  if (clean.length > 200) {
    throw new Error("Limite de 200 separatrizes excedido.");
  }

  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const contentFile = zip.file("content.xml");
  if (!contentFile) throw new Error("Template de separatriz sem content.xml.");

  const content = await contentFile.async("string");
  // Tira o parágrafo vazio que o template traz antes do título — ele virava uma
  // página em branco no volume (ver separatriz-content.ts).
  const enxuto = removerVaziosAntesDoTitulo(content);
  const filled = repetirBlocoDoTitulo(enxuto, clean.map(escapeXml));
  zip.file("content.xml", filled);

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.from(out);
}
