// O escritório: quem vê o quê, e quem não vê nada.
//
//   node scripts/prova-escritorio.mjs   (== npm run prova:escritorio)
//
// A PROVA DE VIDA do substrato é a primeira asserção: o Victor entra e vê o
// projeto do ESCRITÓRIO. Antes deste trabalho ele não via — `/api/projects`
// filtrava por `ownerEmail`, e o projeto do Milton simplesmente não existia na
// interface dele. Todo o fluxo Milton→Victor da revisão colaborativa não teria
// onde acontecer.
//
// O ESCRITÓRIO FANTASMA existe pelo motivo oposto: com uma organização só,
// vazamento entre organizações não tem como aparecer numa tela. Semear uma
// segunda e exigir 404 é o que separa "vender para o segundo escritório" de
// "auditar tudo de novo antes de vender".
//
// Exige banco de pé, servidor rodando e NEXODOC_DEV_AUTH=true.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ORG = "org-prosul";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

await prisma.organizationMember.upsert({
  where: { organizationId_email: { organizationId: ORG, email: "victor@prosul.com" } },
  create: {
    organizationId: ORG,
    email: "victor@prosul.com",
    name: "Victor",
    role: "MEMBER",
    status: "ACTIVE",
  },
  update: { status: "ACTIVE", role: "MEMBER" },
});

await prisma.project.upsert({
  where: { organizationId_code: { organizationId: ORG, code: "063-26" } },
  create: {
    organizationId: ORG,
    code: "063-26",
    name: "Memorial descritivo — Cancha de Bocha",
    client: "CRICIÚMA",
    ownerEmail: "milton@prosul.com",
    ownerName: "Milton",
  },
  update: {},
});

// O escritório fantasma, que existe só para provar que não vaza.
await prisma.organization.upsert({
  where: { slug: "fantasma" },
  create: {
    id: "org-fantasma",
    name: "Escritório Fantasma",
    slug: "fantasma",
    ownerEmail: "ninguem@fantasma.com",
  },
  update: {},
});

const alheio = await prisma.project.upsert({
  where: { organizationId_code: { organizationId: "org-fantasma", code: "999-99" } },
  create: {
    organizationId: "org-fantasma",
    code: "999-99",
    name: "Projeto de outro escritório",
    client: "OUTRA",
    ownerEmail: "ninguem@fantasma.com",
  },
  update: {},
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
page.setDefaultTimeout(25000);

await entrarComo(page, "victor@prosul.com");

// 1. A prova de vida.
const lista = await page.request.get("/api/projects");
const corpo = await lista.json().catch(() => ({}));
const codigos = (corpo.projects ?? []).map((p) => p.code);
check(
  "Victor (MEMBER) ve o 063-26 da PROSUL",
  codigos.includes("063-26"),
  `veio [${codigos.join(", ")}]`,
);

// 2. E vê na TELA, não só na API: a listagem é o que ele usa.
await page.goto("/projetos");
await page.waitForLoadState("networkidle");
const naTela = await page
  .getByText("063-26", { exact: false })
  .first()
  .isVisible()
  .catch(() => false);
check("e o 063-26 aparece na tela de projetos", naTela);

// 3. O isolamento entre escritórios.
const doFantasma = await page.request.get(`/api/projects/${alheio.id}`);
check(
  "projeto de outro escritorio nao e legivel",
  doFantasma.status() === 404,
  `status ${doFantasma.status()}`,
);
check(
  "e o 999-99 nao entra na lista da PROSUL",
  !codigos.includes("999-99"),
  `veio [${codigos.join(", ")}]`,
);

// 4. Sem sessão não passa.
const anonimo = await browser.newContext({ baseURL: BASE });
const semSessao = await anonimo.request.get("/api/projects");
check(
  "sem sessao a listagem recusa",
  semSessao.status() === 401,
  `status ${semSessao.status()}`,
);

// 5. Sessão válida sem escritório ATIVO não lê nada.
//
//    Esta asserção media DOIS casos numa só — "quem foi desligado" e "quem nunca
//    foi convidado" — e em 14/08/2026 o segundo deixou de valer por decisão do
//    mantenedor: desconhecido que entra vira MEMBER da PROSUL sozinho. O caso do
//    desligado sobreviveu inteiro, e é ele que fica aqui: o vínculo existe e
//    está DISABLED, que é o estado em que a pessoa saiu do escritório.
//
//    A porta que a decisão abriu tem prova própria, com as travas:
//    `prova-escritorio-automatico.mjs`.
await prisma.organizationMember.deleteMany({ where: { email: "estranho@fora.com" } });
await prisma.organizationMember.create({
  data: {
    organizationId: ORG,
    email: "estranho@fora.com",
    role: "MEMBER",
    status: "DISABLED",
  },
});
const ctxEstranho = await browser.newContext({ baseURL: BASE });
const pEstranho = await ctxEstranho.newPage();
pEstranho.setDefaultTimeout(25000);
await entrarComo(pEstranho, "estranho@fora.com");
const doEstranho = await pEstranho.request.get("/api/projects");
check(
  "sessao valida sem escritorio ativo nao le nada",
  doEstranho.status() === 403,
  `status ${doEstranho.status()}`,
);

// O ciclo do convite (INVITED que vira ACTIVE no primeiro login) tem prova
// própria: `prova-convite.mjs`. Aqui ele só confundiria as duas perguntas.

await browser.close();
console.log(falhas === 0 ? "\nOK  escritorio" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
