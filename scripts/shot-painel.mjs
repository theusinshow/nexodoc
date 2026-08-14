// O painel da raiz, semeado e fotografado — sem gastar um token.
//
//   node scripts/shot-painel.mjs   (== npm run shot:painel)
//
// Semeia direto no banco: auditorias, achados recebidos (um deles velho, para
// a tarja acender) e um enviado a outra pessoa. Depois entra como o dev, mede a
// tela e fotografa.
//
// A MEDIÇÃO É CONTRA A JANELA, e não contra o DOM. Asserção de presença passa
// verde com o elemento fora da tela — foi o que já aconteceu neste projeto. Aqui
// a pergunta é "a caixa está DENTRO da janela", que é o que a pessoa vê.
import fs from "node:fs";

import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const ORG = "org-prosul";

fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const eu = process.env.NEXODOC_DEV_AUTH_EMAIL?.trim().toLowerCase();
if (!eu) {
  console.error("NEXODOC_DEV_AUTH_EMAIL vazio. Sem ele nao ha quem semear.");
  process.exit(1);
}

const usuario = await prisma.user.findUnique({ where: { email: eu }, select: { id: true } });
const projetos = await prisma.project.findMany({
  where: { organizationId: ORG },
  select: { id: true, code: true },
  orderBy: { code: "asc" },
  take: 2,
});

if (!usuario || projetos.length < 2) {
  console.error("Rode 'npm run seed:dev' antes: faltam usuario ou projetos.");
  process.exit(1);
}

const dias = (n) => new Date(Date.now() - n * 86_400_000);

// Estado limpo entre execucoes: senao cada rodada empilha mais um cartao.
await prisma.auditFeedback.deleteMany({ where: { note: "semeado:shot-painel" } });
await prisma.audit.deleteMany({ where: { description: "semeado:shot-painel" } });

for (const [indice, projeto] of projetos.entries()) {
  const auditoria = await prisma.audit.create({
    data: {
      userId: usuario.id,
      projectId: projeto.id,
      title: indice === 0 ? "Memorial descritivo — drenagem" : "Volume 2 — estrutural",
      projectName: projeto.code,
      description: "semeado:shot-painel",
      status: "COMPLETED",
      auditMode: "memorial",
      analysisLevel: "padrao",
      createdAt: dias(indice === 0 ? 0 : 2),
      completedAt: dias(indice === 0 ? 0 : 2),
      totalFindings: 3,
    },
  });

  const linhas =
    indice === 0
      ? [
          { alvo: "finding:INC-001", rotulo: "Cota divergente entre planta e perfil", diasAtras: 9, para: eu },
          { alvo: "finding:INC-002", rotulo: "Unidade de medida inconsistente", diasAtras: 1, para: eu },
          { alvo: "finding:INC-003", rotulo: "Legenda fora do padrão na prancha 04", diasAtras: 3, para: "victor@prosul.com" },
        ]
      : [{ alvo: "finding:INC-001", rotulo: "Prancha sem carimbo de revisão", diasAtras: 4, para: eu }];

  for (const linha of linhas) {
    await prisma.auditFeedback.create({
      data: {
        auditId: auditoria.id,
        targetKey: linha.alvo,
        findingLabel: linha.rotulo,
        assigneeEmail: linha.para,
        assignedById: usuario.id,
        assignedAt: dias(linha.diasAtras),
        note: "semeado:shot-painel",
      },
    });
  }
}

console.log("  semeado: 2 auditorias, 3 achados para voce, 1 enviado\n");

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await entrarComo(page, eu);
await page.goto("/");
await page.waitForLoadState("networkidle");

const cartoes = page.locator("main section > div.nx-edge-8");
await cartoes.first().waitFor({ state: "visible", timeout: 15000 });

check("os cartoes de projeto aparecem", (await cartoes.count()) >= 2, `${await cartoes.count()}`);

// A tarja: o achado de 9 dias tem que estar escrito por extenso.
const tarja = page.getByText(/parado há 9 dias/);
check("a tarja de esquecimento acende", (await tarja.count()) > 0);

// O enviado aparece com a seta, e nao como trabalho seu.
const enviado = page.getByText("→ Victor", { exact: false });
check("o que voce enviou aparece com a seta", (await enviado.count()) > 0);

// O orbe, MEDIDO contra a janela.
const orbe = page.locator("aside a[href='/nexo']").first();
const caixa = await orbe.boundingBox();
const janela = page.viewportSize();

check("o orbe tem caixa", Boolean(caixa));
check(
  "e ele esta DENTRO da janela",
  Boolean(
    caixa &&
      caixa.x >= 0 &&
      caixa.y >= 0 &&
      caixa.x + caixa.width <= janela.width &&
      caixa.y + caixa.height <= janela.height,
  ),
  caixa ? `x=${Math.round(caixa.x)} y=${Math.round(caixa.y)} ${Math.round(caixa.width)}x${Math.round(caixa.height)}` : "sem caixa",
);

check(
  "o orbe tem o tamanho do desenho (250px)",
  Boolean(caixa && Math.abs(caixa.width - 250) <= 2),
  caixa ? `${Math.round(caixa.width)}px` : "",
);

// Nada pode vazar na horizontal.
const larguraDoCorpo = await page.evaluate(() => document.documentElement.scrollWidth);
check("a pagina nao rola na horizontal", larguraDoCorpo <= janela.width + 1, `${larguraDoCorpo}px`);

await page.screenshot({ path: `${OUT}/painel.png`, fullPage: true });
console.log(`\n  foto: ${OUT}/painel.png`);

// E a tela estreita, onde as tres colunas viram uma.
await page.setViewportSize({ width: 430, height: 900 });
await page.waitForTimeout(300);
const larguraEstreita = await page.evaluate(() => document.documentElement.scrollWidth);
check("no celular tambem nao rola na horizontal", larguraEstreita <= 431, `${larguraEstreita}px`);
await page.screenshot({ path: `${OUT}/painel-estreito.png`, fullPage: true });
console.log(`  foto: ${OUT}/painel-estreito.png`);

await browser.close();
await prisma.$disconnect();

if (falhas > 0) {
  console.error(`\nFALHOU  painel (${falhas})`);
  process.exit(1);
}

console.log("\nOK  painel");
