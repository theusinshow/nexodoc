// O FRAME DA CAPA no navegador — a capa editada com a FORMA da capa.
//
// Duas falhas relatadas pelo engenheiro nascem aqui, e são diferentes:
//
//   1. o frame desenhava a capa VAZIA. Obra e código chegam ao editor em branco
//      de propósito (branco = "vale o carimbo"), o que se lê bem numa lista de
//      rótulo/valor e se lê como documento em branco num desenho do documento;
//   2. a obra saía numa LINHA SÓ. O carimbo a escreve assim porque a célula dele
//      é uma linha só; a capa impressa tem duas, e o gerador só quebrava no
//      Enter — que nunca existia, porque o valor vinha do selo.
//
// O carimbo encenado traz a obra com " - " justamente para exercitar (2).
//
// Encenado: o OCR do carimbo e o turno do agente. REAL: a geração da capa.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-frame-capa.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-frame-capa";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA AUTOMATICO FRAME CAPA";
/** O carimbo escreve a obra numa tira só, com " - " no meio. */
const OBRA_DO_CARIMBO = `REFORMA E AMPLIACAO - EMEB ${MARCADOR}`;
const OBRA_EM_DUAS_LINHAS = `REFORMA E AMPLIACAO\nEMEB ${MARCADOR}`;
/** O que o engenheiro digita no frame: três disciplinas, três linhas. */
const TITULO_TRES_LINHAS =
  "PROJETO DE URBANIZACAO\nPROJETO DE PAISAGISMO\nMAQUETE ELETRONICA";
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

