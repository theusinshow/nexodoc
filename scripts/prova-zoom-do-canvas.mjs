// O ZOOM SEMANTICO: o no conta menos de longe e o carimbo inteiro de perto.
//
//   node scripts/prova-zoom-do-canvas.mjs   (== npm run prova:zoom)
//
// Os tres niveis e o que cabe em cada um sao provados sem navegador
// (`npm run test:densidade`). O que so o navegador responde: o zoom do canvas
// REALMENTE atravessa os limiares, o texto some e volta, e a marca de corrigido
// a mao sobrevive aos tres — que e a unica coisa que a varredura de longe nao
// pode perder.
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
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(600);

await semearCanvas(page, {
  conversationId: "qa-zoom-do-canvas",
  titulo: "QA ZOOM DO CANVAS",
  folhas: FOLHAS_DE_PROVA,
});

const folhas = page.locator(".react-flow__node-folha");
check(
  "as folhas estao no canvas",
  (await folhas.count()) === 4,
  `${await folhas.count()}`,
);
if ((await folhas.count()) === 0) {
  await browser.close();
  process.exit(1);
}

/** O zoom que o React Flow aplica vive na matriz do viewport. */
const zoomAtual = () =>
  page.$eval(".react-flow__viewport", (el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return m.a;
  });

/** Leva o canvas a um zoom alvo apertando os atalhos que ele já tinha. */
async function irAte(alvo, tecla) {
  for (let i = 0; i < 30; i++) {
    const z = await zoomAtual();
    if ((tecla === "-" && z <= alvo) || (tecla === "+" && z >= alvo)) return z;
    await page.keyboard.press(tecla);
    await page.waitForTimeout(160);
  }
  return zoomAtual();
}

const primeira = folhas.first();
const textoDaFolha = () => primeira.innerText();

// --- O nivel do MEIO, que e onde o canvas abre.
await page
  .locator('[role="application"]')
  .first()
  .click({ position: { x: 8, y: 8 } });
await page.waitForTimeout(300);
const zMedio = await zoomAtual();
check(
  "o canvas abre num zoom da faixa do meio",
  zMedio >= 0.55 && zMedio < 1.05,
  `${zMedio}`,
);
check(
  "e nele o titulo do desenho aparece",
  /planta baixa/i.test(await textoDaFolha()),
  JSON.stringify(await textoDaFolha()),
);
check(
  "mas o codigo do arquivo ainda nao",
  !/qa_arq_001_a/i.test(await textoDaFolha()),
  JSON.stringify(await textoDaFolha()),
);

// --- LONGE: o no vira padrao.
const zLonge = await irAte(0.5, "-");
check("o canvas chega a faixa de longe", zLonge < 0.55, `${zLonge}`);
const deLonge = await textoDaFolha();
check(
  "de longe o titulo do desenho SAI",
  !/planta baixa/i.test(deLonge),
  JSON.stringify(deLonge),
);
check(
  "e a sigla da disciplina tambem",
  !/ARQ/.test(deLonge),
  JSON.stringify(deLonge),
);
check(
  "mas o NUMERO fica — sem ele a fileira vira mancha sem ordem",
  /01/.test(deLonge),
  JSON.stringify(deLonge),
);

// --- PERTO: o carimbo inteiro.
const zPerto = await irAte(1.1, "+");
check("o canvas chega a faixa de perto", zPerto >= 1.05, `${zPerto}`);
const dePerto = await textoDaFolha();
check(
  "de perto o codigo do arquivo aparece",
  /qa_arq_001_a/i.test(dePerto),
  JSON.stringify(dePerto),
);
check(
  "e a disciplina por extenso",
  /arquitetura/i.test(dePerto),
  JSON.stringify(dePerto),
);
check(
  "com o titulo junto",
  /planta baixa/i.test(dePerto),
  JSON.stringify(dePerto),
);

// --- A MARCA DE CORRIGIDO A MAO sobrevive aos tres niveis.
//
// E o unico aviso de que aquele valor veio de uma pessoa, e nao do carimbo.
// Some-la de longe faria a varredura mentir justamente sobre o que a maquina
// nao leu — por isso ela e medida no zoom em que TODO o resto sumiu.
await page
  .locator('[role="application"]')
  .first()
  .click({ position: { x: 8, y: 8 } });
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
await page.keyboard.press("e");
await page.waitForTimeout(700);
const numero = page.locator('input[inputmode="numeric"]').first();
if (await numero.count()) {
  await numero.fill("07");
  await page
    .locator("form button[type=submit]")
    .first()
    .click()
    .catch(async () => {
      await page.keyboard.press("Enter");
    });
  await page.waitForTimeout(900);
}
const marcado = page.locator(
  '.react-flow__node-folha [title="corrigido à mão"]',
);
check(
  "a folha corrigida ganhou a marca",
  (await marcado.count()) >= 1,
  `${await marcado.count()}`,
);

const zLonge2 = await irAte(0.5, "-");
check(
  "e no zoom de longe ela CONTINUA la",
  (await marcado.count()) >= 1,
  `zoom ${zLonge2}`,
);

// A GRADE FICA REGULAR de longe: o nó selecionado não pode ficar três vezes
// mais alto que os vizinhos por causa de botões que ninguém consegue ler ali.
const alturas = await page.$$eval(".react-flow__node-folha", (ns) =>
  ns.map((n) => Math.round(n.getBoundingClientRect().height)),
);
check(
  "e a grade continua regular — o no selecionado nao vira escada",
  Math.max(...alturas) - Math.min(...alturas) <= 2,
  `alturas ${alturas.join(", ")}`,
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({
  path: `${process.env.SHOT_DIR ?? "."}/zoom-do-canvas.png`,
});
await browser.close();
console.log(falhas === 0 ? "\nPROVA DO ZOOM OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
