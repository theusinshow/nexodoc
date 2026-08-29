// O TRACE DO TURNO, com uma volta REAL do agente.
//
//   PROVA_PAGA=1 node scripts/prova-trace-do-turno.mjs   (== npm run prova:trace)
//
// A frase e provada sem navegador e sem token (`npm run test:trace`). O que so
// uma volta de verdade responde: os numeros que chegam a linha sao os DO TURNO
// — nao um objeto semeado que a tela desenharia igual mesmo se a ligacao
// estivesse quebrada.
//
// Custa uma chamada do fluxo `nexo-agent`: medido em 28/08/2026, media de
// US$ 0,005. O guarda existe porque ela paga modelo, e nao porque e cara.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";
import { FOLHAS_DE_PROVA, semearCanvas } from "./lib/semear-canvas.mjs";

if (process.env.PROVA_PAGA !== "1") {
  console.error("\nEsta prova PAGA MODELO. Rode com PROVA_PAGA=1.\n");
  process.exit(1);
}

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE =
  process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

const prisma = getPrisma();
const inicioDoMes = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
);
const gasto = async () =>
  (
    await prisma.aiUsageEvent.aggregate({
      _sum: { estimatedCostUsd: true },
      where: { createdAt: { gte: inicioDoMes } },
    })
  )._sum.estimatedCostUsd ?? 0;
const antes = await gasto();

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1500, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

await entrarComo(page, "victor@prosul.com");
await page.goto("/nexo");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(600);

await semearCanvas(page, {
  conversationId: "qa-trace-do-turno",
  titulo: "QA TRACE DO TURNO",
  folhas: FOLHAS_DE_PROVA,
});

// Antes de gastar: o turno semeado NAO tem trace. Sem esta asserção, a de baixo
// passaria mesmo que a tela desenhasse a linha por engano.
check(
  "a mensagem semeada nao inventa trace",
  (await page.locator("[data-trace-do-turno]").count()) === 0,
);

const composer = page.locator("textarea").first();
await composer.click();
await composer.fill("cria a LD dessas pranchas");
await page.keyboard.press("Enter");

// A volta do agente leva alguns segundos; espera-se a LINHA, não um relógio.
await page
  .locator("[data-trace-do-turno]")
  .first()
  .waitFor({ state: "visible", timeout: 90000 })
  .catch(() => {});

const traces = await page.locator("[data-trace-do-turno]").allInnerTexts();
check(
  "o turno do agente deixou o trace na conversa",
  traces.length >= 1,
  JSON.stringify(traces),
);

const linha = traces[traces.length - 1] ?? "";
check(
  "com as folhas que ele REALMENTE tinha em maos",
  /leu 4 selos/.test(linha),
  linha,
);
check("e o tempo do turno, em segundos", /\d+,\ds$/.test(linha), linha);
check(
  "sem vazar bastidor de API — nada de modelo, id ou token",
  !/gpt|model|token|req_|chatcmpl/i.test(linha),
  linha,
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({
  path: `${process.env.SHOT_DIR ?? "."}/trace-do-turno.png`,
});
await browser.close();

const depois = await gasto();
console.log(`\nESTA CORRIDA CUSTOU: US$ ${(depois - antes).toFixed(4)}`);
await prisma.$disconnect();
console.log(falhas === 0 ? "\nPROVA DO TRACE OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
