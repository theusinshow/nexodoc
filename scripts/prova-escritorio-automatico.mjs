// Quem entra pela primeira vez ja e da PROSUL.
//
//   node scripts/prova-escritorio-automatico.mjs   (== npm run prova:automatico)
//
// Decisao do mantenedor em 14/08/2026: existe um escritorio so, e conta sem
// vinculo nao protege nada — e uma pessoa levando 403 sem motivo. Quem chega sem
// convite entra como MEMBER.
//
// ESTA PROVA EXISTE PELO QUE A REGRA ABRE, e nao pelo que ela resolve. O caminho
// feliz (desconhecido entra e ve os projetos) e uma assercao; as outras tres sao
// as travas, e cada uma corresponde a um jeito de a regra virar problema:
//
//  · quem foi DESLIGADO a mao nao pode voltar sozinho no login seguinte. O
//    desligamento e justamente o gesto que nao se desfaz por conta propria;
//  · o convite pendente continua valendo como convite — se o automatico
//    atropelasse, o papel escolhido por quem convidou (ADMIN, por exemplo) seria
//    trocado por MEMBER no primeiro login;
//  · ninguem nasce com alcada. Cadastrar projeto define centro de custo, e
//    centro de custo errado manda achado para a fila de outro projeto.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ORG = "org-prosul";

const DESCONHECIDO = "estranho@qualquer.com";
const DESLIGADO = "desligado@prosul.com";
const CONVIDADO = "convidada-admin@prosul.com";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

for (const email of [DESCONHECIDO, DESLIGADO, CONVIDADO]) {
  await prisma.organizationMember.deleteMany({ where: { email } });
  await prisma.user.deleteMany({ where: { email } });
}

// O desligado tem vinculo DISABLED e nenhuma conta: e o estado de quem saiu do
// escritorio antes de ter logado de novo.
await prisma.organizationMember.create({
  data: { organizationId: ORG, email: DESLIGADO, role: "MEMBER", status: "DISABLED" },
});

// A convidada foi chamada para a COORDENACAO, e ainda nao entrou.
await prisma.organizationMember.create({
  data: { organizationId: ORG, email: CONVIDADO, role: "ADMIN", status: "INVITED" },
});

const browser = await chromium.launch();

async function entrar(email) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await entrarComo(page, email);
  const resposta = await page.request.get("/api/projects");
  const corpo = resposta.ok() ? await resposta.json() : null;
  await ctx.close();
  return { status: resposta.status(), projetos: corpo?.projects ?? null };
}

// --- 1. O desconhecido entra e ja e da PROSUL.
const doDesconhecido = await entrar(DESCONHECIDO);
const vinculoNovo = await prisma.organizationMember.findFirst({
  where: { email: DESCONHECIDO },
  select: { organizationId: true, role: true, status: true, userId: true },
});

check("desconhecido vira membro no primeiro login", Boolean(vinculoNovo));
check("na PROSUL", vinculoNovo?.organizationId === ORG, vinculoNovo?.organizationId);
check("como MEMBER, e nao com alcada", vinculoNovo?.role === "MEMBER", vinculoNovo?.role);
check("ja ATIVO, sem convite pendente", vinculoNovo?.status === "ACTIVE", vinculoNovo?.status);
check("com o vinculo ligado a conta", Boolean(vinculoNovo?.userId));
check("e enxerga os projetos do escritorio", doDesconhecido.status === 200, `HTTP ${doDesconhecido.status}`);

// --- 2. Cadastrar projeto continua sendo da coordenacao.
const ctxSemAlcada = await browser.newContext({ baseURL: BASE });
const pSemAlcada = await ctxSemAlcada.newPage();
await entrarComo(pSemAlcada, DESCONHECIDO);
const tentativa = await pSemAlcada.request.post("/api/projects", {
  data: { name: "Projeto do estranho", code: "777-77" },
});
await ctxSemAlcada.close();

check("mas nao cadastra projeto", tentativa.status() === 403, `HTTP ${tentativa.status()}`);
check(
  "e nada foi gravado",
  (await prisma.project.count({ where: { code: "777-77" } })) === 0,
);

// --- 3. Quem foi desligado NAO volta sozinho.
const doDesligado = await entrar(DESLIGADO);
const vinculoDesligado = await prisma.organizationMember.findFirst({
  where: { email: DESLIGADO },
  select: { status: true },
});

check("desligado continua DISABLED", vinculoDesligado?.status === "DISABLED", vinculoDesligado?.status);
check("e segue sem ler nada", doDesligado.status === 403, `HTTP ${doDesligado.status}`);
check(
  "sem vinculo novo criado ao lado",
  (await prisma.organizationMember.count({ where: { email: DESLIGADO } })) === 1,
);

// --- 4. O convite pendente vence o automatico, e preserva o papel.
await entrar(CONVIDADO);
const vinculoConvidado = await prisma.organizationMember.findFirst({
  where: { email: CONVIDADO },
  select: { role: true, status: true },
});

check("convite pendente vira ACTIVE", vinculoConvidado?.status === "ACTIVE", vinculoConvidado?.status);
check(
  "e o papel escolhido por quem convidou resiste",
  vinculoConvidado?.role === "ADMIN",
  vinculoConvidado?.role,
);

await browser.close();
await prisma.$disconnect();

if (falhas > 0) {
  console.error(`\nFALHOU  escritorio automatico (${falhas})`);
  process.exit(1);
}

console.log("\nOK  escritorio automatico");
