/**
 * A EVIDÊNCIA EXISTE MESMO NO DOCUMENTO?
 *
 * O falso positivo mais grave que um auditor pode cometer não é errar o
 * julgamento — é citar um trecho que não está lá. Julgamento errado um
 * engenheiro refuta lendo a página; citação inventada destrói a confiança no
 * parecer inteiro, porque nenhuma das outras 56 linhas pode mais ser lida sem
 * conferência.
 *
 * Isto é mecânico e não precisa de engenheiro: pega a transcrição de cada
 * achado, procura na PÁGINA que ele declara, e diz quais não ancoram.
 *
 *   node scripts/prova-evidencia-ancorada.ts <parecer.json> <memorial.pdf>
 *
 * O casamento é tolerante de propósito — a extração do pdf.js reflui espaço,
 * hifeniza e às vezes perde acento, e cobrar igualdade literal reprovaria
 * evidência boa. Reprovar evidência boa faria este script mentir na direção
 * mais cara: acusar de invenção quem transcreveu certo.
 */
import { readFile } from "node:fs/promises";

import { extractPdfText } from "../lib/pdf-text.ts";

import {
  ancorarEvidencia,
  indexarParaAncoragem,
  type Veredito,
} from "../lib/ancoragem-de-evidencia.ts";


const [parecerPath, pdfPath] = process.argv.slice(2);
if (!parecerPath || !pdfPath) {
  console.error("Uso: node scripts/prova-evidencia-ancorada.ts <parecer.json> <memorial.pdf>");
  process.exit(1);
}


const parecer = JSON.parse(await readFile(parecerPath, "utf8"));
const report = parecer.report ?? parecer;
const achados = report.incongruencias ?? [];


const extracted = await extractPdfText(await readFile(pdfPath));
const indice = indexarParaAncoragem(extracted.pages);

if (indice.nInicio + indice.nFim > 0) {
  console.log(
    `(carimbo de página detectado: ${indice.nInicio} chars no início, ${indice.nFim} no fim — removidos)
`,
  );
}

const resultado: { id: string; tipo: string; pagina: string; veredito: Veredito; trecho: string }[] = [];

for (const f of achados) {
  const { veredito, trecho } = ancorarEvidencia(indice, String(f.evidencia ?? ""), f.pagina);
  resultado.push({ id: f.id, tipo: f.tipo, pagina: String(f.pagina), veredito, trecho });
}

const conta = (v: Veredito) => resultado.filter((r) => r.veredito === v).length;
const total = resultado.length;

console.log(`PARECER: ${parecerPath.split(/[\\/]/).pop()} — ${total} achados`);
console.log(`DOCUMENTO: ${extracted.pageCount} páginas, ${extracted.charCount} chars\n`);
console.log(`  ancorada na página declarada : ${conta("ancorada")}/${total}`);
console.log(`  existe, mas em OUTRA página  : ${conta("outra_pagina")}/${total}`);
console.log(`  NÃO encontrada no documento  : ${conta("nao_encontrada")}/${total}`);
console.log(`  sem transcrição para conferir: ${conta("sem_transcricao")}/${total}\n`);

for (const v of ["nao_encontrada", "outra_pagina", "sem_transcricao"] as Veredito[]) {
  const lista = resultado.filter((r) => r.veredito === v);
  if (!lista.length) continue;
  console.log(`--- ${v} (${lista.length}) ---`);
  for (const r of lista) {
    console.log(`  ${r.id} p.${r.pagina} · ${r.tipo}`);
    if (r.trecho) console.log(`     "${r.trecho.replace(/\s+/g, " ").slice(0, 110)}"`);
  }
  console.log();
}

if (conta("nao_encontrada") > 0) {
  console.log("ATENÇÃO: transcrição que não existe no documento é falso positivo GRAVE.");
  console.log("Confira se é invenção do modelo ou limitação da extração antes de concluir.");
}
