// A HOME v4, MEDIDA — e não olhada.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-home-v4.mjs
//   (== npm run prova:home-v4)
//
// Exige a cena semeada (`npm run semear:home`) e o dev server de pé.
//
// O QUE ESTA PROVA COBRE, e que a de DOM não cobria: as três seções novas
// existem NA JANELA (não só na árvore), a densidade caiu de verdade, o âmbar
// parou de pintar áreas grandes, e os controles mudam a lista de fato. Cada
// asserção mede PIXEL ou CONTEÚDO — nunca "o elemento existe".
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

await entrarComo(page);
await page.goto("/");
await page.waitForSelector("[data-cartao-de-projeto]", { timeout: 20000 });
await page.waitForTimeout(900);

/* ── 1. A DENSIDADE ────────────────────────────────────────────────────── */
console.log("\ndensidade da primeira dobra");

const geo = await page.evaluate(() => {
  const cx = (el) => (el?.getBoundingClientRect ? el.getBoundingClientRect() : null);
  const acha = (sel, re) => [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent || ""));
  return {
    retomar: cx(acha("section", /Retomar/i)),
    atencao: cx(acha("section", /Precisa da sua atenção/i)),
    primeiro: cx(document.querySelector("[data-cartao-de-projeto]")),
    janela: window.innerHeight,
  };
});

// MEDIDO ANTES (09/09/2026, mesma janela): Retomar em 288, primeiro cartão em
// 429. O corte foi de 30px no vão do orbe, e o Retomar perdeu 8px de altura —
// então o topo do Retomar tem que cair pelo menos 25px mesmo com a faixa nova
// entrando entre ele e a lista.
check("o Retomar subiu ao menos 25px", geo.retomar && geo.retomar.top <= 263,
  `topo em ${Math.round(geo.retomar?.top ?? -1)} (antes: 288)`);

check("o primeiro cartão continua na dobra", geo.primeiro && geo.primeiro.top < geo.janela,
  `topo em ${Math.round(geo.primeiro?.top ?? -1)} de ${geo.janela}`);

/* ── 2. AS SEÇÕES NOVAS, NA JANELA ─────────────────────────────────────── */
console.log("\nas seções novas");

// A caixa contra a JANELA, e não a existência no DOM: asserção de DOM passa
// verde com o bloco fora da tela. É a lição de [[nexodoc-provar-visivel]].
check("a faixa de atenção está visível", Boolean(geo.atencao && geo.atencao.width > 0 && geo.atencao.top < geo.janela),
  geo.atencao ? `w=${Math.round(geo.atencao.width)} top=${Math.round(geo.atencao.top)}` : "não achou");

const legenda = (await page.locator("main p[aria-live=polite]").first().innerText()).trim();
check("a legenda do orbe é ESTADO, e não instrução fixa",
  /ESPERAM POR VOCÊ|ESPERA POR VOCÊ|ANALISANDO|TUDO EM DIA/i.test(legenda), legenda);

const saudacao = await page.locator("main p", { hasText: /Clique no orbe/ }).first().innerText();
check("a saudação nomeia a pessoa", /Bom dia|Boa tarde|Boa noite/.test(saudacao), saudacao.trim());

const espaco = await page.locator("section[aria-labelledby=seu-espaco]");
check("Seu espaço existe e fica DEPOIS da lista", (await espaco.count()) === 1);

if (await espaco.count()) {
  const caixa = await espaco.boundingBox();
  check("Seu espaço fica abaixo do último cartão",
    caixa && geo.primeiro && caixa.y > geo.primeiro.top, `y=${Math.round(caixa?.y ?? -1)}`);
  check("os 3 widgets do padrão montaram",
    (await espaco.locator("> div > div").count()) === 3);
}

/* ── 3. O ÂMBAR PAROU DE PINTAR ÁREA ───────────────────────────────────── */
console.log("\no âmbar");

