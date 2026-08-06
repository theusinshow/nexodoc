// O VOLUME DE VÁRIAS DISCIPLINAS: uma capa, e um bloco por disciplina.
//
// A regra do escritório é RÍGIDA: a separatriz existe para separar disciplinas
// dentro de um volume, dizendo qual é qual. Então N disciplinas = 1 capa +
// N separatrizes + N LDs, cada uma com o nome da SUA disciplina.
//
// Isso tinha teste puro do agrupamento (`test-nexo-blocos.ts`) e nenhuma prova
// de que a GERAÇÃO respeita a divisão. Aqui se prova de ponta a ponta, com o
// volume real 10 de 040-26 — hidrossanitário, incêndio e SPDA.
//
// Encenado: o OCR do carimbo e o turno do agente. A disciplina vem do NOME do
// arquivo, que é a fonte real (convenção do escritório), não do stub.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-volume-misto.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-volume-misto";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA VOLUME MISTO";
const RAIZ = path.resolve("docs/samples/040-26/10_his_inc_spd/arquivos separados");

/** Duas folhas de cada disciplina: o que importa é a DIVISÃO, não o volume. */
const PRANCHAS = [
  ...[1, 2].map((i) => path.join(RAIZ, "1_his", `040_26_his_${String(i).padStart(3, "0")}_a.pdf`)),
  ...[1, 2].map((i) => path.join(RAIZ, "2_inc", `040_26_inc_${String(i).padStart(3, "0")}_a.pdf`)),
  ...[1, 2].map((i) => path.join(RAIZ, "3_spd", `040_26_spd_${String(i).padStart(3, "0")}_a.pdf`)),
];

for (const p of PRANCHAS) {
  if (!fs.existsSync(p)) {
    console.error(`prancha ausente: ${p}`);
    process.exit(1);
  }
}

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

await context.addInitScript((marcador) => {
  const original = window.fetch.bind(window);
  window.__TEMPLATE = "";

  window.fetch = async (entrada, init = {}) => {
    const url = typeof entrada === "string" ? entrada : entrada.url;

    if (url.includes("/api/ld/extract-stamp")) {
      const corpo = JSON.parse(init.body ?? "{}");
      const arquivo = corpo?.metadata?.fileName ?? "";
      const sigla = /_(his|inc|spd)_/.exec(arquivo)?.[1] ?? "his";
      const n = Number(/_(\d{3})_/.exec(arquivo)?.[1] ?? 1);
      const rotulo = { his: "Hidrossanitario", inc: "Incendio", spd: "SPDA" }[sigla];
      return new Response(
        JSON.stringify({
          disciplina: rotulo, folha: n, total: 2, numeroFolha: `${n}/2`,
          arquivo: arquivo.replace(/\.pdf$/i, ""),
          conteudo: `FOLHA ${sigla.toUpperCase()} ${n} — ${marcador}`,
          cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
          secretaria: "SECRETARIA DE OBRAS",
          obra: `REVITALIZACAO ${marcador}`,
          fase: "PROJETO EXECUTIVO", tituloSecao: rotulo.toUpperCase(),
          confianca: "alta", usage: { totalTokens: 0 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/api/nexo/agent")) {
      const enc = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(c) {
            const manda = (o) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            manda({ type: "delta", text: "Segue a proposta." });
            manda({
              type: "done",
              proposals: [
                { kind: "capa", resumo: "Capa", params: {
                    templateId: window.__TEMPLATE, tituloCapa: "", volume: "10",
                    numTomos: 1, tomoInicial: 1 } },
                { kind: "ld", resumo: "LD", params: {
                    tituloLd: "", numTomos: 1, tomoInicial: 1 } },
                { kind: "separatriz", resumo: "Separatriz", params: {
                    templateId: window.__TEMPLATE, numTomos: 1, titulos: [] } },
              ],
              slotRequest: null, ldPreview: null, usage: 0,
            });
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
      );
    }
    return original(entrada, init);
  };
}, MARCADOR);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(async () => {
    const r = await fetch("/api/capas/templates").then((x) => x.json());
    window.__TEMPLATE = (r.templates ?? []).find((t) => t.id === "pmcriciuma")?.id ?? "";
  });

  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 120000 });

  const composer = page.getByPlaceholder(/Escreva para o Nexo/i).first();
  await composer.fill("Monta o volume");
  await composer.press("Enter");
  await page.getByText(/Vou gerar · \d+ documentos?/i).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);

  const cartao = page
    .getByText(/Vou gerar · \d+ documentos?/i)
    .first()
    .locator("xpath=ancestor::*[contains(@class,'rounded-md')][1]");
  await cartao.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/1-plano.png`, fullPage: true });

  const texto = await cartao.innerText();
  console.log("\n--- o que o card lista ---");
  console.log(texto.split("\n").map((l) => `      | ${l}`).join("\n"));

  // ---------------------------------------------------------------------
  // A REGRA: uma capa, e um bloco (separatriz + LD) por disciplina.
  // ---------------------------------------------------------------------
  console.log("\nA divisão em blocos");
  check(
    "o card reconhece as TRÊS disciplinas",
    /3 disciplinas/i.test(texto),
    texto.replace(/\s+/g, " ").slice(0, 200),
  );

  const linhas = texto.split("\n").map((l) => l.trim());
  const capas = linhas.filter((l) => /^Capa\b/.test(l));
  const seps = linhas.filter((l) => /^Separatriz\b/.test(l));
  const lds = linhas.filter((l) => /^LD\b/.test(l));

  check("UMA capa para o volume inteiro", capas.length === 1, JSON.stringify(capas));
  check("TRÊS separatrizes, uma por disciplina", seps.length === 3, JSON.stringify(seps));
  check("TRÊS LDs, uma por disciplina", lds.length === 3, JSON.stringify(lds));

  for (const nome of ["Hidrossanit", "Inc", "SPDA"]) {
    check(
      `a separatriz de ${nome} leva o nome da disciplina`,
      seps.some((l) => new RegExp(nome, "i").test(l)),
      JSON.stringify(seps),
    );
  }

  check(
    "cada disciplina tem o seu bloco de LD desenhado no card",
    (await cartao.getByText(/Lista de documentos/i).count()) === 3,
    String(await cartao.getByText(/Lista de documentos/i).count()),
  );

  check("nenhum erro de runtime no console", errosDeConsole.length === 0, errosDeConsole[0] ?? "");
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
  await page.screenshot({ path: `${OUT}/erro.png`, fullPage: true }).catch(() => {});
} finally {
  const apagadas = await page
    .evaluate(async (marcador) => {
      const db = await new Promise((res) => {
        const req = indexedDB.open("nexo", 1);
        req.onsuccess = () => res(req.result);
      });
      const todas = await new Promise((res) => {
        const tx = db.transaction("conversations", "readonly");
        const r = tx.objectStore("conversations").getAll();
        r.onsuccess = () => res(r.result ?? []);
      });
      const alvos = todas.filter((c) => JSON.stringify(c).includes(marcador));
      await Promise.all(
        alvos.map(
          (c) =>
            new Promise((res) => {
              const tx = db.transaction("conversations", "readwrite");
              tx.objectStore("conversations").delete(c.id);
              tx.oncomplete = () => res();
              tx.onerror = () => res();
            }),
        ),
      );
      return alvos.length;
    }, MARCADOR)
    .catch(() => -1);
  console.log(`\n  conversas de QA apagadas: ${apagadas}`);
  await browser.close();
}

console.log(
  falhas === 0 ? `\nTudo OK. Prints em ${OUT}` : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
