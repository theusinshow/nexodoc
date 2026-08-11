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

/* O MIOLO DO FANTASMA TEM DE FICAR OPACO NO FOCO.
   Variante transparente e o unico caso em que o anel por dentro pode falhar em
   silencio: se o ::before continuar transparente, ele nao mascara nada e a
   moldura teal preenche o botao inteiro -- vira um bloco solido com o rotulo
   cinza por cima (contraste reprovado), em vez de um anel. Nenhuma medida de
   clip-path pega isso; so a opacidade do miolo. */
await page.locator('[data-prova="btn-secondary"]').focus();
await page.keyboard.press("Tab");
await page.waitForTimeout(300);
const fantasma = await page.evaluate(() => {
  const el = document.querySelector('[data-prova="btn-ghost"]');
  return {
    focado: document.activeElement?.dataset?.prova,
    miolo: getComputedStyle(el, "::before").backgroundColor,
  };
});
conferir("o Tab chegou no botao fantasma", fantasma.focado === "btn-ghost", `foco em "${fantasma.focado}"`);
conferir(
  "fantasma em foco: o miolo e opaco (nao vaza o teal)",
  !/rgba\([^)]*,\s*0\)/.test(fantasma.miolo) && fantasma.miolo !== "transparent",
  `miolo ${fantasma.miolo}`,
);

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

// --- 8. Sobreposicao: chanfro no painel, corte 5 no item, elevacao por filter ---
await page.locator('[data-prova="dd-trigger"]').click();
await page.waitForSelector('[role="menu"]');
const menu = await page.evaluate(() => {
  const painel = document.querySelector('[role="menu"]');
  const item = document.querySelector('[data-prova="dd-item"]');
  return {
    clipPainel: getComputedStyle(painel).clipPath,
    sombraPainel: getComputedStyle(painel).boxShadow,
    filtroDoPai: getComputedStyle(painel.parentElement).filter,
    clipItem: getComputedStyle(item).clipPath,
  };
});
conferir("painel do menu com corte 6", menu.clipPainel.includes("6px"), `veio ${menu.clipPainel}`);
conferir("item do menu com corte 5", menu.clipItem.includes("5px"), `veio ${menu.clipItem}`);
/* box-shadow externo em elemento recortado e cortado junto: a elevacao some sem
   erro nenhum. Ela precisa vir de drop-shadow num pai NAO recortado -- `filter`
   e aplicado ANTES de `clip-path`, entao no proprio elemento seria cortada. */
conferir("o painel largou o box-shadow", menu.sombraPainel === "none", `veio ${menu.sombraPainel}`);
conferir("a elevacao veio do pai por drop-shadow", menu.filtroDoPai.includes("drop-shadow"), `veio ${menu.filtroDoPai}`);

// --- 9. Os nos do palco ---
await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL(/\/nexo/, { timeout: 30_000 }).catch(() => {});
}
await page.waitForLoadState("networkidle").catch(() => {});

const nos = await page.evaluate(() => {
  const alvos = [...document.querySelectorAll(".react-flow__node")];
  return alvos.slice(0, 6).map((n) => {
    const forma = n.firstElementChild ?? n;
    return { clip: getComputedStyle(forma).clipPath, raio: getComputedStyle(forma).borderTopLeftRadius };
  });
});
if (nos.length === 0) {
  console.log("AVISO  nenhum no no palco -- semeie o estado antes de medir (ver scripts/shot-nexo-blocos.mjs)");
} else {
  conferir(
    `os ${nos.length} nos medidos estao recortados`,
    nos.every((n) => n.clip.includes("polygon")),
    `sem recorte: ${nos.filter((n) => !n.clip.includes("polygon")).length}`,
  );
  conferir(
    "nenhum no guardou raio",
    nos.every((n) => n.raio === "0px"),
    `com raio: ${nos.filter((n) => n.raio !== "0px").map((n) => n.raio).join(", ")}`,
  );
}

