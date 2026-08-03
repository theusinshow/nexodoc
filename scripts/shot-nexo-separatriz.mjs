// A SEPARATRIZ do Nexo no navegador, antes de aposentar a tela `/separatrizes`.
//
// A paridade dela foi implementada em 93f1a03 e nunca foi exercitada: os três
// itens que a tela antiga tinha a mais (lote de títulos, saída em ODT, nome com
// código e revisão) só existiam em código. Remover a tela sem provar o
// substituto seria remover a única saída conhecida que funciona.
//
// A regra de "uma folha por título" já tem teste puro (`test:nexo:parts`). O que
// falta, e é o que este arquivo faz, é a FIAÇÃO: o card mandar a lista inteira,
// o servidor devolver os três arquivos e o nome carregar o código do projeto.
//
// Encenado: o OCR do carimbo e o turno do agente. REAL: a geração, que passa
// pelo template oficial e pelo LibreOffice.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-separatriz.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-separatriz";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA AUTOMATICO SEPARATRIZ";
/** As três disciplinas ditadas na conversa — uma folha para cada. */
const TITULOS = ["HIDROSSANITARIO", "PREVENTIVO CONTRA INCENDIO", "SPDA"];

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
  ({ marcador, titulos }) => {
    const original = window.fetch.bind(window);
    window.__ENVIADO = {};

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
            obra: marcador,
            fase: "EXECUTIVO",
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
              // A LISTA ditada pelo engenheiro: era o único uso que ainda
              // obrigava a abrir a tela antiga.
              proposals: [
                {
                  kind: "separatriz",
                  resumo: "Separatrizes do volume",
                  params: { templateId: "", numTomos: 1, titulos },
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

      if (url.includes("/api/nexo/separatriz")) {
        try {
          window.__ENVIADO.separatriz = JSON.parse(init.body ?? "{}");
        } catch {}
      }

      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, titulos: TITULOS },
);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});

  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 90000 });

  console.log("\nAs separatrizes de três disciplinas, numa tacada");
  const composer = page.locator("textarea").first();
  await composer.fill("Cria as separatrizes de hidrossanitario, incendio e SPDA");
  await composer.press("Enter");

  // O card lista as três ANTES de gerar — é a confirmação read-only (C1).
  const cardSeparatriz = page.getByText(/Disciplinas \(3 folhas\)/i);
  await cardSeparatriz.first().waitFor({ timeout: 30000 });
  check("o card confirma as 3 disciplinas antes de gerar", true);
  const textoDoCard = await page.locator("body").innerText();
  for (const t of TITULOS) {
    check(`  · ${t} aparece na confirmação`, textoDoCard.includes(t));
  }
  await page.screenshot({ path: `${OUT}/1-proposta.png`, fullPage: true });

  await page.getByRole("button", { name: /Confirmar e gerar|Gerar/i }).first().click();
  await page.waitForTimeout(12000);

  const enviado = await page.evaluate(() => window.__ENVIADO.separatriz ?? null);
  check(
    "a geração leva a LISTA inteira (não uma folha só)",
    Array.isArray(enviado?.titulos) && enviado.titulos.length === 3,
    JSON.stringify(enviado?.titulos),
  );
  check(
    "a ordem ditada é a ordem enviada",
    JSON.stringify(enviado?.titulos) === JSON.stringify(TITULOS),
    JSON.stringify(enviado?.titulos),
  );
  check(
    "o nome do arquivo leva o código do projeto",
    enviado?.codigo === "999-26" || enviado?.codigo === "999_26",
    JSON.stringify(enviado?.codigo),
  );

  /*
   * Os três arquivos da saída. Eles NÃO aparecem no texto da tela — o plano
   * manda conferir no canvas —, então a asserção é sobre o artefato guardado,
   * que é de onde o download sai e o que entra no volume.
   */
  const arquivos = await page.evaluate(async (marcador) => {
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
    const sep = (atual?.results ?? []).find((r) => r.kind === "separatriz");
    return { arquivos: sep?.files ?? [], resumo: sep?.summary ?? "" };
  }, MARCADOR);

  const nomes = arquivos.arquivos.map((f) => f.name);
  check("a saída oferece o ZIP", nomes.some((n) => /\.zip$/i.test(n)), nomes.join(", "));
  check(
    "a saída oferece o ODT (o editável — o que a tela antiga tinha e faltava aqui)",
    nomes.some((n) => /\.odt$/i.test(n)),
    nomes.join(", "),
  );
  check("a saída oferece o PDF", nomes.some((n) => /\.pdf$/i.test(n)), nomes.join(", "));
  check(
    "o nome do arquivo diz de que projeto é",
    nomes.every((n) => /999[-_]26_separatrizes/i.test(n)),
    nomes.join(", "),
  );
  check(
    "o resumo diz quantas folhas saíram",
    /3 folhas/i.test(arquivos.resumo),
    arquivos.resumo,
  );
  await page.screenshot({ path: `${OUT}/2-gerada.png`, fullPage: true });

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
