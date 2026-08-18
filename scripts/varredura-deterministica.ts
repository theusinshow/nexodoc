/**
 * AS REGRAS CONTRA TODO O ACERVO REAL — a prova que fixture não dá.
 *
 * A suíte `test:audit:metrics` mede precisão contra fixtures escritas por quem
 * escreveu a regra, e por isso ela dá 100% mesmo quando a regra está errada: o
 * autor testa o caso que imaginou. Em 18/08/2026 a regra de identidade tinha
 * TRÊS falsos positivos no 117_25 com a suíte inteira verde — ela acusava
 * "Unidade Básica de Saúde Vila Manaus" de divergir de "UBS Vila Manaus", que é
 * o mesmo nome por extenso.
 *
 * Só documento real acha esse tipo de erro, e só em quantidade: um memorial
 * mostra um defeito, cinco mostram o padrão.
 *
 *   node scripts/varredura-deterministica.ts [--json saida.json]
 *
 * Zero IA, zero token. Serve para duas coisas:
 *   1. ler os achados e caçar falso positivo com olho humano;
 *   2. congelar o retrato (--json) e comparar depois de mexer numa regra, para
 *      que "consertei X" tenha de mostrar o que mudou em TODOS os documentos.
 */
import { readFile } from "node:fs/promises";
import { readdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { extractPdfText } from "../lib/pdf-text.ts";
import { runWithinDocumentIdentityRules } from "../lib/cross-document-audit.ts";
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";
import type { AuditFinding } from "../lib/audit-report.ts";

const RAIZ = "docs/samples";

/** Todo memorial do acervo, ignorando as versões assinadas (mesmo conteúdo). */
function acharMemoriais(): string[] {
  const out: string[] = [];
  for (const projeto of readdirSync(RAIZ)) {
    // `docs/samples` tem planilhas soltas ao lado das pastas de projeto.
    if (!statSync(path.join(RAIZ, projeto)).isDirectory()) continue;
    for (const sub of ["1_memorial", ""]) {
      const dir = path.join(RAIZ, projeto, sub);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      for (const arquivo of readdirSync(dir)) {
        if (!/_md_geral_.*\.pdf$/i.test(arquivo)) continue;
        if (/assinado/i.test(arquivo)) continue;
        out.push(path.join(dir, arquivo));
      }
    }
  }
  return out.sort();
}

const alvoJson = process.argv.includes("--json")
  ? process.argv[process.argv.indexOf("--json") + 1]
  : null;

const memoriais = acharMemoriais();
if (memoriais.length === 0) {
  console.error(`Nenhum memorial encontrado em ${RAIZ}.`);
  process.exit(1);
}

console.log(`${memoriais.length} memorial(is) no acervo\n`);

const retrato: Record<string, { paginas: number; chars: number; achados: unknown[] }> = {};
const porTipo = new Map<string, number>();
let total = 0;

for (const caminho of memoriais) {
  const nome = path.basename(caminho);
  const extracted = await extractPdfText(await readFile(caminho));
  const source = { fileName: nome, fileType: "memorial", extracted };

  const achados: AuditFinding[] = [
    ...runWithinDocumentIdentityRules(source),
    ...runDocumentCoherenceRules(source),
  ];
  total += achados.length;

  console.log(`${"=".repeat(76)}`);
  console.log(`${nome}  ·  ${extracted.pageCount} páginas  ·  ${achados.length} achado(s)`);
  console.log(`${"=".repeat(76)}`);

  for (const f of achados) {
    porTipo.set(f.tipo, (porTipo.get(f.tipo) ?? 0) + 1);
    console.log(`\n[${f.prioridade}] p.${f.pagina} · ${f.tipo}`);
    if (f.conflito) console.log(`   ${String(f.conflito).replace(/\s+/g, " ").slice(0, 190)}`);
    if (f.evidencia) console.log(`   ev: ${String(f.evidencia).replace(/\s+/g, " ").slice(0, 190)}`);
  }
  console.log();

  retrato[nome] = {
    paginas: extracted.pageCount,
    chars: extracted.charCount,
    achados: achados.map((f) => ({
      tipo: f.tipo,
      pagina: f.pagina,
      prioridade: f.prioridade,
      conflito: String(f.conflito ?? "").replace(/\s+/g, " ").slice(0, 300),
      evidencia: String(f.evidencia ?? "").replace(/\s+/g, " ").slice(0, 300),
    })),
  };
}

console.log(`${"=".repeat(76)}`);
console.log(`TOTAL: ${total} achado(s) em ${memoriais.length} memorial(is)\n`);
console.log("POR REGRA (quem dispara muito merece olhar primeiro):");
for (const [tipo, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${tipo}`);
}

if (alvoJson) {
  writeFileSync(alvoJson, JSON.stringify(retrato, null, 2));
  console.log(`\nretrato gravado em ${alvoJson}`);
}
