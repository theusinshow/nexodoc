/**
 * PROVA DO HOLOFOTE DO TOUR (09/10/2026) — sem token: abre um parecer já
 * concluído e anda pelo passo a passo do resultado.
 *
 *   NEXODOC_PROVA_AUDITORIA=<id de auditoria COMPLETED> node scripts/prova-holofote-do-tour.mjs
 *
 * Mede o que a pessoa vê, não o que existe no DOM ([[nexodoc-provar-visivel]]):
 * - em cada passo com alvo, o CENTRO do alvo é o app (nítido, clicável) e o
 *   canto da janela é a película (desfocada);
 * - a película tem `backdrop-filter` de verdade no CSS compilado;
 * - o balão não cai em cima do recorte;
 * - clique fora encerra, guarda o passo, e o botão do trilho retoma nele;
 * - "Pular capítulo" cai no começo do seguinte; terminar apaga a retomada.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { entrarSemTela } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3000";
const AUDITORIA = process.env.NEXODOC_PROVA_AUDITORIA;
const SAIDA = process.env.NEXODOC_PROVA_SAIDA ?? path.join(process.cwd(), "tmp", "prova-holofote");
if (!AUDITORIA) {
  console.error("Falta NEXODOC_PROVA_AUDITORIA (id de uma auditoria COMPLETED).");
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

// Primeiro acesso ao resultado: nenhuma dica vista, nada a retomar. Só na primeira carga.
await page.addInitScript(() => {
  if (sessionStorage.getItem("prova-holofote")) return;
  sessionStorage.setItem("prova-holofote", "1");
  localStorage.setItem("nexo:tour-visto", "1");
  localStorage.setItem("nexo:dicas-vistas", "[]");
  localStorage.removeItem("nexo:tour-retomar");
});

const passoAtual = () =>
  page.evaluate(() => {
    const b = document.querySelector("[data-tour-balao]");
    if (!b) return null;
    const m = document.querySelector("[data-tour-anel]").getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const sob = (x, y) => document.elementFromPoint(x, y);
    const comAlvo = m.width > 0;
    const centro = comAlvo ? sob(m.x + m.width / 2, m.y + m.height / 2) : null;
    // Um canto longe do recorte e do balão.
    const cantos = [
      [4, innerHeight - 4],
      [innerWidth - 4, innerHeight - 4],
      [4, 4],
    ];
    const longe = cantos.find(([x, y]) => !(x >= m.left && x <= m.right && y >= m.top && y <= m.bottom));
    const fora = sob(...longe);
    return {
      onde: b.querySelector("[data-tour-onde]").textContent,
      titulo: b.querySelector("h2").textContent,
      visivel: b.style.visibility !== "hidden",
      comAlvo,
      centroNitido: comAlvo ? !centro?.closest("[data-tour-pelicula],[data-tour-balao]") : null,
      foraNaPelicula: !!fora?.closest("[data-tour-pelicula]"),
      balaoSobreRecorte:
        comAlvo && !(br.right <= m.left || br.left >= m.right || br.bottom <= m.top || br.top >= m.bottom),
      desfoque: getComputedStyle(document.querySelector("[data-tour-pelicula]")).backdropFilter,
      longe,
    };
  });

const esperarPasso = async () => {
  await page.waitForFunction(() => {
    const b = document.querySelector("[data-tour-balao]");
    return b && b.style.visibility !== "hidden";
  });
  await page.waitForTimeout(450); // o recorte termina de deslizar
};

try {
  await page.goto(`${BASE}/nexo?auditoria=${AUDITORIA}`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
    await page.goto(`${BASE}/nexo?auditoria=${AUDITORIA}`, { waitUntil: "domcontentloaded" });
  }

  // 1. Abre sozinho na primeira vez, com a tela toda desfocada.
  await page.waitForSelector("[data-tour-balao]", { timeout: 30000 });
  await esperarPasso();
  let p = await passoAtual();
  confere(p.onde === "Resumo · 1 de 8", `abre no primeiro passo (${p.onde})`);
  confere(p.desfoque !== "none" && /blur/.test(p.desfoque), `película desfoca (${p.desfoque})`);
  confere(p.foraNaPelicula, "a tela atrás está sob a película");
  await page.screenshot({ path: path.join(SAIDA, "01-abertura.png") });

  // 2. Cada passo com alvo: alvo nítido, resto na película, balão fora do recorte.
  const vistos = [];
  for (let i = 0; i < 40; i++) {
    await page.locator("[data-tour-proximo]").click();
    await esperarPasso();
    p = await passoAtual();
    vistos.push(p);
    if (p.comAlvo) {
      confere(p.centroNitido, `${p.onde} — "${p.titulo}": o alvo está nítido`);
      confere(p.foraNaPelicula, `${p.onde}: fora do alvo é película`);
      confere(!p.balaoSobreRecorte, `${p.onde}: o balão não cobre o recorte`);
    }
    if (["Faixa", "Achados · 1", "Outras leituras · 2"].some((s) => p.onde.startsWith(s)) || p.titulo === "O veredito vem primeiro")
      await page.screenshot({ path: path.join(SAIDA, `02-${String(i).padStart(2, "0")}.png`) });
    if (/^Achados · 2 de \d+$/.test(p.onde)) break;
  }
  confere(/^Achados · 2 de \d+$/.test(p.onde), `chegou à fila (${p.onde})`);

  // 3. Clique fora encerra e guarda o passo.
  await page.mouse.click(p.longe[0], p.longe[1]);
  await page.waitForSelector("[data-tour-pelicula]", { state: "detached", timeout: 5000 });
  const guardado = await page.evaluate(() => localStorage.getItem("nexo:tour-retomar"));
  confere(guardado === '{"resultado":"busca"}', `clique fora guardou o passo (${guardado})`);
  const rotulo = await page.locator('[data-tour="tour-do-resultado"]').getAttribute("aria-label");
  confere(rotulo === "Continuar de onde parei", `o botão do trilho oferece retomar (${rotulo})`);

  // 4. Retoma no mesmo passo, com a fila aberta.
  await page.locator('[data-tour="tour-do-resultado"]').click();
  await esperarPasso();
  p = await passoAtual();
  confere(/^Achados · 2 de \d+$/.test(p.onde), `retomou onde parou (${p.onde})`);
  confere(p.centroNitido === true, "retomado, o alvo da fila está na tela e nítido");
  await page.screenshot({ path: path.join(SAIDA, "03-retomado.png") });

  // 5. Pular capítulo.
  await page.locator("[data-tour-pular-capitulo]").click();
  await esperarPasso();
  p = await passoAtual();
  confere(p.onde === "Outras leituras · 1 de 3", `pular capítulo cai no seguinte (${p.onde})`);

  // 6. Terminar apaga a retomada.
  for (let i = 0; i < 5; i++) {
    const botao = page.locator("[data-tour-proximo]");
    const fim = (await botao.textContent()) === "Entendi";
    await botao.click();
    if (fim) break;
    await esperarPasso();
  }
  await page.waitForSelector("[data-tour-pelicula]", { state: "detached", timeout: 5000 });
  const depois = await page.evaluate(() => localStorage.getItem("nexo:tour-retomar"));
  confere(depois === "{}", `terminar apaga a retomada (${depois})`);
  const rotuloFim = await page.locator('[data-tour="tour-do-resultado"]').getAttribute("aria-label");
  confere(rotuloFim === "Como usar esta tela", `o botão volta ao normal (${rotuloFim})`);

  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros.join(" | ")}` : ""}`);
} catch (e) {
  confere(false, String(e));
  await page.screenshot({ path: path.join(SAIDA, "erro.png") }).catch(() => {});
} finally {
  await browser.close();
}

console.log(falhas ? `\n${falhas} falha(s). Fotos em ${SAIDA}` : `\nTudo certo. Fotos em ${SAIDA}`);
process.exitCode = falhas ? 1 : 0;
