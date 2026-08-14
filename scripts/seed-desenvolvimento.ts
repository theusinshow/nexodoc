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

/*
 * O ELENCO, para haver o que clicar.
 *
 * Milton coordena, Victor é projetista, Ana foi convidada e nunca entrou — os
 * três estados que a tela precisa saber mostrar. Nenhum deles tem `User`: é de
 * propósito, e é o ponto. O vínculo com o escritório existe antes da conta, e é
 * o que vai permitir atribuir um achado ao Victor antes do primeiro login dele.
 */
const ELENCO = [
  { email: "milton@prosul.com", name: "Milton", role: "ADMIN" as const, status: "ACTIVE" as const },
  { email: "victor@prosul.com", name: "Victor", role: "MEMBER" as const, status: "ACTIVE" as const },
  { email: "ana@prosul.com", name: "Ana", role: "MEMBER" as const, status: "INVITED" as const },
];

for (const pessoa of ELENCO) {
  await prisma.organizationMember.upsert({
    where: { organizationId_email: { organizationId: ORG, email: pessoa.email } },
    create: { organizationId: ORG, ...pessoa },
    update: { role: pessoa.role, status: pessoa.status },
  });
  console.log(`    ${pessoa.email.padEnd(22)} ${pessoa.role.padEnd(7)} ${pessoa.status}`);
}

/*
 * Centro de custo + prefeitura, que é como a PROSUL identifica projeto:
 * `code` é o CC, `client` é a prefeitura.
 */
const PROJETOS = [
  { code: "063-26", name: "Memorial descritivo — Cancha de Bocha", client: "CRICIÚMA" },
  { code: "099-25", name: "Reforma da UBS Central", client: "CRICIÚMA" },
  { code: "040-26", name: "Ampliação da escola municipal", client: "IÇARA" },
];

for (const projeto of PROJETOS) {
  await prisma.project.upsert({
    where: { organizationId_code: { organizationId: ORG, code: projeto.code } },
    create: {
      ...projeto,
      organizationId: ORG,
      ownerEmail: "milton@prosul.com",
      ownerName: "Milton",
    },
    update: { organizationId: ORG },
  });
  console.log(`    ${projeto.code}  ${projeto.client.padEnd(10)} ${projeto.name}`);
}

console.log(
  `\nOK  ${ELENCO.length + 1} membros e ${PROJETOS.length} projetos na ${org.name}.`,
);
process.exit(0);
