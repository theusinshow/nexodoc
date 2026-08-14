/**
 * ZERA O TRABALHO, e preserva o escritorio.
 *
 *   node scripts/reset-trabalho.mjs           (so mostra o que faria)
 *   node scripts/reset-trabalho.mjs --aplicar (grava)
 *
 * O QUE SAI
 *
 *  · Project — e, por cascata, ProjectEvent;
 *  · Audit — e, por cascata, AuditFile e AuditFeedback;
 *  · LdDraft — e, por cascata, LdDraftEvent;
 *  · DocumentArtifact — o catalogo de capas, separatrizes e volumes. Sai junto
 *    porque os bytes nunca estiveram no banco (todos com storageProvider
 *    "none"): sao linhas descrevendo arquivos que so existiram no navegador de
 *    quem os gerou, e sem as auditorias e LDs de origem elas nao apontam para
 *    lugar nenhum;
 *  · NexoConversation — as conversas falam de auditorias e artefatos que
 *    deixaram de existir;
 *  · dev@nexodoc.local — conta de desenvolvimento que nasceu no banco de
 *    producao em 13/08, com papel ADMIN no escritorio.
 *
 * O QUE FICA, e por que
 *
 *  · Organization e OrganizationMember (menos o dev) — o escritorio nao e
 *    trabalho, e sem ele o portao recusa todo mundo;
 *  · AiUsageEvent (3.199 linhas) — NAO e trabalho, e MEDICAO. E dele que saiu o
 *    mapa de gasto; apagar destruiria o unico registro de quanto cada fluxo
 *    custou de verdade, que nao se reconstroi;
 *  · AiModelConfig — a escolha de modelo por fluxo, com a nota de como foi
 *    medida;
 *  · User de gente de verdade — gbcascaes e lais ficam. Sao pessoas, e decidir
 *    por elas nao e trabalho de script.
 */
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const aplicar = process.argv.includes("--aplicar");

const { getPrisma } = await import("../lib/db.ts");

const prisma = getPrisma();

const DEV = "dev@nexodoc.local";

const antes = await contar();

console.log(aplicar ? "APLICANDO\n" : "ENSAIO — nada sera gravado\n");
console.log("ANTES:");
mostrar(antes);

if (!aplicar) {
  console.log("\nRode com --aplicar para gravar.");
  await prisma.$disconnect();
  process.exit(0);
}

/*
 * Uma transacao so: um erro no meio nao pode deixar metade do acervo apagado e
 * a outra metade apontando para o que sumiu.
 *
 * A ordem e a das dependencias. DocumentArtifact usa SetNull para projeto,
 * auditoria e LD, entao sobreviveria ao apagamento delas como linha orfa — por
 * isso sai primeiro, de proposito, e nao por acaso de ordenacao.
 */
await prisma.$transaction(async (tx) => {
  await tx.documentArtifact.deleteMany({});
  await tx.nexoConversation.deleteMany({});
  await tx.audit.deleteMany({});
  await tx.ldDraft.deleteMany({});
  await tx.projectDocument.deleteMany({});
  await tx.projectUpload.deleteMany({});
  await tx.aiTask.deleteMany({});
  await tx.project.deleteMany({});

  await tx.organizationMember.deleteMany({ where: { email: DEV } });
  await tx.user.deleteMany({ where: { email: DEV } });
});

console.log("\nDEPOIS:");
mostrar(await contar());

await prisma.$disconnect();

async function contar() {
  const tabelas = [
    "project",
    "projectEvent",
    "audit",
    "auditFile",
    "auditFeedback",
    "ldDraft",
    "ldDraftEvent",
    "documentArtifact",
    "nexoConversation",
    "aiTask",
    "user",
    "organization",
    "organizationMember",
    "aiUsageEvent",
    "aiModelConfig",
  ];

  const saida = {};
  for (const tabela of tabelas) saida[tabela] = await prisma[tabela].count();
  return saida;
}

function mostrar(contagem) {
  for (const [tabela, quantidade] of Object.entries(contagem)) {
    console.log(`  ${tabela.padEnd(22)} ${quantidade}`);
  }
}
