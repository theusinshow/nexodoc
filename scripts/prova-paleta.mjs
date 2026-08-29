// A PALETA DE COMANDOS — sem token.
//
//   node scripts/prova-paleta.mjs   (== npm run prova:paleta)
//
// A lista de acoes e o filtro sao provados sem navegador (`npm run
// test:paleta`). Aqui se mede o que so a tela responde: `Ctrl+K` abre de
// verdade, a busca acha a CONVERSA pelo nome, o Enter leva ao lugar certo, e
// `Esc` fecha sem deixar nada para tras.
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

// Uma conversa com nome procuravel — sem ela, a metade "buscar obra" da paleta
// nao teria o que achar.
await semearCanvas(page, {
  conversationId: "qa-paleta",
  titulo: "QA PALETA DA OBRA VILA NOVA",
  folhas: FOLHAS_DE_PROVA,
});

const paleta = page.locator("[data-paleta]");
check("a paleta comeca fechada", (await paleta.count()) === 0);

await page.keyboard.press("Control+k");
await page.waitForTimeout(500);
check("Ctrl+K abre a paleta", (await paleta.count()) === 1);

const itens = page.locator("[data-item-da-paleta]");
check(
  "sem texto ela ja mostra as acoes — quem apertou sem saber o que quer ve o indice",
  (await itens.count()) >= 3,
  `${await itens.count()}`,
);
const primeiros = (await itens.allInnerTexts()).join(" | ");
check(
  "com as partidas no topo",
  /montar um volume/i.test(primeiros),
  primeiros.slice(0, 160),
);
check(
  "e nenhuma acao destrutiva na lista",
  !/apagar|excluir|remover|deletar/i.test(primeiros),
  primeiros.slice(0, 200),
);

// --- Buscar a conversa pelo nome da obra.
await page.keyboard.type("vila nova");
await page.waitForTimeout(600);
const comBusca = (await itens.allInnerTexts()).join(" | ");
check(
  "a busca acha a conversa pelo nome da obra",
  /VILA NOVA/i.test(comBusca),
  comBusca.slice(0, 200),
);

// --- Esc fecha e nao deixa texto para tras.
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Esc fecha a paleta", (await paleta.count()) === 0);
await page.keyboard.press("Control+k");
await page.waitForTimeout(500);
check(
  "e ao reabrir o campo esta limpo — a busca de ontem nao volta",
  (await page.locator("[data-paleta] input").inputValue()) === "",
);

// --- Enter numa PARTIDA escreve no composer (e nao navega para lugar nenhum).
await page.keyboard.type("auditar");
await page.waitForTimeout(500);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
check("a paleta fecha ao escolher", (await paleta.count()) === 0);
check(
  "e a partida escolhida chega escrita no composer",
  (await page.locator("textarea").first().inputValue()).includes(
    "audita o memorial",
  ),
  await page.locator("textarea").first().inputValue(),
);
check("sem sair do Nexo", page.url().includes("/nexo"), page.url());

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({ path: `${process.env.SHOT_DIR ?? "."}/paleta.png` });
await browser.close();
console.log(falhas === 0 ? "\nPROVA DA PALETA OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
