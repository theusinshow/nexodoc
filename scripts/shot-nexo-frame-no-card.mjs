// O CARD É O DOCUMENTO — e a decisão sobrevive ao turno seguinte do chat.
//
// Duas provas que nenhum teste puro dá:
//
//   1. o card desenha o documento a partir do MODELO, cabe na janela, e o que
//      se digita nele sai no PDF;
//   2. editar o título no card e depois FALAR no chat não desfaz a edição.
//      "Correção aceita e revertida sem aviso" já aconteceu duas vezes neste
//      projeto — merece prova de ponta a ponta, não só unitária.
//
// Encenado: o OCR do carimbo e o turno do agente. REAL: a geração da capa.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-frame-no-card.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-frame-no-card";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA FRAME NO CARD";
const OBRA_DUAS_LINHAS = `REFORMA E AMPLIACAO\nEMEB ${MARCADOR}`;
const TITULO_ESCOLHIDO = "PROJETO ESTRUTURAL CONCRETO";
const BAIRRO = "BAIRRO JARDIM MARISTELA";

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his",
);
const PRANCHAS = [1, 2].map((i) =>
  path.join(PASTA, `040_26_his_${String(i).padStart(3, "0")}_a.pdf`),
);

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
  window.__ENVIADO = {};
  window.__TEMPLATE = "";
  window.__TURNOS = 0;

  window.fetch = async (entrada, init = {}) => {
    const url = typeof entrada === "string" ? entrada : entrada.url;

    if (url.includes("/api/ld/extract-stamp")) {
      const corpo = JSON.parse(init.body ?? "{}");
      const n = Number(/_(\d{3})_/.exec(corpo?.metadata?.fileName ?? "")?.[1] ?? 1);
      return new Response(
        JSON.stringify({
          disciplina: "Hidrossanitario", folha: n, total: 2, numeroFolha: `${n}/2`,
          arquivo: `999_26_his_${String(n).padStart(3, "0")}_a`,
          conteudo: `FOLHA ${n} — ${marcador}`,
          cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
          secretaria: "SECRETARIA DE OBRAS",
          obra: `REFORMA E AMPLIACAO - EMEB ${marcador}`,
          fase: "PROJETO BASICO", tituloSecao: "PROJETO HIDROSSANITARIO",
          confianca: "alta", usage: { totalTokens: 0 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/api/nexo/agent")) {
      window.__TURNOS += 1;
      try { window.__ENVIADO.agent = JSON.parse(init.body ?? "{}"); } catch {}
      const enc = new TextEncoder();
      /*
       * O agente devolve OS MESMOS params nos dois turnos — inclusive
       * `tituloCapa: ""`. É o caso "o agente repetiu o valor", em que a decisão
       * do engenheiro tem de ficar de pé.
       */
      return new Response(
        new ReadableStream({
          start(c) {
            const manda = (o) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            manda({ type: "delta", text: "Segue a proposta." });
            manda({
              type: "done",
              proposals: [
                { kind: "capa", resumo: "Capa", params: {
                    templateId: window.__TEMPLATE, tituloCapa: "", volume: "1",
                    numTomos: 1, tomoInicial: 1 } },
              ],
              slotRequest: null, ldPreview: null, usage: 0,
            });
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
      );
    }

    if (url.includes("/api/nexo/capa")) {
      try { window.__ENVIADO.capa = JSON.parse(init.body ?? "{}"); } catch {}
    }
    return original(entrada, init);
  };
}, MARCADOR);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

/** As linhas impressas do PDF que o servidor devolveu, com o Y de cada uma. */
async function lerCapaGerada(destino) {
  const b64 = await page.evaluate(async (marcador) => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
    });
    const todas = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const r = tx.objectStore("conversations").getAll();
      r.onsuccess = () => res(r.result ?? []);
    });
    const atual = todas.find((c) => JSON.stringify(c).includes(marcador));
    const capa = (atual?.results ?? []).find((r) => r.kind === "capa");
    const pdf = (capa?.files ?? []).find((f) => f.mime === "application/pdf");
    if (!pdf?.blobKey) return null;
    const registro = await new Promise((res) => {
      const tx = db.transaction("result_blobs", "readonly");
      const r = tx.objectStore("result_blobs").get(pdf.blobKey);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => res(null);
    });
    const blob = registro?.blob ?? registro?.value ?? registro;
    if (!(blob instanceof Blob)) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }, MARCADOR);
  if (!b64) return null;
  fs.writeFileSync(destino, Buffer.from(b64, "base64"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(Buffer.from(b64, "base64")),
    useSystemFonts: true,
  }).promise;
  const tc = await (await doc.getPage(1)).getTextContent();
  const porLinha = new Map();
  for (const it of tc.items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    porLinha.set(y, (porLinha.get(y) ?? "") + it.str);
  }
  return [...porLinha.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, texto]) => ({ y, texto: texto.trim() }));
}

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});

  const template = await page.evaluate(async () => {
    const r = await fetch("/api/capas/templates").then((x) => x.json());
    window.__TEMPLATE = (r.templates ?? []).find((t) => t.id === "pmcriciuma")?.id ?? "";
    return window.__TEMPLATE;
  });
  check("o template de Criciúma está configurado", template === "pmcriciuma", template);

  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 90000 });

  /*
   * Pelo PLACEHOLDER, não por `textarea.first()`: o frame do documento também
   * usa textarea, e o primeiro da página passou a ser o campo da obra. Um
   * seletor frágil aqui faz o teste "conversar" com a capa e não com o Nexo.
   */
  const composer = page.getByPlaceholder(/Escreva para o Nexo/i).first();
  await composer.fill("Cria a capa");
  await composer.press("Enter");
  await page.getByText(/Vou gerar · \d+ documentos?/i).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);

  // =========================================================================
  // 1. O CARD É O DOCUMENTO
  // =========================================================================
  console.log("\nO card desenhado a partir do modelo");
  const cartao = page
    .getByText(/Vou gerar · \d+ documentos?/i)
    .first()
    .locator("xpath=ancestor::*[contains(@class,'rounded-md')][1]");
  await cartao.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/1-card.png`, fullPage: true });

  const obra = cartao.getByLabel("Obra", { exact: true });
  const titulo = cartao.getByLabel("Título", { exact: true });
  const bairro = cartao.getByLabel("Bairro", { exact: true });

  check("o card desenha a OBRA antes de gerar", (await obra.count()) === 1);
  check("o card desenha o TÍTULO antes de gerar", (await titulo.count()) === 1);
  check("o card desenha o BAIRRO antes de gerar", (await bairro.count()) === 1);
  check("o nº de tomos é editável", (await cartao.getByLabel("Nº de tomos").count()) === 1);
  check(
    "a linha do cabeçalho que vem de <text:h> aparece",
    /Governo do MUNIC/i.test(await cartao.innerText()),
    (await cartao.innerText()).slice(0, 120),
  );

  /*
   * Existir no DOM não é aparecer. É a checagem que faltava quando o frame
   * nasceu: ele descia para fora da janela e todas as asserções passavam.
   */
  const caixa = await cartao.boundingBox();
  const janela = await page.evaluate(() => ({ a: window.innerHeight, l: window.innerWidth }));
  check(
    "o card cabe na largura da janela",
    caixa !== null && caixa.x >= -1 && caixa.x + caixa.width <= janela.l + 1,
    JSON.stringify({ caixa, janela }),
  );

  // =========================================================================
  // 2. O QUE SE DIGITA NO CARD SAI NO PDF
  // =========================================================================
  console.log("\nO que se digita no card sai no documento");
  await obra.fill(OBRA_DUAS_LINHAS);
  await bairro.fill(BAIRRO);
  await titulo.fill(TITULO_ESCOLHIDO);
  await page.screenshot({ path: `${OUT}/2-preenchido.png`, fullPage: true });

  await page.getByRole("button", { name: /Gerar os? \d+|Gerar o \d+/i }).first().click();
  await page.getByText(/Gerado · \d+ documentos?/i).first().waitFor({ timeout: 180000 });

  const enviado = await page.evaluate(() => window.__ENVIADO.capa ?? null);
  check("a geração leva a obra em duas linhas", enviado?.obra === OBRA_DUAS_LINHAS, JSON.stringify(enviado?.obra));
  check("a geração leva o bairro", enviado?.bairro === BAIRRO, JSON.stringify(enviado?.bairro));
  check("a geração leva o título escolhido", enviado?.tituloCapa === TITULO_ESCOLHIDO, JSON.stringify(enviado?.tituloCapa));

  /*
   * A persistência é DEBOUNCED: ler o blob no instante seguinte ao "Gerado"
   * pega a conversa antes de ela ir ao disco. Tentar de novo é o certo aqui —
   * o defeito seria o arquivo nunca aparecer, não aparecer meio segundo depois.
   */
  let linhas = null;
  for (let tentativa = 0; tentativa < 6 && linhas === null; tentativa++) {
    await page.waitForTimeout(1500);
    linhas = await lerCapaGerada(`${OUT}/capa-do-card.pdf`);
  }
  check("a capa gerada tem PDF para conferir", linhas !== null);
  if (linhas) {
    console.log(linhas.map((l) => `      | y=${l.y} ${l.texto}`).join("\n"));
    const sem = (s) => s.replace(/\s+/g, "");
    check(
      "o que foi digitado no card SAIU no PDF",
      linhas.some((l) => l.texto === "REFORMA E AMPLIACAO") &&
        linhas.some((l) => sem(l.texto).includes(sem(TITULO_ESCOLHIDO))) &&
        linhas.some((l) => sem(l.texto) === sem(BAIRRO)),
      JSON.stringify(linhas.map((l) => l.texto)),
    );
  }

  // =========================================================================
  // 3. A DECISÃO SOBREVIVE AO TURNO SEGUINTE
  // =========================================================================
  console.log("\nA decisão sobrevive ao turno seguinte do chat");
  await composer.fill("quantas folhas tem o volume?");
  await composer.press("Enter");
  await page.waitForTimeout(8000);

  /*
   * O turno TEM de ter acontecido. Sem esta checagem, "o título sobreviveu"
   * passaria verde com o segundo turno nunca enviado — o card antigo continua
   * na tela mostrando o mesmo valor, e o teste não provaria nada.
   */
  const turnos = await page.evaluate(() => window.__TURNOS ?? 0);
  check("o segundo turno do chat foi enviado de fato", turnos >= 2, `turnos=${turnos}`);

  const decisoesEnviadas = await page.evaluate(() => window.__ENVIADO.agent?.decisoes ?? null);
  check(
    "as decisões viajam no pedido do turno (o Nexo não pergunta de novo)",
    decisoesEnviadas?.tituloCapa === TITULO_ESCOLHIDO,
    JSON.stringify(decisoesEnviadas),
  );

  const tituloDepois = await page
    .getByLabel("Título", { exact: true })
    .last()
    .inputValue();
  check(
    "o título decidido no card sobrevive ao turno seguinte",
    tituloDepois === TITULO_ESCOLHIDO,
    JSON.stringify(tituloDepois),
  );
  await page.screenshot({ path: `${OUT}/3-depois-do-turno.png`, fullPage: true });

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
