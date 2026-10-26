// A resposta que chega abaixo da dobra AVISA — prova de tela, sem gastar um token.
//
// O QUE ESTA PROVA IMPEDE DE VOLTAR (26/10/2026)
//
// `atBottom` só era recalculado no `onScroll`, e a resposta do Nexo cresce SEM
// rolagem. Quem estava no fim continuava "no fim" para o código com meia
// resposta abaixo da dobra: o botão de descer não aparecia, nada dizia que o
// Nexo tinha respondido, e a conversa parecia travada.
//
// Três cenas, com o turno do agente encenado (SSE de verdade, como em
// `shot-nexo-streaming.mjs`):
//   1. resposta longa com o usuário no fim: a vista acompanha até o começo da
//      resposta encostar no topo, NÃO passa disso, e o botão acende dizendo que
//      o Nexo está respondendo; ao terminar, vira "nova resposta abaixo".
//   2. o botão leva ao fim e se apaga.
//   3. resposta curta: cabe, acompanha até o fim, nenhum botão.
//
//   npm run dev        (noutro terminal)
//   node scripts/prova-chat-novidade.mjs
import { chromium } from "playwright";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa-chat-novidade";
fs.mkdirSync(OUT, { recursive: true });

// A limpeza do fim apaga por ESTE texto, nunca por "as mais recentes".
const MARCADOR = "QA AUTOMATICO NOVIDADE";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 800 } });

await context.addInitScript(() => {
  const original = window.fetch.bind(window);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__QA = { deltas: ["Pronto."], intervalo: 120 };
  window.fetch = async (entrada, init = {}) => {
    const url = typeof entrada === "string" ? entrada : entrada.url;
    if (!url.includes("/api/nexo/agent")) return original(entrada, init);
    const cfg = window.__QA;
    const enc = new TextEncoder();
    const corpo = new ReadableStream({
      async start(controller) {
        const manda = (o) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        for (const texto of cfg.deltas) {
          await espera(cfg.intervalo);
          manda({ type: "delta", text: texto });
        }
        await espera(cfg.intervalo);
        manda({ type: "done", proposals: [], slotRequest: null, ldPreview: null, usage: 0 });
        controller.close();
      },
    });
    return new Response(corpo, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
  };
});

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

/** Onde o log está e onde a última resposta do Nexo começa, em px do topo do log. */
const medir = () =>
  page.evaluate(() => {
    const log = document.querySelector('[role="log"]');
    const turnos = log.querySelectorAll(".nx-fio > .nx-turno");
    const ultimo = turnos[turnos.length - 1];
    return {
      abaixo: Math.round(log.scrollHeight - log.scrollTop - log.clientHeight),
      topoDaResposta: Math.round(ultimo.getBoundingClientRect().top - log.getBoundingClientRect().top),
    };
  });

const botao = page.getByRole("button", { name: /últimas mensagens/i });
const botaoEnviar = page.getByRole("button", { name: "Enviar", exact: true });

/** O botão de descer está na tela de verdade (dentro do log visível), não só no DOM. */
const botaoVisivel = () =>
  page.evaluate(() => {
    const b = document.querySelector(".nx-descer");
    const log = document.querySelector('[role="log"]');
    if (!b || !log) return false;
    const r = b.getBoundingClientRect();
    const l = log.getBoundingClientRect();
    return r.height > 0 && r.top >= l.top && r.bottom <= l.bottom + 1;
  });

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 60000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  const composer = page.locator("textarea").first();
  await composer.waitFor({ timeout: 60000 });

  // =========================================================================
  console.log("\nCena 1 — resposta longa com o usuário no fim");
  await page.evaluate(() => {
    window.__QA.intervalo = 250;
    window.__QA.deltas = Array.from(
      { length: 30 },
      (_, i) => `Trecho ${i + 1}: texto longo o bastante para a resposta passar da altura visível da conversa. `,
    );
  });
  await composer.fill(`Escreve bastante — ${MARCADOR}`);
  await composer.press("Enter");
  // Metade dos trechos já chegou: a resposta já é maior que a janela.
  await page.waitForTimeout(5000);

  const durante = await medir();
  check(
    "a vista acompanhou até o começo da resposta encostar no topo",
    durante.topoDaResposta >= 0 && durante.topoDaResposta <= 40,
    `topo da resposta a ${durante.topoDaResposta}px do topo do log`,
  );
  check("e não passou disso: ainda há resposta abaixo da dobra", durante.abaixo > 64, `${durante.abaixo}px abaixo`);
  check("o botão aparece SEM o usuário rolar", await botaoVisivel());
  const rotuloDurante = (await botao.textContent())?.trim() ?? "";
  check("e diz que o Nexo está respondendo", /respondendo/i.test(rotuloDurante), rotuloDurante);
  await page.screenshot({ path: `${OUT}/1-respondendo.png` });

  await botaoEnviar.waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
  const depois = await medir();
  check("terminada, a vista NÃO foi arrastada até o fim", depois.abaixo > 64, `${depois.abaixo}px abaixo`);
  const rotuloDepois = (await botao.textContent())?.trim() ?? "";
  check("o botão passa a dizer que há resposta nova abaixo", /nova resposta abaixo/i.test(rotuloDepois), rotuloDepois);
  check("e está aceso", await page.locator(".nx-descer--novidade").isVisible());
  await page.screenshot({ path: `${OUT}/2-nova-resposta.png` });

  // =========================================================================
  console.log("\nCena 2 — o botão leva ao fim e se apaga");
  await botao.click();
  await page.waitForTimeout(1000);
  const noFim = await medir();
  check("chegou ao fim", noFim.abaixo < 64, `${noFim.abaixo}px abaixo`);
  check("o botão sumiu", (await botao.count()) === 0);

  // =========================================================================
  console.log("\nCena 3 — resposta curta cabe e não deixa botão");
  await page.evaluate(() => {
    window.__QA.intervalo = 120;
    window.__QA.deltas = ["Feito. ", "Respondido em duas linhas."];
  });
  await composer.fill(`Curta — ${MARCADOR}`);
  await composer.press("Enter");
  await botaoEnviar.waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  const curta = await medir();
  check("a resposta curta ficou inteira à vista", curta.abaixo < 64, `${curta.abaixo}px abaixo`);
  check("sem botão de descer", (await botao.count()) === 0);
  await page.screenshot({ path: `${OUT}/3-curta.png` });

  check("nenhum erro de página", errosDeConsole.length === 0, errosDeConsole.join(" | "));
} finally {
  const apagadas = await page
    .evaluate(async (marcador) => {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const todas = await new Promise((res) => {
        const r = db.transaction("conversations", "readonly").objectStore("conversations").getAll();
        r.onsuccess = () => res(r.result ?? []);
        r.onerror = () => res([]);
      });
      const alvos = todas.filter((c) => JSON.stringify(c).includes(marcador));
      for (const c of alvos) {
        await new Promise((res) => {
          const tx = db.transaction("conversations", "readwrite");
          tx.objectStore("conversations").delete(c.id);
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        });
      }
      return alvos.length;
    }, MARCADOR)
    .catch(() => -1);
  console.log(`\n  conversas de QA apagadas do navegador: ${apagadas}`);
  await browser.close();
}

console.log(falhas === 0 ? `\nTudo OK. Prints em ${OUT}` : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`);
process.exit(falhas === 0 ? 0 : 1);
