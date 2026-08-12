// PORTÃO DO CACHE DE LEITURA — a prova de que o arquivo já lido NÃO volta ao
// modelo.
//
// NÃO GASTA TOKEN, e é exatamente esse o ponto: a entrada do cache é semeada no
// IndexedDB com o checksum de um PDF de prancha REAL, o mesmo PDF é solto na
// tela, e o teste conta as chamadas a `/api/nexo/extract-stamp`. Se o cache
// falhar, o contador sobe — e o teste vira caro na hora, que é o alarme certo.
//
//   npm run dev                             (noutro terminal)
//   node scripts/prova-cache-de-leitura.mjs
//
// PDF: scratchpad/ESCOLA_JOSE_GIASSI_REV_A.pdf (sobrescreva com PROVA_PDF).
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import { VERSAO_DO_LEITOR } from "../modules/nexo/lib/selo-cache.ts";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const PDF = process.env.PROVA_PDF ?? "scratchpad/ESCOLA_JOSE_GIASSI_REV_A.pdf";
const OUT = process.env.PROVA_OUT ?? "docs/provas/cache-de-leitura";
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
let ok = 0;
function checar(criterio, condicao, detalhe = "") {
  if (condicao) {
    ok++;
    console.log(`  ok   ${criterio}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas++;
    console.error(`FALHOU ${criterio}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

if (!fs.existsSync(PDF)) {
  console.error(`Sem o PDF de prancha em ${PDF}. Aponte PROVA_PDF para um.`);
  process.exit(1);
}

// A CHAVE É A MESMA QUE A APLICAÇÃO CALCULA: sha-256 do conteúdo + versão do
// leitor, importada do próprio módulo — copiar o número aqui faria o teste
// continuar verde depois de o leitor mudar, que é o único caso em que ele
// precisa ficar vermelho.
const bytes = fs.readFileSync(PDF);
const sha = crypto.createHash("sha256").update(bytes).digest("hex");
const chave = `${sha}:${VERSAO_DO_LEITOR}`;
const nomeDoArquivo = path.basename(PDF);
console.log(`  PDF ${nomeDoArquivo} → ${chave.slice(0, 20)}…`);

/** Duas folhas fabricadas, como se já tivessem sido lidas antes. */
const folhasGuardadas = [1, 2].map((pageNumber) => ({
  fileName: nomeDoArquivo,
  pageNumber,
  pageCount: 2,
  extraction: {
    disciplina: "ARQUITETURA",
    arquivo: `escola_arq_00${pageNumber}_a`,
    conteudo: `PLANTA BAIXA ${pageNumber}`,
    obra: "ESCOLA JOSE GIASSI",
    numeroDaFolha: `0${pageNumber}/02`,
    totalDeFolhas: "02",
    data: null,
    logoOrgao: null,
    confianca: "alta",
  },
}));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

let chamadasAoModelo = 0;
page.on("request", (req) => {
  if (req.url().includes("/api/nexo/extract-stamp")) chamadasAoModelo++;
});

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);

  // ------------------------------------------------------ semeia o cache
  const semeou = await page.evaluate(async ({ chave, nomeDoArquivo, folhas }) => {
    const db = await new Promise((res, rej) => {
      // Sem versão: quem manda na versão do banco é a aplicação.
      const r = indexedDB.open("nexo");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!db.objectStoreNames.contains("selo_cache")) return "sem o store selo_cache";
    await new Promise((res, rej) => {
      const tx = db.transaction("selo_cache", "readwrite");
      tx.objectStore("selo_cache").put({
        key: chave,
        fileName: nomeDoArquivo,
        pageCount: 2,
        results: folhas,
        savedAt: Date.now(),
      });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return "ok";
  }, { chave, nomeDoArquivo, folhas: folhasGuardadas });
  checar(
    "00 o store do cache existe e aceitou a entrada",
    semeou === "ok",
    String(semeou),
  );

  // ------------------------------------------------------ solta o mesmo PDF
  /*
   * Pelo BOTÃO, não pelo `input` escondido: a tela tem mais de um (um deles é o
   * de pasta inteira, com `webkitdirectory`, que ignora arquivo solto). Soltar
   * no primeiro que aparece no DOM não fazia nada — e "nada" também dá zero
   * chamada ao modelo, que é o falso verde mais caro que este teste poderia ter.
   */
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /anexar arquivos/i }).first().click(),
  ]);
  await seletor.setFiles(PDF);
  // A leitura de 2 folhas do cache é instantânea; a de verdade levaria dezenas
  // de segundos. A espera generosa é para o teste FALHAR alto, e não por tempo.
  await page
    .getByText(/vieram de leitura anterior/i)
    .first()
    .waitFor({ timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(1500);

  const aviso = await page
    .getByText(/vieram de leitura anterior/i)
    .first()
    .textContent()
    .catch(() => null);

  checar(
    "01 NENHUMA chamada ao modelo para um arquivo já lido",
    chamadasAoModelo === 0,
    `${chamadasAoModelo} chamada(s) a /api/nexo/extract-stamp`,
  );
  checar(
    "02 a conversa DIZ que a leitura veio de antes",
    /(\d+) folha\(s\) vieram de leitura anterior/i.test(aviso ?? ""),
    (aviso ?? "sem a frase").replace(/\s+/g, " ").trim().slice(0, 120),
  );

  const folhasNoDisco = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("nexo");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("conversations", "readonly");
    const all = await new Promise((res, rej) => {
      const q = tx.objectStore("conversations").getAll();
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const recentes = all.sort((a, b) => b.updatedAt - a.updatedAt);
    return recentes[0]?.seloResults?.length ?? 0;
  });
  checar(
    "03 as folhas guardadas entraram na conversa",
    folhasNoDisco === 2,
    `${folhasNoDisco} folha(s)`,
  );

  await page.screenshot({ path: path.join(OUT, "01-leitura-reaproveitada.png") });
  console.log(`       ${path.join(OUT, "01-leitura-reaproveitada.png")}`);

  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exitCode = falhas > 0 ? 1 : 0;
} catch (err) {
  console.error("ERRO na prova:", err);
  await page
    .screenshot({ path: path.join(OUT, "erro.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
