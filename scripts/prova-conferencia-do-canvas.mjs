// A CONFERENCIA VIRA GESTO: a coluna ao lado do mapa, sincronizada nos dois
// sentidos.
//
//   node scripts/prova-conferencia-do-canvas.mjs   (== npm run prova:conferencia)
//
// A traducao do achado agregado para a folha e provada sem navegador
// (`npm run test:conferencia-folha`), e o campo `folhas` que a torna possivel,
// em `npm run test:nexo:check`. O que so o navegador responde: a coluna aparece
// com a conta certa, o NO ganha a marca, e as duas navegacoes se encontram —
// clicar na linha seleciona o no, andar de seta move a linha.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";
import { FOLHAS_DE_PROVA, semearCanvas } from "./lib/semear-canvas.mjs";

nextEnv.loadEnvConfig(process.cwd());

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

/*
 * DUAS folhas acusadas de quatro, e de propósito: uma crítica e uma de aviso.
 * Com todas acusadas não daria para ver a coluna distinguir, e com nenhuma a
 * prova não mediria nada.
 */
const CONFERENCIA = {
  veredito: "critico",
  findings: [
    {
      severidade: "critico",
      campo: "codigo",
      mensagem:
        "Pranchas com códigos de projeto divergentes (040-26 x 999-99).",
      folhas: ["qa_arq_1.pdf"],
    },
    {
      severidade: "aviso",
      campo: "revisao",
      mensagem: "Pranchas com revisões divergentes (A x B).",
      folhas: ["qa_est_2.pdf"],
    },
    {
      severidade: "aviso",
      campo: "sequencia",
      mensagem: "Folha(s) faltando na sequência 1..5: 5.",
    },
  ],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1500, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
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
  conversationId: "qa-conferencia-do-canvas",
  titulo: "QA CONFERENCIA DO CANVAS",
  folhas: FOLHAS_DE_PROVA,
  conferencia: CONFERENCIA,
});

const coluna = page.locator('aside[aria-label="Conferência da LD"]');
check(
  "a coluna da conferencia aparece ao lado do mapa",
  (await coluna.count()) === 1,
);
if ((await coluna.count()) === 0) {
  await browser.close();
  process.exit(1);
}

const linhas = coluna.locator("li button");
check(
  "com uma linha por folha, na ordem do mapa",
  (await linhas.count()) === 4,
  `${await linhas.count()}`,
);
check(
  "e a conta diz quantas divergem — sem depender de cor",
  /2 de 4 com divergência/i.test(await coluna.innerText()),
  (await coluna.innerText()).replace(/\s+/g, " ").slice(0, 120),
);

// --- A MARCA NO NÓ. É o que a proposta pede e o que faltava: o achado agregado
// dizia "pranchas com códigos divergentes" e ninguém sabia qual prancha.
const marcados = page.locator(
  '.react-flow__node-folha [aria-label^="conferência:"]',
);
check(
  "duas folhas ganharam a marca no canvas",
  (await marcados.count()) === 2,
  `${await marcados.count()}`,
);
const rotulos = await marcados.evaluateAll((ns) =>
  ns.map((n) => n.getAttribute("aria-label")),
);
check(
  "a critica carrega o motivo dela",
  rotulos.some((r) => /códigos de projeto divergentes/i.test(r ?? "")),
  JSON.stringify(rotulos),
);
check(
  "e a de aviso, o dela",
  rotulos.some((r) => /revisões divergentes/i.test(r ?? "")),
  JSON.stringify(rotulos),
);

// A folha faltando NÃO marca ninguém: ela não está no conjunto.
check(
  "o achado de folha faltando nao acusa nenhum no",
  !rotulos.some((r) => /faltando/i.test(r ?? "")),
  JSON.stringify(rotulos),
);

// --- COLUNA -> CANVAS.
await linhas.nth(2).click();
await page.waitForTimeout(500);
const selecionadoPelaColuna = await page.$$eval(
  ".react-flow__node.selected",
  (ns) => ns.map((n) => n.getAttribute("data-id")),
);
check(
  "clicar na linha seleciona o no correspondente",
  selecionadoPelaColuna.length === 1,
  JSON.stringify(selecionadoPelaColuna),
);
check(
  "e a linha se marca como a da vez",
  (await linhas.nth(2).getAttribute("aria-current")) === "true",
);

// --- CANVAS -> COLUNA. A sincronização que faltaria se ela fosse de mão única:
// quem confere pelo teclado veria a coluna parada.
await page.locator('[role="application"]').first().focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(500);
const atual = await linhas.evaluateAll((ns) =>
  ns.findIndex((n) => n.getAttribute("aria-current") === "true"),
);
check(
  "andar de seta no canvas move a linha da coluna",
  atual === 3,
  `linha ${atual}`,
);

const selecionadoPelaSeta = await page.$$eval(
  ".react-flow__node.selected",
  (ns) => ns.map((n) => n.getAttribute("data-id")),
);
check(
  "e as duas pontas concordam sobre qual folha e",
  selecionadoPelaSeta.length === 1 &&
    selecionadoPelaSeta[0] !== selecionadoPelaColuna[0],
  `${JSON.stringify(selecionadoPelaColuna)} -> ${JSON.stringify(selecionadoPelaSeta)}`,
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({
  path: `${process.env.SHOT_DIR ?? "."}/conferencia-do-canvas.png`,
});
await browser.close();
console.log(
  falhas === 0 ? "\nPROVA DA CONFERENCIA OK" : `\n${falhas} FALHA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