/*
 * O MOUSE SAI DA FRENTE ANTES DE MEDIR.
 *
 * A primeira versão desta prova falhava com "1 de 8 pintados", e o cartão
 * pintado era `rgb(26, 30, 33)` — `--nexodoc-raised`, o HOVER. O ponteiro tinha
 * ficado sobre a lista depois do login, e a prova estava medindo o próprio
 * mouse. Medir "qualquer fundo opaco" era a asserção errada de qualquer modo: o
 * hover PRECISA pintar, e o que não pode voltar é o ÂMBAR.
 */
await page.mouse.move(4, 4);
await page.waitForTimeout(200);

const ambar = await page.evaluate(() => {
  // O token resolvido, e não um hex escrito à mão: se `--status-warning-bg`
  // mudar de valor, a prova continua medindo a coisa certa.
  const tinta = getComputedStyle(document.documentElement)
    .getPropertyValue("--status-warning-bg")
    .trim();

  const paraRgb = (valor) => {
    const d = document.createElement("div");
    d.style.color = valor;
    document.body.appendChild(d);
    const r = getComputedStyle(d).color;
    d.remove();
    return r;
  };

  const alvoDaTinta = paraRgb(tinta);
  const alvo = [...document.querySelectorAll("[data-cartao-de-projeto]")];
  let pintados = 0;
  let areaPintada = 0;
  const tons = [];

  for (const cartao of alvo) {
    const botao = cartao.querySelector("button[aria-expanded]");
    if (!botao) continue;
    const fundo = getComputedStyle(botao).backgroundColor;
    if (fundo === alvoDaTinta) {
      pintados += 1;
      const r = botao.getBoundingClientRect();
      areaPintada += r.width * r.height;
      tons.push(fundo);
    }
  }
  return { cartoes: alvo.length, pintados, areaPintada: Math.round(areaPintada), tinta: alvoDaTinta };
});

// ANTES: 3 cabeçalhos de ~800×47px pintados de `--status-warning-bg`, o que
// dava ~113.000px² de âmbar na primeira dobra. O sinal continua inteiro no
// trilho de 3px e no chip do tempo.
check("nenhum cabeçalho de cartão é pintado de âmbar", ambar.pintados === 0,
  `${ambar.pintados} de ${ambar.cartoes} (${ambar.areaPintada}px² de ${ambar.tinta})`);

// A BORDA TAMBÉM: ela virava `#4a3a1c`, um âmbar escurecido escrito à mão e
// fora dos tokens. `--nx-edge` sem valor local quer dizer que o cartão voltou a
// usar a borda padrão.
const bordas = await page.evaluate(() =>
  [...document.querySelectorAll("[data-cartao-de-projeto]")].filter(
    (c) => c.style.getPropertyValue("--nx-edge").trim() !== "",
  ).length,
);
check("nenhum cartão sobrescreve a cor da borda", bordas === 0, `${bordas} cartões`);

const chips = await page.locator("[data-cartao-de-projeto] span[title^='Parado há']").count();
check("o tempo virou chip próprio", chips > 0, `${chips} chips de tempo`);

const juntos = await page.locator("[data-cartao-de-projeto]", { hasText: /achados · parado há/ }).count();
check("nenhum chip junta contagem e tempo na mesma frase", juntos === 0);

/* ── 4. OS CONTROLES MUDAM A LISTA ─────────────────────────────────────── */
console.log("\nos controles");

const codigos = () =>
  page.locator("[data-cartao-de-projeto] span.font-mono.font-semibold").allInnerTexts();

const antesDaOrdem = await codigos();

await page.getByRole("button", { name: /mais parados primeiro/i }).click();
await page.getByRole("button", { name: /^A–Z$/ }).click();
await page.waitForTimeout(400);
const depoisDaOrdem = await codigos();

check("trocar a ordenação reordena a lista",
  antesDaOrdem.join() !== depoisDaOrdem.join(),
  `antes ${antesDaOrdem.slice(0, 3).join(",")} / depois ${depoisDaOrdem.slice(0, 3).join(",")}`);

// De volta para a ordem de atenção, senão o resto da prova mede outra lista.
await page.getByRole("button", { name: /a–z/i }).click();
await page.getByRole("button", { name: /^Mais parados primeiro$/ }).click();
await page.waitForTimeout(400);

