/**
 * Roda a EXTRAÇÃO REAL do PDF (pdfjs) + os motores determinísticos de identidade
 * sobre um arquivo real, sem chamar IA. Prova que os achados de identidade
 * sobrevivem à extração de texto do pdfjs (encoding, hifenização, quebras).
 *
 * Uso:
 *   node scripts/audit-real-pdf.ts "C:\\caminho\\para\\arquivo.pdf"
 */
import { readFile } from "node:fs/promises";

import { extractPdfText } from "../lib/pdf-text.ts";
import {
  runWithinDocumentIdentityRules,
  runCrossDocumentRules,
} from "../lib/cross-document-audit.ts";

const path = process.argv[2];

if (!path) {
  console.error('Informe o caminho do PDF: node scripts/audit-real-pdf.ts "<arquivo.pdf>"');
  process.exit(1);
}

const buffer = await readFile(path);
const extracted = await extractPdfText(buffer);

console.log(`Arquivo: ${path}`);
console.log(`Páginas: ${extracted.pageCount} | Caracteres extraídos: ${extracted.charCount}\n`);

const source = {
  fileName: path.split(/[\\/]/).pop() ?? "arquivo.pdf",
  fileType: "memorial",
  extracted,
};

const within = runWithinDocumentIdentityRules(source);
const cross = runCrossDocumentRules([source]); // 1 arquivo → só valida o caminho

console.log(`=== Identidade divergente no mesmo documento: ${within.length} achado(s) ===\n`);
for (const f of within) {
  console.log(`[${f.prioridade}] ${f.tipo}`);
  console.log(`  Página: ${f.pagina}`);
  console.log(`  Achado: ${f.conflito}`);
  console.log(`  Evidência: ${f.evidencia}`);
  console.log(`  Ação: ${f.sugestao_correcao}\n`);
}

console.log(`=== Comparação entre documentos (regra): ${cross.findings.length} achado(s) ===`);
for (const c of cross.comparisons) {
  console.log(`  · ${c}`);
}
