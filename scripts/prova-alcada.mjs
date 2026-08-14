// Quem cadastra projeto, e quem não cadastra.
//
//   node scripts/prova-alcada.mjs   (== npm run prova:alcada)
//
// O cadastro define o CENTRO DE CUSTO, e centro de custo errado manda a
// auditoria — e depois os achados atribuídos — para a fila de outro projeto.
// Ninguém percebe até alguém receber uma pendência que não é dele. Por isso é
// alçada, e por isso a regra vive no servidor e não no botão.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const CODIGO = "111-26";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();
await prisma.project.deleteMany({ where: { code: CODIGO } });

const browser = await chromium.launch();

// --- O projetista tenta.
const ctxVictor = await browser.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
pVictor.setDefaultTimeout(25000);
await entrarComo(pVictor, "victor@prosul.com");

const comoMembro = await pVictor.request.post("/api/projects", {
  data: { code: CODIGO, name: "Tentativa do projetista", client: "CRICIÚMA" },
});
check("MEMBER nao cadastra projeto", comoMembro.status() === 403, `status ${comoMembro.status()}`);

const criouAssimMesmo = await prisma.project.count({ where: { code: CODIGO } });
check("e nada foi gravado", criouAssimMesmo === 0, `${criouAssimMesmo} linha(s)`);

// --- A coordenação cadastra.
const ctxMilton = await browser.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
pMilton.setDefaultTimeout(25000);
await entrarComo(pMilton, "milton@prosul.com");

const comoAdmin = await pMilton.request.post("/api/projects", {
  data: { code: CODIGO, name: "Cadastro da coordenacao", client: "CRICIÚMA" },
});
check("ADMIN da org cadastra", comoAdmin.ok(), `status ${comoAdmin.status()}`);

// --- Centro de custo é obrigatório: é a identidade do projeto.
const semCodigo = await pMilton.request.post("/api/projects", {
  data: { code: "   ", name: "Sem centro de custo", client: "CRICIÚMA" },
});
check("codigo vazio e recusado", semCodigo.status() === 400, `status ${semCodigo.status()}`);

// --- O escritório vem do ator, e não do corpo da requisição.
const forjado = await pMilton.request.post("/api/projects", {
  data: {
    code: "222-26",
    name: "Tentativa de plantar em outro escritorio",
    client: "OUTRA",
    organizationId: "org-fantasma",
  },
});

if (forjado.ok()) {
  const plantado = await prisma.project.findFirst({ where: { code: "222-26" } });
  check(
    "organizationId do corpo e ignorado",
    plantado?.organizationId === "org-prosul",
    `foi para ${plantado?.organizationId}`,
  );
  await prisma.project.deleteMany({ where: { code: "222-26" } });
} else {
  check("organizationId do corpo e ignorado", false, `criacao falhou: ${forjado.status()}`);
}

await prisma.project.deleteMany({ where: { code: CODIGO } });
await browser.close();
console.log(falhas === 0 ? "\nOK  alcada" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
