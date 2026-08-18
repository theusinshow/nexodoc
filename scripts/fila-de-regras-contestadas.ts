/**
 * A FILA DE REVISÃO DA CAMADA DETERMINÍSTICA.
 *
 * Toda auditoria em que a validação por IA pediu para remover um achado de regra
 * grava a discordância em `runtime.regras_contestadas`. Este script varre as
 * auditorias gravadas e agrupa por REGRA — porque o que interessa não é uma
 * contestação isolada, é a regra que é contestada sempre.
 *
 *   node scripts/fila-de-regras-contestadas.ts [limite]
 *
 * Uma contestação pode ser a IA errando. Uma regra contestada em várias
 * auditorias diferentes, com o mesmo motivo, é defeito nosso — e foi assim que
 * os três falsos positivos de 18/08/2026 se pareciam antes de serem achados:
 * repetidos, com o motivo escrito, e ninguém lendo.
 *
 * Zero IA, zero token: lê o que já está gravado.
 */
import fs from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const limite = Number(process.argv[2] ?? 50);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const audits = await prisma.audit.findMany({
  where: { status: "COMPLETED" },
  orderBy: { createdAt: "desc" },
  take: Number.isFinite(limite) ? limite : 50,
  select: { id: true, title: true, createdAt: true, report: true },
});

type Contestacao = {
  achado: string;
  tipo: string;
  pagina: string;
  motivo: string;
  evidencia: string;
};

const porRegra = new Map<string, { auditoria: string; c: Contestacao }[]>();
let comContestacao = 0;

for (const a of audits) {
  const runtime = (a.report as Record<string, unknown>)?.runtime as
    | Record<string, unknown>
    | undefined;
  const lista = (runtime?.regras_contestadas ?? []) as Contestacao[];
  if (lista.length === 0) continue;
  comContestacao++;
  for (const c of lista) {
    if (!porRegra.has(c.tipo)) porRegra.set(c.tipo, []);
    porRegra.get(c.tipo)!.push({ auditoria: a.title || a.id.slice(0, 8), c });
  }
}

console.log(`${audits.length} auditoria(s) lida(s) · ${comContestacao} com contestação\n`);

if (porRegra.size === 0) {
  console.log("Nenhuma regra contestada. Ou as regras estão certas, ou nenhuma auditoria");
  console.log("rodou depois de 18/08/2026, quando o registro passou a existir.");
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
}

for (const [tipo, ocorrencias] of [...porRegra].sort((a, b) => b[1].length - a[1].length)) {
  console.log("=".repeat(76));
  console.log(`${ocorrencias.length}x  ${tipo}`);
  console.log("=".repeat(76));
  for (const { auditoria, c } of ocorrencias.slice(0, 6)) {
    console.log(`\n  ${auditoria} · ${c.achado} · p.${c.pagina}`);
    console.log(`    motivo: ${c.motivo}`);
    if (c.evidencia) console.log(`    evid  : ${c.evidencia.slice(0, 150)}`);
  }
  if (ocorrencias.length > 6) console.log(`\n  ... e mais ${ocorrencias.length - 6}`);
  console.log();
}

console.log(
  "Leitura: uma contestação pode ser a IA errando. A MESMA regra contestada em\n" +
    "auditorias diferentes, com o mesmo motivo, é defeito da regra.",
);

await prisma.$disconnect();
await pool.end();
