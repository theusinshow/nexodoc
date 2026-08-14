// O mínimo para o aplicativo abrir nesta máquina.
//
//   node scripts/seed-desenvolvimento.ts   (== npm run seed:dev)
//
// POR QUE ISTO PRECISOU EXISTIR
//
// Desde que as rotas passaram pelo portão, entrar no sistema exige ser membro
// ATIVO de um escritório. Num banco recém-criado não há membro nenhum, então
// todo mundo — inclusive quem acabou de instalar — leva 403 em tudo. O
// backfill resolve isso em produção, a partir dos donos de projeto que já
// existem; aqui não há projeto nenhum de onde partir.
//
// Recusa rodar com NODE_ENV=production. Não porque o dado seja perigoso, mas
// porque conceder papel de ADMIN de escritório a partir de uma variável de
// ambiente é exatamente o tipo de atalho que ninguém lembra de ter deixado
// ligado.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (process.env.NODE_ENV === "production") {
  console.error("Este seed e de desenvolvimento. Em producao, use o backfill.");
  process.exit(1);
}

const { getPrisma } = await import("../lib/db.ts");

const prisma = getPrisma();
const ORG = "org-prosul";

const email = process.env.NEXODOC_DEV_AUTH_EMAIL?.trim().toLowerCase();
if (!email) {
  console.error("NEXODOC_DEV_AUTH_EMAIL vazio no .env. Sem ele nao ha quem semear.");
  process.exit(1);
}

const org = await prisma.organization.findUnique({ where: { id: ORG } });
if (!org) {
  console.error(`Organizacao ${ORG} nao existe. Rode 'npm run db:migrate' antes.`);
  process.exit(1);
}

const user = await prisma.user.upsert({
  where: { email },
  create: {
    email,
    name: process.env.NEXODOC_DEV_AUTH_NAME?.trim() || email,
    passwordHash: "dev-seed",
    role: "ADMIN",
    isActive: true,
  },
  update: { isActive: true },
});

const membro = await prisma.organizationMember.upsert({
  where: { organizationId_email: { organizationId: ORG, email } },
  create: {
    organizationId: ORG,
    email,
    name: user.name,
    userId: user.id,
    role: "ADMIN",
    status: "ACTIVE",
  },
  // Religa o `userId` se o usuário foi recriado — é o caso depois de limpar a
  // tabela de usuários sem limpar a de membros.
  update: { userId: user.id, status: "ACTIVE" },
});

console.log(`OK  ${email} e ADMIN ativo da ${org.name} (membro ${membro.id})`);
process.exit(0);
