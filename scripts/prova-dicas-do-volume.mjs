/**
 * PROVA DAS DICAS E DO PASSO A PASSO DO VOLUME (09/10/2026) — sem token: abre
 * uma conversa de volume já montada e mede o que a pessoa vê.
 *
 *   NEXODOC_PROVA_CONVERSA=<id de conversa com volume> node scripts/prova-dicas-do-volume.mjs
 *
 * - a dica do mapa aparece na primeira vez, sem cobrir o canvas inteiro, e some no "Entendi";
 * - a dica da entrega aparece dentro da doca;
 * - o "?" abre o holofote, que passa pelos dois capítulos com o alvo nítido;
 * - clique fora guarda o passo e o "?" vira "Continuar".
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { entrarSemTela } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3000";
const CONVERSA = process.env.NEXODOC_PROVA_CONVERSA;
const SAIDA = process.env.NEXODOC_PROVA_SAIDA ?? path.join(process.cwd(), "tmp", "prova-dicas-do-volume");
if (!CONVERSA) {
  console.error("Falta NEXODOC_PROVA_CONVERSA (id de uma conversa com volume montado).");
  process.exit(2);
}
fs.mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const confere = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FALHOU"}  ${msg}`);
  if (!ok) falhas++;
};

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await entrarSemTela(contexto, BASE);
const page = await contexto.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
await page.addInitScript(() => {
  if (sessionStorage.getItem("prova-volume")) return;
  sessionStorage.setItem("prova-volume", "1");
  localStorage.setItem("nexo:tour-visto", "1");
  localStorage.setItem("nexo:dicas-vistas", "[]");
  localStorage.removeItem("nexo:tour-retomar");
});

/** Visível de verdade: tem caixa, está na janela e o ponto do meio é ele (ou filho dele). */
const visivel = (sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return false;
    const no = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 20));
    return !!no && (el === no || el.contains(no));
  }, sel);

const passoAtual = () =>
  page.evaluate(() => {
    const b = document.querySelector("[data-tour-balao]");
    if (!b) return null;
    const m = document.querySelector("[data-tour-anel]").getBoundingClientRect();
    const comAlvo = m.width > 0;
    const centro = comAlvo ? document.elementFromPoint(m.x + m.width / 2, m.y + m.height / 2) : null;
    const br = b.getBoundingClientRect();
    return {
      id: b.querySelector("h2").textContent,
      onde: b.querySelector("[data-tour-onde]").textContent,
      comAlvo,
      // Nítido E à vista: o centro do alvo cai no recorte, e nada que flutua (a
      // doca, uma dica) está por cima dele — a doca sobre o botão também é "nítida".
      centroNitido: comAlvo
        ? (() => {
            if (centro?.closest("[data-tour-pelicula],[data-tour-balao]")) return false;
            const alvo = document.querySelector(document.querySelector("[data-tour-anel]").dataset.tourAlvo);
            if (!alvo) return false;
            const a = alvo.getBoundingClientRect();
            const x = a.x + a.width / 2;
            const y = a.y + a.height / 2;
            if (x < m.left || x > m.right || y < m.top || y > m.bottom) return false;
            return ![...document.querySelectorAll('[data-tour="doca"], [data-dica]')].some((el) => {
              if (el.contains(alvo) || alvo.contains(el)) return false;
              const r = el.getBoundingClientRect();
              return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            });
          })()
        : null,
      balaoSobre: comAlvo && !(br.right <= m.left || br.left >= m.right || br.bottom <= m.top || br.top >= m.bottom),
      largura: Math.round(m.width),
      noCentro: document.querySelector("[data-tour-anel]").dataset.tourAlvo,
    };
  });
const esperarPasso = async () => {
  await page.waitForFunction(() => {
    const b = document.querySelector("[data-tour-balao]");
    return b && b.style.visibility !== "hidden";
  });
  await page.waitForTimeout(450);
};

