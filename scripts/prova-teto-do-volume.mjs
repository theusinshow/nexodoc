/**
 * PROVA DO PASSO DO TETO (10/10/2026) — sem token e sem gravar no banco.
 *
 *   NEXODOC_PROVA_CONVERSA=<conversa de volume montado> node scripts/prova-teto-do-volume.mjs
 *
 * Nenhum volume do banco de dev passa de 20 MB, então o passo "Acima de 20 MB"
 * do tour do volume nunca tinha sido visto. Esta prova LÊ a conversa indicada
 * (só leitura), copia para o IndexedDB do navegador da prova com outro id, põe
 * um PDF em cada tomo e declara o tomo 1 com 21 MB. TODA gravação no servidor é
 * barrada: abrir uma conversa real numa prova já apagou referências dela (ver
 * a jornada c8).
 *
 * - a dica do teto aparece na doca, no lugar da dos editáveis;
 * - o cabeçalho do tomo pesado diz "passa do teto" e traz Comprimir e Dividir;
 * - o tour para no passo do teto, com o alvo nítido e à vista.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";

import { entrarSemTela } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3000";
const ORIGEM = process.env.NEXODOC_PROVA_CONVERSA;
const SAIDA = process.env.NEXODOC_PROVA_SAIDA ?? path.join(process.cwd(), "tmp", "prova-teto-do-volume");
if (!ORIGEM) {
  console.error("Falta NEXODOC_PROVA_CONVERSA (id de uma conversa com volume montado).");
  process.exit(2);
}
fs.mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const confere = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FALHOU"}  ${msg}`);
  if (!ok) falhas++;
};

// 1. A conversa de origem, só leitura.
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")]),
);
const banco = new pg.Client({ connectionString: env.DATABASE_URL });
await banco.connect();
const linha = (await banco.query(`select data from "NexoConversation" where id=$1`, [ORIGEM])).rows[0];
await banco.end();
if (!linha) {
  console.error(`Conversa ${ORIGEM} não existe no banco.`);
  process.exit(2);
}

// 2. A cópia local, com outro id e um PDF em cada tomo.
const ID = `prova-teto-${Date.now()}`;
const TETO = 20 * 1024 * 1024;
const original = linha.data;
const pdf = await PDFDocument.create();
pdf.addPage([595, 842]);
const bytesDoPdf = Buffer.from(await pdf.save()).toString("base64");
const blobs = [];
const results = original.results.map((r) => {
  const files = r.files.map((f) => ({ ...f, blobKey: f.blobKey.replace(ORIGEM, ID) }));
  if (r.kind === "volume") {
    const tomo = r.payload?.tomo ?? 0;
    for (const f of files) {
      if (f.mime !== "application/pdf") continue;
      f.sizeBytes = tomo === 1 ? TETO + 1024 * 1024 : 5 * 1024 * 1024;
      blobs.push(f.blobKey);
    }
  }
  return { ...r, files };
});
const copia = { ...original, id: ID, title: "PROVA TETO (local)", updatedAt: Date.now(), results };
delete copia.projectId;

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await entrarSemTela(contexto, BASE);
// Nada vai ao servidor: só as leituras passam.
await contexto.route(/\/api\/nexo\/conversas/, (rota) => (rota.request().method() === "GET" ? rota.continue() : rota.abort()));
const gravacoes = [];
contexto.on("request", (r) => {
  if (/\/api\/nexo\/conversas/.test(r.url()) && r.method() !== "GET") gravacoes.push(r.method());
});
const page = await contexto.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
await page.addInitScript(() => {
  if (sessionStorage.getItem("prova-teto")) return;
  sessionStorage.setItem("prova-teto", "1");
  localStorage.setItem("nexo:tour-visto", "1");
  localStorage.setItem("nexo:dicas-vistas", JSON.stringify(["tour-do-resultado", "volume-canvas"]));
  localStorage.removeItem("nexo:tour-retomar");
});

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nx-zona", { timeout: 30000 });
  await page.evaluate(
    async ({ reg, chaves, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const db = await new Promise((ok, erro) => {
        const r = indexedDB.open("nexo");
        r.onsuccess = () => ok(r.result);
        r.onerror = () => erro(r.error);
      });
      await new Promise((ok, erro) => {
        const tx = db.transaction(["conversations", "result_blobs"], "readwrite");
        tx.objectStore("conversations").put(reg);
        for (const key of chaves) tx.objectStore("result_blobs").put({ key, blob: new Blob([bytes], { type: "application/pdf" }) });
        tx.oncomplete = () => ok();
        tx.onerror = () => erro(tx.error);
      });
      db.close();
    },
    { reg: copia, chaves: blobs, base64: bytesDoPdf },
  );
  await page.goto(`${BASE}/nexo?conversa=${ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-prova="vista-do-volume"]', { timeout: 40000 });
  const chip = page.locator('[data-tour="chip-mapa"]');
  if (await chip.count()) await chip.click();
  await page.waitForSelector('[data-tour="abas-do-volume"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  confere(Boolean(await page.locator('[data-dica="volume-teto"]').count()), "a dica do teto aparece na doca");
  confere(!(await page.locator('[data-dica="volume-entrega"]').count()), "no lugar da dos editáveis");
  confere(Boolean(await page.locator('[data-tour="saidas-do-teto"]').count()), "o tomo pesado traz Comprimir e Dividir");
  const frase = await page.locator("text=passa do teto de 20 MB").first().count();
  confere(frase > 0, "e diz que passa do teto");
  await page.screenshot({ path: path.join(SAIDA, "01-teto.png") });

  // O tour até o passo do teto.
  await page.locator('[data-tour="tour-do-volume"]').click();
  let achou = null;
  for (let i = 0; i < 14; i++) {
    await page.waitForFunction(() => {
      const b = document.querySelector("[data-tour-balao]");
      return b && b.style.visibility !== "hidden";
    });
    await page.waitForTimeout(450);
    const p = await page.evaluate(() => {
      const b = document.querySelector("[data-tour-balao]");
      const m = document.querySelector("[data-tour-anel]").getBoundingClientRect();
      const alvo = document.querySelector('[data-tour="saidas-do-teto"]')?.getBoundingClientRect();
      const mapa = document.querySelector(".react-flow").getBoundingClientRect();
      const inteiro = alvo ? alvo.left >= mapa.left - 1 && alvo.right <= mapa.right + 1 : false;
      const x = alvo ? alvo.x + alvo.width / 2 : -1;
      const y = alvo ? alvo.y + alvo.height / 2 : -1;
      const coberto = [...document.querySelectorAll('[data-tour="doca"], [data-dica]')].some((el) => {
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });
      return {
        titulo: b.querySelector("h2").textContent,
        onde: b.querySelector("[data-tour-onde]").textContent,
        noRecorte: alvo ? x >= m.left && x <= m.right && y >= m.top && y <= m.bottom : false,
        coberto,
        largura: alvo ? Math.round(alvo.width) : 0,
        inteiro,
      };
    });
    if (p.titulo === "Acima de 20 MB") {
      achou = p;
      break;
    }
    await page.locator("[data-tour-proximo]").click();
  }
  confere(Boolean(achou), `o tour passa pelo teto (${achou?.onde ?? "não passou"})`);
  if (achou) {
    confere(achou.noRecorte && !achou.coberto, "o alvo do teto está no recorte, sem nada por cima");
    confere(achou.largura >= 120, `e de perto (${achou.largura}px de botões)`);
    confere(achou.inteiro, "os dois botões cabem inteiros no mapa");
  }
  await page.screenshot({ path: path.join(SAIDA, "02-passo-do-teto.png") });
  await page.keyboard.press("Escape");
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros.join(" | ")}` : ""}`);
  console.log(`      gravações barradas: ${gravacoes.length}`);
} catch (e) {
  confere(false, String(e));
  await page.screenshot({ path: path.join(SAIDA, "erro.png") }).catch(() => {});
} finally {
  await browser.close();
}

console.log(falhas ? `\n${falhas} falha(s). Fotos em ${SAIDA}` : `\nTudo certo. Fotos em ${SAIDA}`);
process.exitCode = falhas ? 1 : 0;
