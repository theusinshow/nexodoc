// AS PARTIDAS E A INTENÇÃO INICIAL — sem token.
//
//   node scripts/prova-partidas.mjs   (== npm run prova:partidas)
//
// A lista e a regra do insumo sao provadas sem navegador (`npm run
// test:partidas`). Aqui se mede o que so a tela responde: os chips aparecem na
// entrada, ESCREVEM sem enviar, somem depois da primeira mensagem — e o
// `?intencao=` chega escrito no composer, que e o que faz outra tela poder
// mandar alguem para ca ja sabendo o que veio fazer.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

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

async function conversaNova() {
  await page
    .getByRole("button", { name: /nova conversa/i })
    .first()
    .click();
  await page.waitForTimeout(1500);
}

await entrarComo(page, "victor@prosul.com");
await page.goto("/nexo");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(600);
await conversaNova();

const chips = page.locator("[data-partidas] [data-partida]");
check(
  "as tres partidas aparecem na entrada",
  (await chips.count()) === 3,
  `${await chips.count()}`,
);
check(
  "com as tres portas nomeadas",
  /montar um volume/i.test(await page.locator("[data-partidas]").innerText()) &&
    /auditar um memorial/i.test(
      await page.locator("[data-partidas]").innerText(),
    ) &&
    /conferir as folhas/i.test(
      await page.locator("[data-partidas]").innerText(),
    ),
  await page.locator("[data-partidas]").innerText(),
);

// O chip ESCREVE, e nao envia: enviar gastaria uma volta de modelo para o
// agente responder "anexe o memorial" — cobranca que nao leva a nada.
const composer = page.locator("textarea").first();
const mensagensAntes = await page.locator("[data-tour='resposta']").count();
await page.locator('[data-partida="auditar"]').click();
await page.waitForTimeout(900);
check(
  "clicar na partida ESCREVE o pedido no composer",
  (await composer.inputValue()).includes("audita o memorial"),
  await composer.inputValue(),
);
check(
  "e NAO envia — nenhuma resposta nova apareceu",
  (await page.locator("[data-tour='resposta']").count()) === mensagensAntes,
);

// --- A intencao vinda por link.
await page.goto("/nexo?intencao=montar");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3500);
const pular2 = page.getByRole("button", { name: /pular/i });
if (await pular2.count()) await pular2.first().click();
await page.waitForTimeout(800);
check(
  "`?intencao=montar` chega escrito no composer",
  (await page.locator("textarea").first().inputValue()).includes(
    "cria a LD e a capa",
  ),
  await page.locator("textarea").first().inputValue(),
);

// --- Link velho ou torto nao inventa pedido.
await page.goto("/nexo?intencao=seja-la-o-que-for");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const pular3 = page.getByRole("button", { name: /pular/i });
if (await pular3.count()) await pular3.first().click();
await page.waitForTimeout(600);
check(
  "intencao desconhecida deixa o composer em paz",
  (await page.locator("textarea").first().inputValue()).trim() === "",
  await page.locator("textarea").first().inputValue(),
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({ path: `${process.env.SHOT_DIR ?? "."}/partidas.png` });
await browser.close();
console.log(falhas === 0 ? "\nPROVA DAS PARTIDAS OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
