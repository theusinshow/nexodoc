/**
 * Confere o kit gerado por scripts/gera-memoriais-defeituosos.mjs rodando os
 * motores DETERMINÍSTICOS reais (identidade + coerência + cross-document) sobre
 * os PDFs. Não chama IA e não gasta token: serve só para provar que os erros
 * plantados chegam até as regras depois da extração do pdfjs.
 *
 * Uso: node scripts/confere-memoriais-defeituosos.ts
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { extractPdfText } from "../lib/pdf-text.ts";
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";
import {
  runWithinDocumentIdentityRules,
  runCrossDocumentRules,
} from "../lib/cross-document-audit.ts";

const pasta = path.resolve(process.cwd(), "docs/samples/_auditoria-teste");
const nomes = (await readdir(pasta)).filter((n) => n.toLowerCase().endsWith(".pdf")).sort();

const fontes = new Map<string, Awaited<ReturnType<typeof extractPdfText>>>();

for (const nome of nomes) {
  const extracted = await extractPdfText(await readFile(path.join(pasta, nome)));
  fontes.set(nome, extracted);

  const source = { fileName: nome, fileType: "memorial", extracted };
  const identidade = runWithinDocumentIdentityRules(source);
  const coerencia = runDocumentCoherenceRules(source);
  const capa = extracted.pages[0]?.text ?? "";

  console.log(`\n=== ${nome} — ${extracted.pageCount} pág., ${extracted.charCount} chars`);
  console.log(`    capa (pág. 1): ${capa.length} chars${capa.length < 80 ? "  <- dispara GUARDA-CAPA-LEITURA" : ""}`);

  for (const f of [...identidade, ...coerencia]) {
    console.log(`    [${f.id}] ${f.prioridade.padEnd(10)} ${f.tipo}`);
    console.log(`             pág. ${f.pagina} · ${f.conflito}`);
  }
  if (identidade.length + coerencia.length === 0) {
    console.log("    (nenhum achado determinístico)");
  }
}

/* par capa x memorial */
const par = ["04-par-capa.pdf", "05-par-memorial.pdf"].filter((n) => fontes.has(n));
if (par.length === 2) {
  const cross = runCrossDocumentRules([
    { fileName: par[0], fileType: "capa", extracted: fontes.get(par[0])! },
    { fileName: par[1], fileType: "memorial", extracted: fontes.get(par[1])! },
  ]);
  console.log(`\n=== ${par.join(" x ")} — ${cross.findings.length} achado(s) cross-document`);
  for (const f of cross.findings) {
    console.log(`    [${f.id}] ${f.prioridade.padEnd(10)} ${f.tipo}`);
    console.log(`             ${f.conflito}`);
  }
}
