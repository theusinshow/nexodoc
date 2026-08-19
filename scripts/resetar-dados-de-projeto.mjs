/**
 * APAGA OS DADOS DE PROJETO, e só eles.
 *
 *   node scripts/resetar-dados-de-projeto.mjs              (só mostra, não apaga)
 *   node scripts/resetar-dados-de-projeto.mjs --apagar     (apaga de verdade)
 *
 * Lê `DATABASE_URL` do shell, como `backup-json.mjs` — é assim que se escolhe
 * dev ou produção, e é assim que não se apaga produção por acidente ao rodar um
 * comando de memória.
 *
 * ## O QUE SOBREVIVE, e por quê
 *
 *   aiUsageEvent   o histórico de gasto de IA. São milhares de registros, e é
 *                  a base de toda decisão de modelo já tomada neste produto
 *                  (o `mini` que era mais caro que o `luna`, o `terra` no lugar
 *                  do `sol`). Zerar isso cega o `/admin` e apaga a memória de
 *                  custo — que não é dado de projeto.
 *   user           quem entra. Apagar seria expulsar gente do sistema.
 *   organization   a que escritório cada um pertence.
 *   *Config        cotação, metas, override de modelo: configuração declarada.
 *
 * ## A ORDEM importa
 *
 * As chaves estrangeiras usam `SetNull`, não `Cascade`: apagar `Project`
 * primeiro deixaria auditorias e rascunhos ÓRFÃOS em vez de apagá-los, e o
 * banco terminaria com lixo invisível. Filho antes de pai, sempre.
 *
 * O EXEMPLO DO TOUR não precisa ser poupado: `criarProjetoExemplo()` fabrica os
 * PDFs na hora, então ele se recria sozinho no primeiro tour.
 */
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const prisma = getPrisma();

const APAGAR = process.argv.includes("--apagar");

/** Filho antes de pai. `auditFeedback`/`auditFile` caem por cascade do `audit`. */
const ORDEM = [
  "auditFeedback",
  "auditFile",
  "audit",
  "ldDraftEvent",
  "ldDraft",
  "projectDocument",
  "projectUpload",
  "projectEvent",
  "documentArtifact",
  "project",
  "nexoConversation",
];

const PRESERVADAS = [
  "user",
  "session",
  "organization",
  "organizationMember",
  "aiUsageEvent",
  "aiModelConfig",
  "cambioConfig",
  "metaQualidadeConfig",
];

const alvo = (process.env.DATABASE_URL ?? "").match(/\/([^/?]+)\?/)?.[1] ?? "(desconhecido)";
console.log(`banco: ${alvo}`);
console.log(APAGAR ? "MODO: APAGAR\n" : "MODO: só mostrar (use --apagar para valer)\n");

console.log("a APAGAR:");
let total = 0;
for (const t of ORDEM) {
  const n = await prisma[t].count();
  total += n;
  console.log(`  ${t.padEnd(20)} ${n}`);
}

console.log("\na PRESERVAR:");
for (const t of PRESERVADAS) {
  console.log(`  ${t.padEnd(20)} ${await prisma[t].count()}`);
}

if (!APAGAR) {
  console.log(`\n${total} registro(s) seriam apagados. Nada foi tocado.`);
  await prisma.$disconnect();
  process.exit(0);
}

console.log("\napagando…");
for (const t of ORDEM) {
  const { count } = await prisma[t].deleteMany({});
  if (count > 0) console.log(`  ${t.padEnd(20)} -${count}`);
}

console.log("\ndepois:");
for (const t of ORDEM) {
  const n = await prisma[t].count();
  if (n > 0) console.log(`  SOBROU ${t}: ${n}`);
}
console.log("  (nada listado = tudo limpo)");

await prisma.$disconnect();