await context.addInitScript(
  ({ marcador, obra }) => {
    const original = window.fetch.bind(window);
    window.__ENVIADO = {};
    window.__TEMPLATE = "";

    window.fetch = async (entrada, init = {}) => {
      const url = typeof entrada === "string" ? entrada : entrada.url;

      if (url.includes("/api/ld/extract-stamp")) {
        const corpo = JSON.parse(init.body ?? "{}");
        const arquivo = corpo?.metadata?.fileName ?? "";
        const n = Number(/_(\d{3})_/.exec(arquivo)?.[1] ?? 1);
        return new Response(
          JSON.stringify({
            disciplina: "Hidrossanitario",
            folha: n,
            total: 2,
            numeroFolha: `${n}/2`,
            arquivo: `999_26_his_${String(n).padStart(3, "0")}_a`,
            conteudo: `FOLHA ${n} — ${marcador}`,
            cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
            secretaria: "SECRETARIA DE OBRAS",
            obra,
            fase: "PROJETO BASICO",
            tituloSecao: "PROJETO HIDROSSANITARIO",
            confianca: "alta",
            usage: { totalTokens: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/api/nexo/agent")) {
        const enc = new TextEncoder();
        const corpo = new ReadableStream({
          start(controller) {
            const manda = (o) =>
              controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            manda({ type: "delta", text: "Segue a proposta." });
            manda({
              type: "done",
              proposals: [
                {
                  kind: "capa",
                  resumo: "Capa",
                  params: {
                    templateId: window.__TEMPLATE,
                    tituloCapa: "PROJETO HIDROSSANITARIO",
                    volume: "1",
                    // DOIS tomos: é com mais de um que o rótulo do tomo
                    // aparece, e o formato dele é o que se quer conferir.
                    numTomos: 2,
                    tomoInicial: 1,
                  },
                },
              ],
              slotRequest: null,
              ldPreview: null,
              usage: 0,
            });
            controller.close();
          },
        });
        return new Response(corpo, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }

      if (url.includes("/api/nexo/capa")) {
        try {
          window.__ENVIADO.capa = JSON.parse(init.body ?? "{}");
        } catch {}
      }

      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, obra: OBRA_DO_CARIMBO },
);

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

  /*
   * CRICIÚMA de propósito, e não "o primeiro template da lista": é o único com
   * `{{BAIRRO}}` e com `coverTitleMode: volume-title-items` (a 1ª linha do
   * título entra em "VOLUME N – ", as demais descem alinhadas à direita). Com
   * o primeiro da lista o teste media outro documento e acusava falta de
   * bairro num template que nunca teve o campo.
   */
  const template = await page.evaluate(async () => {
    const r = await fetch("/api/capas/templates").then((x) => x.json());
    const alvo = (r.templates ?? []).find((t) => t.id === "pmcriciuma");
    window.__TEMPLATE = alvo?.id ?? "";
    return window.__TEMPLATE;
  });
  check("o template de Criciúma está configurado", template === "pmcriciuma", template);

  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 90000 });

  const composer = page.locator("textarea").first();
  await composer.fill("Cria a capa");
  await composer.press("Enter");
  await page.getByText(/Vou gerar · \d+ documentos?/i).first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Gerar os? \d+|Gerar o \d+/i }).first().click();
  await page.getByText(/Gerado · \d+ documentos?/i).first().waitFor({ timeout: 180000 });

  // =========================================================================
  // O frame DESENHA a capa — cheia, não em branco
  // =========================================================================
  console.log("\nO frame da capa");
  const noDaCapa = page.locator('.react-flow__node[data-id^="capa"]').first();
  await noDaCapa.click();
  await page.getByRole("button", { name: /Editar aqui/i }).first().click();

  const dialogo = page.getByRole("dialog");
  await dialogo.waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/1-frame.png`, fullPage: true });

  /*
   * O painel CABE NA JANELA.
   *
   * É a checagem que faltava, e a ausência dela é o que deixou o frame chegar
   * quebrado ao engenheiro: ancorado num nó da parte de baixo do canvas, o
   * popover descia para fora da tela e só o cabeçalho aparecia. Os campos
   * seguiam no DOM, então toda asserção de conteúdo passava verde.
   */
  const caixa = await dialogo.boundingBox();
  const janela = await page.evaluate(() => ({
    altura: window.innerHeight,
    largura: window.innerWidth,
  }));
  check(
    "o painel do frame cabe na janela (não desce para fora da tela)",
    caixa !== null &&
      caixa.y >= -1 &&
      caixa.y + caixa.height <= janela.altura + 1 &&
      caixa.x >= -1 &&
      caixa.x + caixa.width <= janela.largura + 1,
    JSON.stringify({ caixa, janela }),
  );

  const obra = dialogo.getByLabel("Obra", { exact: true });
  const disciplinas = dialogo.getByLabel("Título", { exact: true });
  const bairro = dialogo.getByLabel("Bairro", { exact: true });

  check("o frame desenha o campo da OBRA", (await obra.count()) === 1);
  check("o frame desenha o campo do BAIRRO", (await bairro.count()) === 1);
  check("o frame desenha o campo das DISCIPLINAS", (await disciplinas.count()) === 1);

  // A falha nº 1: a obra aparecia vazia e sem fantasma, como capa em branco.
  const fantasma = await obra.getAttribute("placeholder");
  check(
    "a obra do carimbo aparece no frame, JÁ QUEBRADA nas linhas que vão sair",
    fantasma === OBRA_EM_DUAS_LINHAS,
    JSON.stringify(fantasma),
  );

  // Obra e bairro saem do grupo recolhido: estão desenhados no frame agora.
  const textoRecolhido = (await dialogo.locator("details").count())
    ? await dialogo.locator("details").first().innerText()
    : "";
  check(
    "obra e bairro não aparecem DUAS vezes (saíram do grupo recolhido)",
    !/\bObra\b/.test(textoRecolhido) && !/\bBairro\b/.test(textoRecolhido),
    textoRecolhido.replace(/\s+/g, " ").slice(0, 200),
  );

  // O código derivado aparece — antes saía "—" mesmo com carimbo lido.
  const textoDoFrame = await dialogo.innerText();
  check(
    "o código do carimbo aparece no frame",
    /999[-_]26/.test(textoDoFrame),
    textoDoFrame.replace(/\s+/g, " ").slice(0, 300),
  );

  // =========================================================================
  // Cada Enter é uma linha — o que o desenho promete, a geração cumpre
  // =========================================================================
  console.log("\nCada Enter é uma linha");
  await obra.fill(OBRA_EM_DUAS_LINHAS);
  await bairro.fill(BAIRRO);
  await disciplinas.fill(TITULO_TRES_LINHAS);
  await page.screenshot({ path: `${OUT}/2-preenchido.png`, fullPage: true });

  await dialogo.getByRole("button", { name: /Aplicar/i }).click();
  await page.waitForTimeout(5000);

  const enviado = await page.evaluate(() => window.__ENVIADO.capa ?? null);
  check(
    "a geração leva o título com as TRÊS linhas digitadas",
    enviado?.tituloCapa === TITULO_TRES_LINHAS,
    JSON.stringify(enviado?.tituloCapa),
  );
  check(
    "a geração leva a obra com as DUAS linhas",
    enviado?.obra === OBRA_EM_DUAS_LINHAS,
    JSON.stringify(enviado?.obra),
  );
  check("a geração leva o bairro", enviado?.bairro === BAIRRO, JSON.stringify(enviado?.bairro));

  await page.screenshot({ path: `${OUT}/3-aplicado.png`, fullPage: true });

  // =========================================================================
  // O PDF QUE SAI — a única prova que vale
  // =========================================================================
  console.log("\nO documento gerado");
  const emBase64 = await page.evaluate(async (marcador) => {
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
    // O arquivo não fica na conversa: ela guarda só a CHAVE, e o blob vive
    // noutro store. Ler a conversa e esperar uma url devolvia null calado.
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

  check("a capa gerada tem um PDF para conferir", Boolean(emBase64));

  if (emBase64) {
    // Fica em disco: quando uma linha some da capa, ler o PDF vale mais que
    // qualquer asserção — foi assim que a data ausente apareceu.
    fs.writeFileSync(`${OUT}/capa-gerada.pdf`, Buffer.from(emBase64, "base64"));
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(Buffer.from(emBase64, "base64")),
      useSystemFonts: true,
    }).promise;
    const conteudo = await (await doc.getPage(1)).getTextContent();
    // Uma linha impressa por coordenada Y — é assim que se vê "duas linhas".
    const porLinha = new Map();
    for (const it of conteudo.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      porLinha.set(y, (porLinha.get(y) ?? "") + it.str);
    }
    const linhas = [...porLinha.entries()].sort((a, b) => b[0] - a[0]).map(([, t]) => t.trim());
    console.log(linhas.map((l) => `      | ${l}`).join("\n"));

    check(
      "a OBRA sai em duas linhas no PDF",
      linhas.includes("REFORMA E AMPLIACAO") &&
        linhas.some((l) => l.startsWith(`EMEB ${MARCADOR}`)),
      JSON.stringify(linhas.slice(0, 8)),
    );
    // A fonte do modelo perde os espaços na extração; comparar sem eles.
    const semEspaco = (s) => s.replace(/\s+/g, "");
    const contem = (t) => linhas.some((l) => semEspaco(l) === semEspaco(t));

    check(
      "a OBRA não sai DUPLICADA (os dois marcadores dividem as linhas)",
      linhas.filter((l) => l === "REFORMA E AMPLIACAO").length === 1,
      JSON.stringify(linhas),
    );
    check(
      "as três DISCIPLINAS saem uma por linha",
      linhas.some((l) => /VOLUME1?.?–?PROJETODEURBANIZACAO/.test(semEspaco(l))) &&
        contem("PROJETO DE PAISAGISMO") &&
        contem("MAQUETE ELETRONICA"),
      JSON.stringify(linhas),
    );
    check("o BAIRRO sai na capa", contem(BAIRRO), JSON.stringify(linhas));
    // O config de Criciúma pede `parenthesized-padded`, e o construtor fixava
    // "plain-padded" — as capas feitas à mão em docs/samples/116-25 dizem "(TOMO 01)".
    check(
      "o TOMO sai no formato que o template pede",
      linhas.some((l) => /^\(TOMO0\d\)$/.test(l.replace(/\s+/g, ""))),
      JSON.stringify(linhas.filter((l) => /TOMO/i.test(l))),
    );
  }

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