try {
  await page.goto(`${BASE}/nexo?conversa=${CONVERSA}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-prova="vista-do-volume"]', { timeout: 40000 });
  // Conversa com auditoria abre no parecer; o mapa está no chip.
  const chip = page.locator('[data-tour="chip-mapa"]');
  if (await chip.count()) await chip.click();
  await page.waitForSelector('[data-tour="abas-do-volume"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  // 1. A dica do mapa.
  confere(await visivel('[data-dica="volume-canvas"]'), "a dica do mapa aparece na primeira vez");
  const area = await page.evaluate(() => {
    const r = document.querySelector('[data-dica="volume-canvas"]').getBoundingClientRect();
    const c = document.querySelector('[data-tour="canvas-do-volume"]').getBoundingClientRect();
    return (r.width * r.height) / (c.width * c.height);
  });
  confere(area < 0.15, `ela não cobre o mapa (${Math.round(area * 100)}% da área)`);
  confere(await visivel('[data-tour="tour-do-volume"]'), 'o "?" está à vista');

  // 2. Uma por vez: com a do mapa aberta, a da entrega espera.
  confere(!(await page.locator('[data-dica="volume-entrega"]').count()), "a dica da entrega espera a do mapa");
  await page.screenshot({ path: path.join(SAIDA, "01-dicas.png") });

  // "Entendi" fecha só a dela, e não volta ao recarregar.
  await page.locator('[data-dica="volume-canvas"] .dica-uma-fechar').click();
  confere(!(await page.locator('[data-dica="volume-canvas"]').count()), "Entendi fecha a dica do mapa");
  const vistas = await page.evaluate(() => JSON.parse(localStorage.getItem("nexo:dicas-vistas") ?? "[]"));
  confere(vistas.includes("volume-canvas"), "fica registrada como vista");

  // 3. Então a da entrega, dentro da doca.
  await page.waitForTimeout(300);
  const dicaDaDoca = await page.evaluate(() => {
    const d = document.querySelector('[data-dica="volume-entrega"], [data-dica="volume-teto"]');
    return d ? { id: d.getAttribute("data-dica"), naDoca: !!d.closest('[data-tour="doca"]') } : null;
  });
  confere(dicaDaDoca?.naDoca === true, `a dica da entrega está na doca (${dicaDaDoca?.id ?? "nenhuma"})`);
  await page.screenshot({ path: path.join(SAIDA, "01b-dica-da-entrega.png") });

  // 3. O passo a passo.
  const enquadramento = () => page.evaluate(() => document.querySelector(".react-flow__viewport")?.style.transform);
  const antes = await enquadramento();
  await page.locator('[data-tour="tour-do-volume"]').click();
  await esperarPasso();
  let p = await passoAtual();
  // O total depende do volume: o passo do teto e o da conferência só contam quando existem.
  confere(/^O mapa · 1 de [6-8]$/.test(p.onde), `abre no começo (${p.onde})`);
  const ondes = [p.onde];
  for (let i = 0; i < 14; i++) {
    const botao = page.locator("[data-tour-proximo]");
    if ((await botao.textContent()) === "Entendi") break;
    await botao.click();
    await esperarPasso();
    p = await passoAtual();
    ondes.push(p.onde);
    if (p.comAlvo) {
      confere(p.centroNitido, `${p.onde} — "${p.id}": alvo nítido${p.centroNitido ? "" : ` (alvo coberto ou fora do recorte: ${p.noCentro})`}`);
      confere(!p.balaoSobre, `${p.onde}: o balão não cobre o alvo`);
    }
    // A 0,4 de zoom o cabeçalho era um risco: o canvas tem de chegar perto.
    // Com a coluna da conferência o mapa estreita: perto é ocupar o mapa, não um número fixo.
    if (p.id === "O cabeçalho do tomo" || p.id === "Montar") {
      const mapa = await page.evaluate(() => Math.round(document.querySelector(".react-flow").getBoundingClientRect().width));
      confere(p.largura >= Math.min(300, mapa * 0.6) || (p.id === "Montar" && p.largura >= 90), `o canvas aproxima "${p.id}" (${p.largura}px num mapa de ${mapa}px)`);
    }
    if (p.id === "Cada fileira é um tomo" || p.id === "Montar" || p.id === "Acima de 20 MB" || p.id === "Conferência da LD" || p.id.startsWith("1."))
      await page.screenshot({ path: path.join(SAIDA, `02-${p.id.replace(/[^a-z0-9]+/gi, "-")}.png`) });
    if (p.onde.startsWith("A entrega · 2")) break;
  }
  console.log(`      passos vistos: ${ondes.join(" → ")}`);
  // Sem buraco na contagem: dentro de cada capítulo, 1, 2, 3… até o total.
  const semBuraco = ondes.every((o, i) => {
    const [, cap, n] = /^(.+) · (\d+) de \d+$/.exec(o) ?? [];
    const ant = i > 0 ? /^(.+) · (\d+) de \d+$/.exec(ondes[i - 1]) : null;
    return ant && ant[1] === cap ? Number(n) === Number(ant[2]) + 1 : Number(n) === 1;
  });
  confere(semBuraco, "a contagem não pula número");
  confere(ondes.some((o) => o.startsWith("A entrega")), "chegou ao capítulo da entrega");

  // 4. Clique fora guarda o passo; o "?" vira "Continuar".
  await page.mouse.click(1436, 4);
  await page.waitForSelector("[data-tour-pelicula]", { state: "detached", timeout: 5000 });
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("nexo:tour-retomar") ?? "{}").volume);
  confere(Boolean(guardado), `clique fora guardou o passo (${guardado})`);
  const rotulo = await page.locator('[data-tour="tour-do-volume"]').textContent();
  confere(rotulo.includes("Continuar"), `o "?" oferece continuar (${rotulo.trim()})`);
  await page.locator('[data-tour="tour-do-volume"]').click();
  await esperarPasso();
  p = await passoAtual();
  confere(p.onde === ondes[ondes.length - 1], `retomou no mesmo passo (${p.onde})`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const depois = await enquadramento();
  confere(depois === antes, `sair devolve o enquadramento (${antes} → ${depois})`);

  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros.join(" | ")}` : ""}`);
} catch (e) {
  confere(false, String(e));
  await page.screenshot({ path: path.join(SAIDA, "erro.png") }).catch(() => {});
} finally {
  await browser.close();
}

console.log(falhas ? `\n${falhas} falha(s). Fotos em ${SAIDA}` : `\nTudo certo. Fotos em ${SAIDA}`);
process.exitCode = falhas ? 1 : 0;