// --- 10. Barra lateral: nova conversa e busca em 6, itens em 5 ---
const lateral = await page.evaluate(() => {
  const raiz = document.querySelector('aside[aria-label="Navegação do Nexo"]') ?? document.querySelector("aside");
  if (!raiz) return null;
  const itens = [...raiz.querySelectorAll("a, button, summary")];
  return itens.slice(0, 14).map((el) => ({
    texto: (el.textContent ?? "").trim().slice(0, 24),
    clip: getComputedStyle(el).clipPath,
    raio: getComputedStyle(el).borderTopLeftRadius,
  }));
});
/* A lupa da busca: o wrapper do campo vem depois dela no DOM e tambem e
   posicionado, entao sem z-index ele pinta por cima e o icone desaparece --
   sem erro, sem aviso, e nenhuma medida de clip-path acusa. */
const lupa = await page.evaluate(() => {
  const svg = document.querySelector('aside svg.lucide-search, aside .lucide-search');
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  return { z: getComputedStyle(svg).zIndex, largura: Math.round(r.width) };
});
if (lupa) {
  conferir("a lupa da busca nao ficou atras do campo", lupa.z !== "auto", `z-index ${lupa.z}`);
}

if (!lateral) {
  conferir("a barra lateral existe", false, "nem aside rotulado nem <aside>");
} else {
  const comRaio = lateral.filter((i) => i.raio !== "0px" && !i.clip.includes("polygon"));
  conferir(
    `nenhum dos ${lateral.length} controles da lateral guardou raio`,
    comRaio.length === 0,
    `sobraram: ${comRaio.map((i) => `"${i.texto}" ${i.raio}`).join(", ")}`,
  );
}

// --- 11. Criterio 05: com prefers-reduced-motion, nada desliza ---
const ctxParado = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const pgParado = await ctxParado.newPage();
await pgParado.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
if (pgParado.url().includes("/login")) {
  await pgParado.getByRole("button", { name: /Entrar como dev/i }).click();
  await pgParado.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
}
await pgParado.locator('[data-prova="btn-lg"]').hover();
await pgParado.waitForTimeout(400);
const parado = await pgParado.evaluate(() => {
  const s = getComputedStyle(document.querySelector('[data-prova="btn-lg"]'), "::after");
  const l = getComputedStyle(document.querySelector('[data-prova="btn-loading"]'), "::after");
  return { laminaHover: s.display, laminaLoading: l.display, animacao: l.animationName };
});
conferir("movimento reduzido: a lamina do hover nao existe", parado.laminaHover === "none", `veio ${parado.laminaHover}`);
conferir(
  "movimento reduzido: carregando fica estatico",
  parado.laminaLoading === "none" && parado.animacao === "none",
  `display=${parado.laminaLoading} animation=${parado.animacao}`,
);
await ctxParado.close();

// --- 12. Criterio 07: contraste AA (>= 4.5) do rotulo na primaria, em repouso
//     e sob a lamina. O rotulo e texto pequeno (12px), entao vale o limite alto.
function luminancia([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const cores = await page.evaluate(() => {
  const raiz = getComputedStyle(document.documentElement);
  return {
    texto: raiz.getPropertyValue("--primary-foreground").trim(),
    repouso: raiz.getPropertyValue("--primary").trim(),
    hover: raiz.getPropertyValue("--primary-hover").trim(),
    blade: raiz.getPropertyValue("--blade").trim(),
  };
});
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// A lamina e --blade a 50% sobre --primary-hover: a mistura e a media.
const misturaBlade = hex(cores.hover).map((c, i) => Math.round((c + hex(cores.blade)[i]) / 2));
const rRepouso = razao(hex(cores.texto), hex(cores.repouso));
const rLamina = razao(hex(cores.texto), misturaBlade);
conferir(`contraste do rotulo em repouso (${rRepouso.toFixed(2)}:1)`, rRepouso >= 4.5, "precisa de 4.5");
conferir(`contraste do rotulo sob a lamina (${rLamina.toFixed(2)}:1)`, rLamina >= 4.5, "precisa de 4.5");

await browser.close();
console.log(`\n=== ${falhas.length === 0 ? "PASSOU" : `${falhas.length} FALHA(S)`} ===`);
if (falhas.length) for (const f of falhas) console.log(`  · ${f}`);
process.exit(falhas.length ? 1 : 0);
