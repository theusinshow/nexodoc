// A EQUIPE DA PROSUL — quem tem acesso, e de que grupo é.
//
//   node scripts/semear-equipe.ts   (== npm run seed:equipe)
//
// Cada pessoa vira um vínculo `OrganizationMember`. Elas nascem INVITED e sem
// conta, que é o desenho do convite: o vínculo existe antes do primeiro login e
// se liga sozinho quando a pessoa entra. É por isso que dá para atribuir um
// achado a alguém que nunca abriu o sistema.
//
// DIRETOR VIRA `ADMIN` DO ESCRITÓRIO, e o resto `MEMBER`. É a alçada de
// cadastrar projeto e convidar gente — quem dirige o escritório decide isso.
// Admin de PLATAFORMA (custo de IA, modelos) continua sendo outra coisa, por
// variável de ambiente, e ninguém ganha isso aqui.
//
// NÃO REBAIXA NEM DESATIVA NINGUÉM: rodar de novo só acrescenta o que falta e
// atualiza nome e grupo. Quem já está ACTIVE continua ACTIVE — o seed não pode
// tirar o acesso de quem está trabalhando porque a planilha ficou velha.
//
// A FONTE é `docs/samples/nexodoc_seed_padronizado.json`, que o escritório
// padronizou em 14/08/2026. A lista está COPIADA aqui de propósito: aquela pasta
// está no `.gitignore` (guarda amostra confidencial de cliente), então um script
// que dependesse dela não rodaria em nenhuma outra máquina.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const prisma = getPrisma();
const ORG = "org-prosul";

type Pessoa = { nome: string; email: string; grupo: string; cargo: "diretor" | "projetista" };

const EQUIPE: Pessoa[] = [
  { nome: "Claudia Bonfada", email: "claudia@prosul.com", grupo: "arquitetura", cargo: "diretor" },
  { nome: "Yazan Issa", email: "yazan.issa@prosul.com", grupo: "diretoria", cargo: "diretor" },
  { nome: "Arq. Vanessa Martinhão", email: "arqvanessamart@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Arthur Preuss", email: "preussarthur1@gmail.com", grupo: "estrutural", cargo: "projetista" },
  { nome: "Augusto Bolzan", email: "augustobolzan.arq@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Carolina Barreto", email: "carolabarreto@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Christian Lizardo Wilhelm Aren...", email: "eng.clwaa@gmail.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Eduarda Coser", email: "eduardacoserarquitetura@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Emily Coelho", email: "emily.w.coelho@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Fernando Coan", email: "fernandocoanp@gmail.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Giovani Colla", email: "giovanicolla@gmail.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Guilherme A. Kroetz", email: "guilhermeakroetz@gmail.com", grupo: "estrutural", cargo: "projetista" },
  { nome: "Guilherme Cascaes", email: "gbcascaes@gmail.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Guilherme Soldatelli", email: "guilherme.soldatelli@prosul.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Gustavo R. Thomé", email: "gustavorintzelthome@gmail.com", grupo: "estrutural", cargo: "projetista" },
  { nome: "Hanna Catan", email: "hannacatan.arquitetura@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Izabela Zanella", email: "izabelazanellaarq@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Lais Göde Ferreira", email: "laisgodeferreira@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Luana Arenillas", email: "arq.luanaarenillas@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Matheus Mendes", email: "matheus.mendes@prosul.com", grupo: "estrutural", cargo: "projetista" },
  { nome: "Mayra Guarnieri", email: "orcamentoe2@prosul.com", grupo: "orcamento", cargo: "projetista" },
  { nome: "Milton Chagas", email: "miltonchagas28@gmail.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Orçamento EDF", email: "orcamento.edf@prosul.com", grupo: "orcamento", cargo: "diretor" },
  { nome: "Rafael Buss", email: "rafael.buss@prosul.com", grupo: "estrutural", cargo: "diretor" },
  { nome: "Rafaela Alexandra Fiorelli", email: "rafaelaalexandrafiorelli@gmail.com", grupo: "complementares", cargo: "projetista" },
  { nome: "Rafaela Amorim", email: "rafaela.l.amorim@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Rama Issa", email: "rama.issa@prosul.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Roberta Barros", email: "roberta.mlb@gmail.com", grupo: "arquitetura", cargo: "projetista" },
  { nome: "Víctor Hugo Dagnoni", email: "victordagnoni@gmail.com", grupo: "estrutural", cargo: "projetista" },
  { nome: "Wenderson Oliveira", email: "orcamentoe3@prosul.com", grupo: "orcamento", cargo: "projetista" },
  { nome: "William - WL Müller", email: "wlmullerengenharia@gmail.com", grupo: "estrutural", cargo: "projetista" },];

const org = await prisma.organization.findUnique({ where: { id: ORG }, select: { id: true } });

if (!org) {
  console.error(`Organizacao ${ORG} nao existe. Rode 'npm run db:migrate' antes.`);
  process.exit(1);
}

let criados = 0;
let atualizados = 0;

for (const pessoa of EQUIPE) {
  const email = pessoa.email.trim().toLowerCase();
  const existente = await prisma.organizationMember.findUnique({
    where: { organizationId_email: { organizationId: ORG, email } },
    select: { id: true, status: true, role: true },
  });

  const papel = pessoa.cargo === "diretor" ? "ADMIN" : "MEMBER";

  if (existente) {
    await prisma.organizationMember.update({
      where: { id: existente.id },
      data: {
        name: pessoa.nome,
        grupo: pessoa.grupo,
        /*
         * O PAPEL SÓ SOBE. Se alguém foi promovido a ADMIN pela tela do admin, a
         * planilha não pode rebaixá-lo de volta na próxima rodada — a tela é
         * mais recente que o arquivo, sempre.
         */
        ...(papel === "ADMIN" && existente.role === "MEMBER" ? { role: "ADMIN" as const } : {}),
      },
    });
    atualizados += 1;
    continue;
  }

  await prisma.organizationMember.create({
    data: {
      organizationId: ORG,
      email,
      name: pessoa.nome,
      grupo: pessoa.grupo,
      role: papel,
      status: "INVITED",
    },
  });
  criados += 1;
}

const total = await prisma.organizationMember.count({ where: { organizationId: ORG } });
const semGrupo = await prisma.organizationMember.count({
  where: { organizationId: ORG, grupo: null },
});

console.log(`\nOK  ${criados} convidado(s), ${atualizados} atualizado(s).`);
console.log(`    ${total} pessoas na PROSUL, ${semGrupo} sem grupo declarado.`);

await prisma.$disconnect();