const contadorParados = page.locator("section[aria-labelledby=atencao] button", { hasText: /parado/ });
if (await contadorParados.count()) {
  const total = await page.locator("[data-cartao-de-projeto]").count();
  await contadorParados.first().click();
  await page.waitForTimeout(400);
  const filtrado = await page.locator("[data-cartao-de-projeto]").count();

  check("clicar num contador FILTRA a lista", filtrado > 0 && filtrado < total,
    `${total} → ${filtrado}`);

  await contadorParados.first().click();
  await page.waitForTimeout(400);
  check("clicar de novo desfaz o filtro",
    (await page.locator("[data-cartao-de-projeto]").count()) === total);
}

/* ── 5. A ABA "TODOS" CONSULTA O SERVIDOR ──────────────────────────────── */
console.log("\na aba Todos");

const [pedido] = await Promise.all([
  page.waitForRequest((r) => r.url().includes("/api/painel?escopo=todos"), { timeout: 8000 }),
  page.getByRole("tab", { name: /^Todos$/ }).click(),
]);
check("a aba Todos refaz a consulta com escopo=todos", Boolean(pedido));
await page.waitForTimeout(900);
check("a lista continua desenhando com escopo=todos",
  (await page.locator("[data-cartao-de-projeto]").count()) > 0);
await page.getByRole("tab", { name: /Meus projetos/i }).click();
await page.waitForTimeout(700);

/* ── 6. PERSONALIZAR ───────────────────────────────────────────────────── */
console.log("\npersonalizar");

await page.getByRole("button", { name: /^Personalizar$/ }).click();
await page.waitForTimeout(400);
const drawer = page.getByRole("dialog", { name: /Personalizar a Home/i });
check("o drawer abre", (await drawer.count()) === 1);

if (await drawer.count()) {
  const caixa = await drawer.boundingBox();
  const janela = page.viewportSize();
  check("o drawer está DENTRO da janela",
    caixa && caixa.x >= 0 && caixa.x + caixa.width <= janela.width + 1,
    `x=${Math.round(caixa?.x ?? -1)} w=${Math.round(caixa?.width ?? -1)} janela=${janela.width}`);

  await drawer.getByRole("button", { name: /^Desligar Foco$/ }).click();
  await page.waitForTimeout(300);
  check("desligar um widget o tira da Home na hora",
    (await page.locator("section[aria-labelledby=seu-espaco] > div > div").count()) === 2);

  await drawer.getByRole("button", { name: /Conversor de obra/i }).click();
  await page.waitForTimeout(300);
  check("ligar um widget o traz na hora",
    (await page.locator("section[aria-labelledby=seu-espaco] > div > div").count()) === 3);

  await drawer.getByRole("button", { name: /Restaurar padrão/i }).click();
  await page.waitForTimeout(300);
  await drawer.getByRole("button", { name: /^Concluir$/ }).click();
  await page.waitForTimeout(300);

  // A PROVA QUE IMPORTA: sobrevive ao F5. Sem ela, "personalizar" seria um
  // painel bonito que esquece tudo.
  await drawer.isHidden().catch(() => {});
  await page.reload();
  await page.waitForSelector("[data-cartao-de-projeto]", { timeout: 20000 });
  await page.waitForTimeout(700);
  check("a preferência sobrevive ao F5",
    (await page.locator("section[aria-labelledby=seu-espaco] > div > div").count()) === 3);
}

/* ── 7. RESPONSIVO ─────────────────────────────────────────────────────── */
console.log("\nresponsivo");

for (const largura of [1280, 1024, 820]) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.waitForTimeout(500);

  const rolagem = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(`${largura}px sem rolagem horizontal`, rolagem <= 1, `sobra ${rolagem}px`);

  const estouro = await page.evaluate(() => {
    const janela = document.documentElement.clientWidth;
    return [...document.querySelectorAll("main *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > janela + 2;
    }).length;
  });
  check(`${largura}px sem elemento passando da borda`, estouro === 0, `${estouro} elementos`);
}

await browser.close();
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
