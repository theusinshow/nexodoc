// O QUE DÁ PARA APROVEITAR DO QUE JÁ EXISTE — e só isso.
//
//   node scripts/backfill-identidade-do-projeto.mjs [--aplicar]
//
// Sem `--aplicar` só relata. Duas coisas, e nenhuma delas adivinha:
//
//   1. `Project.clientKey` — derivação determinística do `client` que já existe;
//   2. `NexoConversation.projectId` — ligado APENAS quando o JSON da conversa
//      registra uma auditoria, e essa auditoria tem projeto.
//
// NADA DE CASAMENTO POR SEMELHANÇA. É o erro que lib/resolucao-de-projeto.ts
// existe para evitar: "099-26" não vira "099-25" por ser parecido. Conversa sem
// evidência fica "A endereçar", que é o estado honesto dela.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { slugDoCliente } = await import("../lib/cliente-do-projeto.ts");

const APLICAR = process.argv.includes("--aplicar");
const prisma = getPrisma();

console.log(APLICAR ? "APLICANDO\n" : "ENSAIO — nada será gravado (use --aplicar)\n");

// 1. clientKey
const projetos = await prisma.project.findMany({
  select: { id: true, code: true, client: true, clientKey: true },
});
let chaves = 0;

for (const p of projetos) {
  const chave = slugDoCliente(p.client);
  if (!chave || chave === p.clientKey) continue;
  console.log(`  ${p.code}: clientKey "${p.clientKey}" -> "${chave}"  (${p.client})`);
  chaves += 1;
  if (APLICAR) {
    await prisma.project.update({ where: { id: p.id }, data: { clientKey: chave } });
  }
}
console.log(`\nclientKey: ${chaves} projeto(s)\n`);

// 2. projectId das conversas — só com evidência.
const conversas = await prisma.nexoConversation.findMany({
  where: { projectId: null },
  select: { id: true, title: true, data: true },
});
let ligadas = 0;
let semEvidencia = 0;

for (const c of conversas) {
  const registradas = Array.isArray(c.data?.auditorias) ? c.data.auditorias : [];
  const ids = registradas.map((a) => a?.auditId).filter((x) => typeof x === "string");

  if (ids.length === 0) {
    semEvidencia += 1;
    continue;
  }

  const audit = await prisma.audit.findFirst({
    where: { id: { in: ids }, projectId: { not: null } },
    select: { projectId: true, project: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!audit?.projectId) {
    semEvidencia += 1;
    continue;
  }

  console.log(`  ${c.id.slice(0, 8)} "${c.title.slice(0, 30)}" -> ${audit.project?.code}`);
  ligadas += 1;
  if (APLICAR) {
    await prisma.nexoConversation.update({
      where: { id: c.id },
      data: { projectId: audit.projectId },
    });
  }
}

console.log(`\nconversas ligadas: ${ligadas}`);
console.log(`conversas que ficam "A endereçar": ${semEvidencia}`);
