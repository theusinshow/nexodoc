// CONFERIR UM LOTE SEM TIRAR A MAO DO TECLADO.
//
//   node scripts/prova-teclado-do-canvas.mjs   (== npm run prova:teclado)
//
// A decisao de "qual no a seta seleciona" e provada sem navegador
// (`npm run test:teclado`). O que so o navegador responde e o resto: a tecla
// CHEGA ao canvas, o formulario de correcao abre pelo `E` — e, sobretudo, a
// seta continua sendo da PESSOA QUE ESTA ESCREVENDO quando o foco esta no
// compositor da conversa.
//
// Usa o projeto de exemplo, que a primeira visita semeia: ele traz folhas de
// verdade no canvas, sem custar token nenhum.
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
  viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

await entrarComo(page, "victor@prosul.com");
await page.goto("/nexo");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);

// O tour de 11 passos intercepta clique e da timeout de 30s sem explicar por que.
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(600);

// O cenário mora em `lib/semear-canvas.mjs`: a prova do zoom usa o MESMO, e
// duas cópias dele mediriam telas diferentes achando que medem a mesma.
await semearCanvas(page, {
  conversationId: "qa-teclado-do-canvas",
  titulo: "QA TECLADO DO CANVAS",
  folhas: FOLHAS_DE_PROVA,
});

const canvas = page.locator('[role="application"]').first();
check("o canvas do volume esta na tela", (await canvas.count()) === 1);

const folhas = page.locator(".react-flow__node");
const quantas = await folhas.count();
check("com folhas para percorrer", quantas >= 2, `${quantas} nos`);
if (quantas < 2) {
  await browser.close();
  console.log("\nsem folhas — rode o projeto de exemplo antes");
  process.exit(1);
}

const selecionados = () =>
  page.$$eval(".react-flow__node.selected", (ns) =>
    ns.map((n) => n.getAttribute("data-id")),
  );

// --- A seta anda.
await canvas.focus();
check(
  "o canvas recebe foco",
  await canvas.evaluate((el) => el === document.activeElement),
);

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
const primeiro = await selecionados();
check(
  "a primeira seta seleciona um no",
  primeiro.length === 1,
  JSON.stringify(primeiro),
);

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
const segundo = await selecionados();
check(
  "a seguinte anda para o proximo",
  segundo.length === 1 && segundo[0] !== primeiro[0],
  JSON.stringify(segundo),
);

await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(400);
const voltou = await selecionados();
check(
  "e a seta contraria volta para o mesmo no",
  voltou[0] === primeiro[0],
  JSON.stringify(voltou),
);

// --- A dica aparece com o foco, e nao antes.
check(
  "a dica dos atalhos aparece quando o canvas tem foco",
  await page.locator("text=setas andam").first().isVisible(),
);

// --- `E` abre a correcao, JA PREENCHIDA.
//
// Este e o defeito que a mudanca de estado corrigiu: os campos eram semeados no
// clique do botao, e um formulario aberto por outro caminho nasceria em branco —
// salvar apagaria o que o carimbo tinha lido certo.
let achouFolha = false;
for (let i = 0; i < quantas + 2; i++) {
  const atual = await selecionados();
  const id = atual[0] ?? "";
  const eFolha = await page
    .locator(
      `.react-flow__node[data-id="${id}"] .react-flow__node-folha, [data-id="${id}"]`,
    )
    .first()
    .evaluate(
      (el) =>
        el.className.includes("folha") ||
        Boolean(el.querySelector("[data-folha]")),
    )
    .catch(() => false);
  // O tipo do no aparece na classe que o React Flow escreve.
  const tipo = await page
    .locator(`.react-flow__node[data-id="${id}"]`)
    .first()
    .getAttribute("class")
    .catch(() => "");
  if ((tipo ?? "").includes("react-flow__node-folha") || eFolha) {
    achouFolha = true;
    break;
  }
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
}
check("chegou a uma folha andando pelas setas", achouFolha);

if (achouFolha) {
  await page.keyboard.press("e");
  await page.waitForTimeout(900);
  console.log(
    "DEBUG inputs:",
    await page.locator("input").count(),
    "numeric:",
    await page.locator('input[inputmode="numeric"]').count(),
  );
  const numero = page.locator('input[inputmode="numeric"]').first();
  check("a tecla E abre a correcao do carimbo", (await numero.count()) === 1);
  if (await numero.count()) {
    /*
     * O TEXTAREA DO FORMULÁRIO, e não o último da página: o compositor da
     * conversa também é um `textarea`, e `last()` caía nele — a asserção lia
     * campo vazio e acusava o formulário de nascer em branco quando o defeito
     * era o seletor.
     */
    const titulo = page.locator("form textarea.nodrag").first();
    const valor = await titulo.inputValue();
    check(
      "e o formulario nasce PREENCHIDO com o que o carimbo dizia",
      valor.trim().length > 0,
      JSON.stringify(valor),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check(
      "Escape fecha a correcao",
      (await page.locator('input[inputmode="numeric"]').count()) === 0,
    );
  }
}

// --- `Enter` na folha SEM PDF nao promete aba nenhuma.
//
// Conversa semeada (ou restaurada de outra maquina) nao tem os bytes da
// prancha. Abrir ali seria abrir uma aba vazia — e a metade que da para provar
// sem anexar PDF de verdade e justamente esta: que ele NAO abre.
let abriuAba = false;
ctx.on("page", () => {
  abriuAba = true;
});
await canvas.focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
check("Enter numa folha sem PDF nao abre aba vazia", !abriuAba);

// --- A GUARDA: escrever no compositor nao move o canvas.
const antes = await selecionados();
const compositor = page.locator("textarea").first();
await compositor.click();
await compositor.fill("uma frase para conferir a guarda");
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(400);
const depois = await selecionados();
check(
  "a seta dentro do compositor NAO mexe na selecao do canvas",
  JSON.stringify(antes) === JSON.stringify(depois),
  `${JSON.stringify(antes)} -> ${JSON.stringify(depois)}`,
);
check(
  "e o texto digitado continua inteiro",
  (await compositor.inputValue()).includes("conferir a guarda"),
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({
  path: `${process.env.SHOT_DIR ?? "."}/teclado-do-canvas.png`,
});
await browser.close();
console.log(falhas === 0 ? "\nPROVA DO TECLADO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
