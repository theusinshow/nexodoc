// Convidar alguém para o escritório, pela linha de comando.
//
//   node scripts/convidar.ts fulano@prosul.com          (== npm run convidar -- ...)
//   node scripts/convidar.ts fulano@prosul.com ADMIN
//   node scripts/convidar.ts --lista
//
// POR QUE EXISTE
//
// A rota `POST /api/organizacao/membros` já faz isto, e é ela que vale em
// produção. Falta a TELA — e sem tela, quem precisa colocar alguém no escritório
// para testar fica preso num 403 correto e sem saída visível.
//
// Isto não substitui a tela: substitui o `curl` que a pessoa escreveria à mão, e
// é honesto sobre ser ferramenta de bancada.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const prisma = getPrisma();
const ORG = "org-prosul";

async function listar() {
  const membros = await prisma.organizationMember.findMany({
    where: { organizationId: ORG },
    select: { email: true, name: true, role: true, status: true },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  console.log(`\n${membros.length} pessoa(s) na PROSUL:\n`);
  for (const m of membros) {
    const marca = m.status === "ACTIVE" ? " " : "·";
    console.log(`  ${marca} ${m.email.padEnd(30)} ${m.role.padEnd(7)} ${m.status}`);
  }
  console.log("\n  · = convidado, ainda não entrou. Entra ao fazer o primeiro login.\n");
}

const args = process.argv.slice(2).filter((a) => a !== "--");

if (args.includes("--lista") || args.length === 0) {
  await listar();
  process.exit(0);
}

const email = args[0]?.trim().toLowerCase();
const papel = args[1]?.trim().toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";

if (!email || !email.includes("@")) {
  console.error("Informe um e-mail. Ex.: node scripts/convidar.ts fulano@prosul.com");
  process.exit(1);
}

const org = await prisma.organization.findUnique({ where: { id: ORG } });
if (!org) {
  console.error(`Organizacao ${ORG} nao existe. Rode 'npm run db:migrate' antes.`);
  process.exit(1);
}

/*
 * Nasce INVITED, igual à rota. O primeiro login ativa e liga o `userId` — e é
 * de propósito que este script não crie o vínculo já ativo: fazer diferente
 * aqui esconderia justamente o estado que a tela precisa saber mostrar.
 */
const membro = await prisma.organizationMember.upsert({
  where: { organizationId_email: { organizationId: ORG, email } },
  create: { organizationId: ORG, email, role: papel, status: "INVITED" },
  update: { role: papel },
  select: { email: true, role: true, status: true },
});

console.log(`\nOK  ${membro.email} — ${membro.role}, ${membro.status}`);
console.log("    Entre com esse e-mail no login dev; o convite ativa no primeiro acesso.");
await listar();
process.exit(0);
