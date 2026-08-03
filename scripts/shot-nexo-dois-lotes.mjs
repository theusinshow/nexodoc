// Soltar um SEGUNDO lote de pranchas enquanto o primeiro ainda está sendo lido.
//
// É o gesto de quem lembra da outra disciplina — e era o defeito #6 da revisão
// de código, deferido em julho como "corrida em drop duplo". Ao investigar, o
// estrago era maior que uma corrida: a segunda leitura invalidava a primeira
// pela geração, então as folhas JÁ LIDAS eram descartadas no meio do caminho (e
// cada uma custou uma chamada de modelo), enquanto os chips de anexo continuavam
// mostrando os arquivos das duas.
//
// O OCR é encenado com um ATRASO grande de propósito: sem ele o primeiro lote
// terminaria antes de o segundo começar, e o teste passaria sem exercitar nada.
//
//   npm run dev                            (noutro terminal)
//   node scripts/shot-nexo-dois-lotes.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-dois-lotes";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA AUTOMATICO DOIS LOTES";
/** Cada leitura de selo demora isto — dá tempo de soltar o segundo lote. */
const ATRASO_DO_SELO = 1500;

const RAIZ = path.resolve("docs/samples/040-26/10_his_inc_spd/arquivos separados");
const LOTE_A = [1, 2].map((i) =>
  path.join(RAIZ, "1_his", `040_26_his_${String(i).padStart(3, "0")}_a.pdf`),
);
const LOTE_B = [1, 2].map((i) =>
  path.join(RAIZ, "2_inc", `040_26_inc_${String(i).padStart(3, "0")}_a.pdf`),
);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// Os arquivos do segundo lote existem? (o volume 10 é misto de verdade)
for (const f of [...LOTE_A, ...LOTE_B]) {
  if (!fs.existsSync(f)) {
    console.error(`Arquivo de amostra ausente: ${f}`);
    process.exit(1);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

await context.addInitScript(
  ({ marcador, atraso }) => {
    const original = window.fetch.bind(window);
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__LIDAS = [];

    window.fetch = async (entrada, init = {}) => {
      const url = typeof entrada === "string" ? entrada : entrada.url;
      if (url.includes("/api/ld/extract-stamp")) {
        const corpo = JSON.parse(init.body ?? "{}");
        const arquivo = corpo?.metadata?.fileName ?? "";
        const disc = /_(his|inc)_/.exec(arquivo)?.[1] ?? "his";
        const n = Number(/_(\d{3})_/.exec(arquivo)?.[1] ?? 1);
        window.__LIDAS.push(arquivo);
        await espera(atraso);
        return new Response(
          JSON.stringify({
            disciplina: disc === "inc" ? "Preventivo contra incendio" : "Hidrossanitario",
            folha: n,
            total: 2,
            numeroFolha: `${n}/2`,
            arquivo: `999_26_${disc}_${String(n).padStart(3, "0")}_a`,
            conteudo: `${disc.toUpperCase()} ${n} — ${marcador}`,
            cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
            secretaria: "SECRETARIA DE OBRAS",
            obra: marcador,
            fase: "EXECUTIVO",
            tituloSecao: "PROJETO",
            confianca: "alta",
            usage: { totalTokens: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, atraso: ATRASO_DO_SELO },
);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

const nosDeFolha = () => page.locator('.react-flow__node[data-id^="folha:"]');

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});

  console.log("\nLote 1: hidrossanitário");
  const [sel1] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await sel1.setFiles(LOTE_A);

  // Espera a leitura COMEÇAR — e não terminar: é no meio dela que o segundo
  // lote entra.
  await page.getByText(/Lendo os selos|Contando as folhas/i).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(ATRASO_DO_SELO);
  check("a primeira leitura está em curso", true);

  console.log("Lote 2: incêndio, NO MEIO da leitura do primeiro");
  const [sel2] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await sel2.setFiles(LOTE_B);
  await page.screenshot({ path: `${OUT}/1-no-meio.png`, fullPage: true });

  // Agora sim: espera as duas terminarem.
  await page
    .getByText(/folha\(s\) de selo lidas/i)
    .first()
    .waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);

  // --- o que tem de ser verdade ------------------------------------------
  const nos = await nosDeFolha().count();
  check("as 4 folhas dos DOIS lotes sobrevivem", nos === 4, `${nos} nós de folha`);

  const texto = await page.locator("body").innerText();
  check("o status conta as 4 folhas", /4 folha\(s\) de selo lidas/i.test(texto),
    (/[^\n]*folha\(s\)[^\n]*/i.exec(texto) ?? [""])[0]);

  const canvas = await page.locator(".react-flow").innerText();
  check("o bloco de hidrossanitário está no canvas", /HIS/i.test(canvas));
  check("o bloco de incêndio está no canvas", /INC/i.test(canvas));

  // Nenhuma página foi lida duas vezes: reler custa uma chamada por folha.
  const lidas = await page.evaluate(() => window.__LIDAS);
  check(
    "nenhuma folha foi lida duas vezes",
    new Set(lidas).size === lidas.length,
    lidas.join(", "),
  );
  check("foram exatamente 4 leituras de selo", lidas.length === 4, `${lidas.length}`);

  await page.screenshot({ path: `${OUT}/2-somados.png`, fullPage: true });
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
