/**
 * QUANTO CUSTA RODAR, medido — não estimado.
 *
 *   DATABASE_URL=<prod> node scripts/estimativa-de-custo.ts
 *
 * O produto grava `estimatedCostUsd` por chamada desde o começo. Isto lê esses
 * registros e responde as perguntas que definem um teto mensal:
 *
 *   - quanto custa LER O SELO de uma prancha (o gargalo do volume: 1 chamada
 *     por folha, então o custo escala com o tamanho do projeto);
 *   - quanto custa AUDITAR um memorial, por nível;
 *   - o que mais gasta, e se vale mexer.
 *
 * Diagnóstico, não teste: o número é o que o banco tem, e a leitura dele é o
 * trabalho.
 */
import { getPrisma } from "../lib/db.ts";

const prisma = getPrisma();
const usd = (n: number) => `US$ ${n.toFixed(4)}`;

const eventos = await prisma.aiUsageEvent.findMany({
  select: {
    flow: true,
    operation: true,
    model: true,
    status: true,
    inputTokens: true,
    outputTokens: true,
    estimatedCostUsd: true,
    conversationId: true,
    createdAt: true,
  },
});

console.log(`${eventos.length} chamadas registradas\n`);
if (eventos.length === 0) {
  await prisma.$disconnect();
  process.exit(0);
}

const datas = eventos.map((e) => e.createdAt.getTime());
const dias = Math.max(1, Math.round((Math.max(...datas) - Math.min(...datas)) / 86400000));
console.log(
  `período: ${new Date(Math.min(...datas)).toISOString().slice(0, 10)} → ` +
    `${new Date(Math.max(...datas)).toISOString().slice(0, 10)} (${dias} dias)\n`,
);

/* ------------------------------------------------------- por operação */

interface Linha {
  n: number;
  custo: number;
  entrada: number;
  saida: number;
  falhas: number;
}
const porOperacao = new Map<string, Linha>();
let total = 0;

for (const e of eventos) {
  const chave = `${e.flow} · ${e.operation}`;
  const l = porOperacao.get(chave) ?? { n: 0, custo: 0, entrada: 0, saida: 0, falhas: 0 };
  l.n += 1;
  l.custo += e.estimatedCostUsd ?? 0;
  l.entrada += e.inputTokens;
  l.saida += e.outputTokens;
  if (e.status !== "success") l.falhas += 1;
  porOperacao.set(chave, l);
  total += e.estimatedCostUsd ?? 0;
}

console.log("POR OPERAÇÃO (ordenado pelo que mais gasta)\n");
console.log(
  `  ${"operação".padEnd(44)} ${"n".padStart(5)} ${"total".padStart(11)} ${"média/chamada".padStart(14)}`,
);
const ordenadas = [...porOperacao.entries()].sort((a, b) => b[1].custo - a[1].custo);
for (const [chave, l] of ordenadas) {
  console.log(
    `  ${chave.slice(0, 44).padEnd(44)} ${String(l.n).padStart(5)} ` +
      `${usd(l.custo).padStart(11)} ${usd(l.custo / l.n).padStart(14)}` +
      (l.falhas ? `  (${l.falhas} falha[s])` : ""),
  );
}
console.log(`\n  ${"TOTAL".padEnd(44)} ${String(eventos.length).padStart(5)} ${usd(total).padStart(11)}`);

/* --------------------------------------------- o custo por UNIDADE de trabalho */

console.log("\n\nCUSTO POR UNIDADE DE TRABALHO\n");

const selo = ordenadas.find(([k]) => /ld-extraction|selo/i.test(k))?.[1];
if (selo) {
  const porFolha = selo.custo / selo.n;
  console.log(`  leitura de selo: ${usd(porFolha)} por PRANCHA (${selo.n} medidas)`);
  for (const folhas of [20, 44, 71, 150]) {
    console.log(`     volume de ${String(folhas).padStart(3)} pranchas → ${usd(porFolha * folhas)}`);
  }
}

/* Auditoria: o custo é por CONVERSA, não por chamada — a profunda faz dezenas. */
const auditoria = eventos.filter((e) => /audit/i.test(e.flow));
if (auditoria.length > 0) {
  /*
   * SEM `conversationId` NÃO É UMA AUDITORIA — é o balde de tudo que rodou
   * fora de conversa (script de teste, corrida de bancada, chamada solta). Ele
   * juntou 410 chamadas de 12 dias e 6 modelos, incluindo os já aposentados, e
   * apareceu como "a auditoria mais cara: US$ 19,49". A bancada estava medindo
   * o próprio desenvolvimento e chamando de cliente.
   */
  const porConversa = new Map<string, number>();
  for (const e of auditoria) {
    if (!e.conversationId) continue;
    porConversa.set(
      e.conversationId,
      (porConversa.get(e.conversationId) ?? 0) + (e.estimatedCostUsd ?? 0),
    );
  }
  const custos = [...porConversa.values()].sort((a, b) => a - b);
  const meio = custos[Math.floor(custos.length / 2)];
  console.log(
    `\n  auditoria de memorial: ${custos.length} auditoria(s) medida(s)` +
      `\n     mediana ${usd(meio)} · menor ${usd(custos[0])} · maior ${usd(custos[custos.length - 1])}`,
  );
}

/* ------------------------------------------------------------- projeção */

console.log("\n\nPROJEÇÃO MENSAL — troque os números pelos do seu mês\n");
const porFolha = selo ? selo.custo / selo.n : 0;
const auditoriaMediana = (() => {
  const porConversa = new Map<string, number>();
  for (const e of auditoria) {
    if (!e.conversationId) continue;
    porConversa.set(
      e.conversationId,
      (porConversa.get(e.conversationId) ?? 0) + (e.estimatedCostUsd ?? 0),
    );
  }
  const c = [...porConversa.values()].sort((a, b) => a - b);
  return c.length ? c[Math.floor(c.length / 2)] : 0;
})();

for (const cenario of [
  { nome: "leve", volumes: 4, folhas: 40, auditorias: 4 },
  { nome: "típico", volumes: 10, folhas: 50, auditorias: 10 },
  { nome: "pesado", volumes: 20, folhas: 70, auditorias: 20 },
]) {
  const deVolume = cenario.volumes * cenario.folhas * porFolha;
  const deAuditoria = cenario.auditorias * auditoriaMediana;
  console.log(
    `  ${cenario.nome.padEnd(8)} ${String(cenario.volumes).padStart(2)} volumes × ${cenario.folhas} folhas` +
      ` + ${String(cenario.auditorias).padStart(2)} auditorias` +
      `  →  ${usd(deVolume + deAuditoria)}/mês` +
      `   (volume ${usd(deVolume)} · auditoria ${usd(deAuditoria)})`,
  );
}

console.log(
  "\nLIMITE: o custo por prancha vem das leituras JÁ FEITAS, com os modelos de\n" +
    "hoje. Trocar de modelo muda tudo — foi o que aconteceu ao sair do `mini`.",
);

await prisma.$disconnect();
