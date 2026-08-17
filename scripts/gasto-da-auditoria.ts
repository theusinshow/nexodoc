/**
 * QUANTO CUSTOU, de verdade — lido do banco, não estimado.
 *
 * Toda chamada de modelo grava um `AiUsageEvent` com tokens e custo calculado
 * pela mesma tabela de preço do produto. Este script só agrupa e soma.
 *
 * Nasceu em 17/08/2026, quando uma auditoria do 084_25 gastou US$ 6,09 e 71%
 * disso foi para 20 blocos que truncaram e devolveram zero. Nenhuma estimativa
 * teria mostrado isso: a conta que eu tinha feito assumia que teto de saída é
 * limite, e chamada truncada gasta o teto INTEIRO. Só a fatura conta a verdade.
 *
 * Uso:
 *   node scripts/gasto-da-auditoria.ts            # últimas 5h
 *   node scripts/gasto-da-auditoria.ts 24         # últimas 24h
 *   node scripts/gasto-da-auditoria.ts 24 <auditId>   # uma auditoria só
 */
import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

/*
 * `.env.local` na mão: este script roda em node cru, fora do Next, e é o Next
 * que normalmente carrega o arquivo. Sem isto o `DATABASE_URL` chegaria vazio e
 * o Prisma cairia no localhost do padrão — respondendo "nenhum evento" para um
 * banco que não é o do projeto, que é a pior resposta possível.
 */
for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(linha.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const horas = Number(process.argv[2] ?? 5);
const auditId = process.argv[3];

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

const eventos = await prisma.aiUsageEvent.findMany({
  where: {
    flow: "audit",
    createdAt: { gte: new Date(Date.now() - horas * 60 * 60 * 1000) },
    ...(auditId ? { taskId: auditId } : {}),
  },
  orderBy: { createdAt: "asc" },
});

if (eventos.length === 0) {
  console.log(
    `\nNenhuma chamada de auditoria nas últimas ${horas}h${auditId ? ` para ${auditId}` : ""}.`,
  );
  await prisma.$disconnect();
  process.exit(0);
}

type Linha = { n: number; entrada: number; saida: number; usd: number };
const por = new Map<string, Linha>();

for (const e of eventos) {
  const chave = `${e.operation} · ${e.model} · ${e.status}`;
  const linha = por.get(chave) ?? { n: 0, entrada: 0, saida: 0, usd: 0 };
  linha.n += 1;
  linha.entrada += e.inputTokens;
  linha.saida += e.outputTokens;
  linha.usd += e.estimatedCostUsd ?? 0;
  por.set(chave, linha);
}

const n = (v: number) => v.toLocaleString("pt-BR");
let total = 0;
let desperdicio = 0;

console.log(
  `\n${"operação · modelo · status".padEnd(46)}${"n".padStart(4)}${"entrada".padStart(11)}${"saída".padStart(10)}${"US$".padStart(9)}`,
);

for (const [chave, l] of [...por.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
  console.log(
    chave.padEnd(46) +
      String(l.n).padStart(4) +
      n(l.entrada).padStart(11) +
      n(l.saida).padStart(10) +
      l.usd.toFixed(3).padStart(9),
  );
  total += l.usd;
  // Só o que FALHOU é desperdício puro: gastou e não entregou nada.
  if (!chave.endsWith("success")) desperdicio += l.usd;
}

console.log("-".repeat(80));
console.log(
  "TOTAL".padEnd(46) +
    String(eventos.length).padStart(4) +
    n(eventos.reduce((s, e) => s + e.inputTokens, 0)).padStart(11) +
    n(eventos.reduce((s, e) => s + e.outputTokens, 0)).padStart(10) +
    total.toFixed(3).padStart(9),
);

if (desperdicio > 0) {
  console.log(
    `\nUS$ ${desperdicio.toFixed(3)} (${Math.round((desperdicio / total) * 100)}%) foram para chamadas que FALHARAM.\n` +
      `Chamada truncada gasta o teto de saída inteiro e devolve zero — é o pior caso, não um caso degradado.`,
  );
}

await prisma.$disconnect();
