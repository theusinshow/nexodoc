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
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";

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

/*
 * COERÊNCIA TAMBÉM, E AS TABELAS.
 *
 * O script parava na identidade, e era metade do retrato: as regras de
 * coerência (hierarquia, área declarada, remissão, parágrafo duplicado, não
 * conformidade declarada, títulos irmãos) são a maior parte da camada de custo
 * zero. Sem elas não dá para responder "quanto o determinístico já cobre?"
 * antes de gastar token — que é a pergunta que decide se vale pagar a corrida.
 *
 * A contagem de tabelas fica junto de propósito: elas são o insumo das regras
 * numéricas, e uma extração que devolve zero tabela explica sozinha um recall
 * numérico zerado. Melhor ver as duas coisas na mesma tela.
 */
const coerencia = runDocumentCoherenceRules(source);
const comTabela = extracted.pages.filter((p) => (p.tabelas?.length ?? 0) > 0);
const totalTabelas = comTabela.reduce((n, p) => n + (p.tabelas?.length ?? 0), 0);

console.log(
  `\n=== Tabelas reconstruídas: ${totalTabelas} em ${comTabela.length} página(s) ===`,
);

console.log(`\n=== Coerência do documento: ${coerencia.length} achado(s) ===\n`);
for (const f of coerencia) {
  console.log(`[${f.prioridade}] ${f.tipo}`);
  console.log(`  Página: ${f.pagina}`);
  if (f.conflito) console.log(`  Achado: ${f.conflito}`);
  if (f.evidencia) console.log(`  Evidência: ${String(f.evidencia).slice(0, 220)}`);
  console.log();
}

console.log(
  `TOTAL DETERMINÍSTICO (custo zero): ${within.length + coerencia.length} achado(s)`,
);
