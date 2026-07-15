import { readFile } from "node:fs/promises";
import { extractPdfText } from "../lib/pdf-text.ts";
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";

const path = process.argv[2];
if (!path) {
  console.error('Uso: node scripts/coherence-real-pdf.ts "<arquivo.pdf>"');
  process.exit(1);
}

const extracted = await extractPdfText(await readFile(path));
const findings = runDocumentCoherenceRules({
  fileName: path.split(/[\\/]/).pop() ?? "arquivo.pdf",
  fileType: "memorial",
  extracted,
});

console.log(`=== Coerência documental: ${findings.length} achado(s) ===\n`);
for (const f of findings) {
  console.log(`[${f.prioridade}] ${f.tipo}  (pág. ${f.pagina})`);
  console.log(`  ${f.descricao}`);
  console.log(`  Evidência: ${f.evidencia}\n`);
}
