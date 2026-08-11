/**
 * PROVA: o chanfro existe, tem contorno e mostra foco.
 *
 * Tres coisas que uma asserção de DOM nao pega e que ja quebraram este projeto:
 *   - `clip-path` que nao aplicou volta "none", nao volta erro;
 *   - o miolo do contorno pintado ATRAS do fundo some sem avisar;
 *   - o anel de foco recortado deixa o controle sem foco visivel nenhum.
 * Por isso tudo aqui e medido no estilo computado, nao no markup.
 *
 * Nao gasta token: nao dispara nenhuma chamada de IA.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";

const falhas = [];
function conferir(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`OK    ${nome}`);
  } else {
    falhas.push(`${nome} — ${detalhe}`);
    console.log(`FALHA ${nome} — ${detalhe}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
}
await page.waitForLoadState("networkidle").catch(() => {});

// --- 1. Os seis cortes aplicaram ---
for (const n of [4, 5, 6, 7, 8, 12]) {
  const clip = await page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)).clipPath,
    `[data-prova="cut-${n}"]`,
  );
  conferir(
    `nx-cut-${n} aplica clip-path`,
    clip.includes("polygon") && clip.includes(`${n}px`),
    `veio "${clip}"`,
  );
}

// --- 2. O contorno e uma camada visivel, nao uma borda ---
for (const n of [5, 6, 7, 8]) {
  const m = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const fora = getComputedStyle(el);
    const dentro = getComputedStyle(el, "::before");
    return {
      clipFora: fora.clipPath,
      clipDentro: dentro.clipPath,
      bgFora: fora.backgroundColor,
      bgDentro: dentro.backgroundColor,
      inset: dentro.insetBlockStart || dentro.top,
      z: dentro.zIndex,
      isolation: fora.isolation,
      conteudo: dentro.content,
    };
  }, `[data-prova="edge-${n}"]`);

  conferir(`nx-edge-${n}: o ::before existe`, m.conteudo !== "none", `content=${m.conteudo}`);
  conferir(`nx-edge-${n}: ambas as formas recortadas`, m.clipFora.includes("polygon") && m.clipDentro.includes("polygon"), `fora=${m.clipFora} dentro=${m.clipDentro}`);
  conferir(`nx-edge-${n}: borda e miolo tem cores diferentes`, m.bgFora !== m.bgDentro, `ambos ${m.bgFora}`);
  conferir(`nx-edge-${n}: miolo a 1px`, m.inset === "1px", `veio ${m.inset}`);
  // Sem isolation, o z-index -1 cai ATRAS do fundo e o miolo some.
  conferir(`nx-edge-${n}: miolo abaixo do conteudo e acima do fundo`, m.z === "-1" && m.isolation === "isolate", `z=${m.z} isolation=${m.isolation}`);
}

// --- 3. O foco e por dentro, e o ring global se desligou ---
// Chegar pelo TECLADO, nao por .focus(): foco programatico num <button> nao casa
// `:focus-visible` no Chromium, e a medida passaria verde sem nada estar em foco.
await page.locator('[data-prova="foco-antes"]').focus();
await page.keyboard.press("Tab");
const focado = await page.evaluate(() => document.activeElement?.dataset?.prova);
conferir("o Tab chegou no alvo", focado === "foco-alvo", `foco em "${focado}"`);
// O miolo TRANSICIONA de 1px para 3px em --duration-fast. Medir no instante do
// Tab pega o valor de partida, e a falha parece do CSS quando e do relogio.
await page.waitForTimeout(300);
const foco = await page.evaluate(() => {
  const el = document.querySelector('[data-prova="foco-alvo"]');
  const fora = getComputedStyle(el);
  const dentro = getComputedStyle(el, "::before");
  return { bg: fora.backgroundColor, sombra: fora.boxShadow, inset: dentro.insetBlockStart || dentro.top };
});
conferir("foco: o miolo recua para 3px", foco.inset === "3px", `veio ${foco.inset}`);
conferir("foco: a moldura vira --ring", foco.bg === "rgb(91, 218, 198)", `veio ${foco.bg}`);
// Se o ring global sobrevivesse, ele seria recortado e o foco sumiria.
conferir("foco: o ring global de box-shadow se desligou", foco.sombra === "none", `veio ${foco.sombra}`);

// --- 4. As tres alturas coexistem e o CSS global nao forca 40px ---
const alturas = await page.evaluate(() =>
  ["btn-lg", "btn-default", "btn-sm"].map((p) => {
    const el = document.querySelector(`[data-prova="${p}"]`);
    return { p, h: Math.round(el.getBoundingClientRect().height), clip: getComputedStyle(el).clipPath };
  }),
);
conferir("botao 44 (size lg)", alturas[0].h === 44, `veio ${alturas[0].h}px`);
conferir("botao 40 (size default)", alturas[1].h === 40, `veio ${alturas[1].h}px`);
conferir("botao 32 (size sm)", alturas[2].h === 32, `veio ${alturas[2].h}px`);
for (const { p, clip } of alturas) {
  conferir(`${p} recortado`, clip.includes("polygon"), `veio ${clip}`);
}

// A lamina so aparece no hover -- em repouso ela esta fora da caixa.
const laminaRepouso = await page.evaluate(
  () => getComputedStyle(document.querySelector('[data-prova="btn-lg"]'), "::after").transform,
);
conferir("lamina existe como matriz de transformacao", laminaRepouso.startsWith("matrix"), `veio ${laminaRepouso}`);

await page.locator('[data-prova="btn-lg"]').hover();
await page.waitForTimeout(400);
const laminaHover = await page.evaluate(
  () => getComputedStyle(document.querySelector('[data-prova="btn-lg"]'), "::after").transform,
);
conferir("a lamina se move no hover", laminaHover !== laminaRepouso, `parada em ${laminaHover}`);

// --- 5. Cartao: com contorno vira camada, chapado continua uma forma so ---
const cartoes = await page.evaluate(() => {
  const ler = (p) => {
    const el = document.querySelector(`[data-prova="${p}"]`);
    return {
      clip: getComputedStyle(el).clipPath,
      raio: getComputedStyle(el).borderTopLeftRadius,
      antes: getComputedStyle(el, "::before").content,
    };
  };
  return { card: ler("card"), flat: ler("card-flat") };
});
conferir("card recortado", cartoes.card.clip.includes("polygon"), `veio ${cartoes.card.clip}`);
conferir("card sem raio", cartoes.card.raio === "0px", `veio ${cartoes.card.raio}`);
conferir("card com contorno tem a camada", cartoes.card.antes !== "none", "sem ::before");
conferir("card chapado recortado", cartoes.flat.clip.includes("polygon"), `veio ${cartoes.flat.clip}`);
// Camada externa sem necessidade e desperdicio: chapado e uma div so.
conferir("card chapado NAO tem camada", cartoes.flat.antes === "none", "criou ::before a toa");

// --- 6. Campo: wrapper real, porque input nativo nao renderiza ::before ---
await page.locator('[data-prova="input"]').focus();
await page.waitForTimeout(300);
const campo = await page.evaluate(() => {
  const el = document.querySelector('[data-prova="input"]');
  const wrap = el.closest(".nx-edge-7");
  return {
    temWrapper: Boolean(wrap),
    clip: wrap ? getComputedStyle(wrap).clipPath : "sem wrapper",
    raioDoCampo: getComputedStyle(el).borderTopLeftRadius,
    sombraDoCampo: getComputedStyle(el).boxShadow,
    focoNoWrapper: wrap ? getComputedStyle(wrap).backgroundColor : null,
    insetDoMiolo: wrap ? getComputedStyle(wrap, "::before").insetBlockStart : null,
  };
});
conferir("campo tem wrapper recortado", campo.temWrapper && campo.clip.includes("polygon"), `veio ${campo.clip}`);
conferir("campo sem raio proprio", campo.raioDoCampo === "0px", `veio ${campo.raioDoCampo}`);
// Se o ring global sobrevivesse aqui, ele apareceria como retangulo FORA do chanfro.
conferir("campo sem ring de box-shadow", campo.sombraDoCampo === "none", `veio ${campo.sombraDoCampo}`);
conferir("o foco do campo acende o wrapper", campo.focoNoWrapper === "rgb(91, 218, 198)", `veio ${campo.focoNoWrapper}`);
conferir("o miolo do campo recua no foco", campo.insetDoMiolo === "3px", `veio ${campo.insetDoMiolo}`);

// --- 7. Chip e badge ---
const chipeBadge = await page.evaluate(() => {
  const ler = (p) => {
    const el = document.querySelector(`[data-prova="${p}"]`);
    const s = getComputedStyle(el);
    return { clip: s.clipPath, raio: s.borderTopLeftRadius, borda: s.borderTopWidth, antes: getComputedStyle(el, "::before").content };
  };
  return { chip: ler("chip"), badge: ler("badge"), badgeOk: ler("badge-ok") };
});
conferir("chip com corte 6", chipeBadge.chip.clip.includes("6px"), `veio ${chipeBadge.chip.clip}`);
conferir("chip perdeu a pilula", chipeBadge.chip.raio === "0px", `veio ${chipeBadge.chip.raio}`);
conferir("chip com contorno em camada", chipeBadge.chip.antes !== "none", "sem ::before");
conferir("badge com corte 5", chipeBadge.badge.clip.includes("5px"), `veio ${chipeBadge.badge.clip}`);
/* Badge e uma forma so: as 10 variantes tem fundo E borda TRANSLUCIDOS, e numa
   camada o miolo comporia sobre a cor da borda em vez de sobre a pagina --
   toda variante de status mudaria de cor. */
conferir("badge NAO usa camada", chipeBadge.badge.antes === "none", "criou ::before");
conferir("badge sem borda", chipeBadge.badgeOk.borda === "0px", `veio ${chipeBadge.badgeOk.borda}`);

await browser.close();
console.log(`\n=== ${falhas.length === 0 ? "PASSOU" : `${falhas.length} FALHA(S)`} ===`);
if (falhas.length) for (const f of falhas) console.log(`  · ${f}`);
process.exit(falhas.length ? 1 : 0);
