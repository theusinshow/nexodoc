// Os projetos passam a ser da PROSUL, e os donos viram membros.
//
//   node scripts/backfill-escritorio.ts            (ensaio, não grava)
//   node scripts/backfill-escritorio.ts --gravar   (grava)
//
// ENSAIO POR PADRÃO. Um backfill que grava sem pedir é um que roda por engano —
// e este cria vínculos de acesso: rodá-lo no banco errado dá a estranhos a
// chave do escritório.
//
// A ORDEM IMPORTA, e é por isso que este script existe antes do portão estar
// completo: `requireActor` recusa quem não é membro de escritório nenhum. Sem
// os membros que este script cria, TODA rota fechada responde 403 — inclusive
// para quem já usava o sistema ontem. Em produção são dois deploys, nesta
// ordem: primeiro o backfill, depois o código do portão.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const GRAVAR = process.argv.includes("--gravar");
const prisma = getPrisma();
const ORG = "org-prosul";

const org = await prisma.organization.findUnique({ where: { id: ORG } });
if (!org) {
  console.error(`Organizacao ${ORG} nao existe. Rode o passo 1 antes.`);
  process.exit(1);
}

const orfaos = await prisma.project.findMany({
  where: { organizationId: null },
  select: { id: true, ownerEmail: true, ownerName: true, ownerId: true },
});

const donos = new Map<string, { name: string | null; userId: string | null }>();
for (const p of orfaos) {
  if (!donos.has(p.ownerEmail)) {
    donos.set(p.ownerEmail, { name: p.ownerName, userId: p.ownerId });
  }
}

console.log(`projetos sem organizacao: ${orfaos.length}`);
console.log(`donos distintos, que viram membros: ${donos.size}`);
for (const [email] of donos) console.log(`  · ${email}`);

if (!GRAVAR) {
  console.log("\nENSAIO. Nada foi gravado. Rode com --gravar para valer.");
  process.exit(0);
}

/*
 * O PRIMEIRO dono vira OWNER do escritório, o resto vira MEMBER.
 *
 * É um chute, e é assumido: não há no banco nada que diga quem coordena a
 * PROSUL. O chute é seguro porque é reversível por tela em dois cliques — já
 * inventar OWNER para todo mundo não seria, porque OWNER pode remover os
 * outros.
 *
 * `update: {}` de propósito: rodar de novo não rebaixa nem promove ninguém que
 * já exista. Um backfill que corrige papéis a cada execução desfaz, em silêncio,
 * o trabalho de quem os ajustou pela tela.
 */
let primeiro = true;
for (const [email, dados] of donos) {
  await prisma.organizationMember.upsert({
    where: { organizationId_email: { organizationId: ORG, email } },
    create: {
      organizationId: ORG,
      email,
      name: dados.name,
      userId: dados.userId,
      role: primeiro ? "OWNER" : "MEMBER",
      status: "ACTIVE",
    },
    update: {},
  });
  primeiro = false;
}

const movidos = await prisma.project.updateMany({
  where: { organizationId: null },
  data: { organizationId: ORG },
});

const restantes = await prisma.project.count({ where: { organizationId: null } });

console.log(`\nmembros criados/confirmados: ${donos.size}`);
console.log(`projetos movidos: ${movidos.count}`);
console.log(`projetos ainda sem organizacao: ${restantes}`);

if (restantes !== 0) {
  console.error("FALHOU: sobrou projeto sem organizacao. Nao rode o passo 3.");
  process.exit(1);
}

console.log("OK  backfill fechou as contas.");
process.exit(0);
