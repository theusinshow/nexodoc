// O RECORTE DO SELO no NAVEGADOR — sem gastar um token.
//
// Os testes puros provam a REGRA (`test:nexo:selo-regiao`, `test:nexo:texto-cad`)
// e o diagnóstico em node prova a MEDIDA sobre os PDFs reais. O que nenhum dos
// dois alcança é o que só existe no browser: `renderSeloCrop` desenha a página
// num canvas e recorta a caixa medida, e a aritmética desse recorte (escala 2,
// arredondamento, aresta máxima) é onde um erro de um pixel vira uma imagem
// vazia — e imagem vazia é uma folha ilegível, que é o defeito que este
// trabalho existe para consertar.
//
// Por isso as asserções são sobre a IMAGEM que sai: tamanho plausível, e não
// branca. Os JPEGs ficam em ./scratchpad/qa-selo para conferência a olho — é
// olhando que se vê se o carimbo está enquadrado.
//
// Não precisa do servidor de dev: o pdf.js roda direto na página em branco.
//
//   node scripts/shot-selo-recorte.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

import { repararTextoCad } from "../server/nexo/texto-cad.ts";
import { acharCaixaDoSelo, classificarPagina } from "../server/nexo/selo-regiao.ts";

const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-selo";
fs.mkdirSync(OUT, { recursive: true });

/** Um arquivo de cada família: a quebrada, a sã e a de papel largo. */
const CASOS = [
  { arquivo: "docs/samples/040-26/7_est/040_26_est_tomo1.pdf", pagina: 4 },
  { arquivo: "docs/samples/040-26/7_est/040_26_est_tomo1.pdf", pagina: 7 },
  { arquivo: "docs/samples/040-26/5_arq/040_26_vol5_arq.pdf", pagina: 5 },
  { arquivo: "docs/samples/040-26/8_met/040_26_est_met_tomo1.pdf", pagina: 4 },
];

/** A caixa do carimbo, pelos MESMOS módulos que o cliente usa. */
async function medirCaixa(pdfjs, arquivo, numero) {
  const buf = await fs.promises.readFile(arquivo);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableWorker: true }).promise;
  const page = await doc.getPage(numero);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const brutos = content.items
    .filter((r) => typeof r.str === "string" && r.str.trim() && r.transform)
    .map((r) => ({ raw: r, texto: r.str, fonte: r.fontName ?? "" }));
  const { textos } = repararTextoCad(brutos);
  const itens = brutos.map((b, i) => {
    const [vx, vy] = vp.convertToViewportPoint(b.raw.transform[4], b.raw.transform[5]);
    return { texto: textos[i].trim(), x: vx / vp.width, y: vy / vp.height };
  });

  const tipo = classificarPagina({ largura: vp.width, altura: vp.height, itens });
  const { caixa, ancoras } = acharCaixaDoSelo(itens);
  await doc.destroy();
  return { caixa, ancoras, tipo };
}

/**
 * Servidor estático mínimo só para o pdf.js entrar como MÓDULO. `about:blank`
 * não serve: o Chromium recusa `import()` de `file://` por origem.
 */
function servirRaiz() {
  // `path.resolve` nos dois lados: no Windows a URL vem com barra normal e o
  // `join` devolve barra invertida, e o guarda de prefixo reprovava tudo.
  const raiz = path.resolve(
    new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  );
  const servidor = http.createServer(async (req, res) => {
    try {
      const alvo = path.resolve(path.join(raiz, decodeURIComponent(req.url.split("?")[0])));
      if (!alvo.startsWith(raiz)) return res.writeHead(403).end();
      const corpo = await fs.promises.readFile(alvo);
      res.writeHead(200, { "Content-Type": "text/javascript" }).end(corpo);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    servidor.listen(0, "127.0.0.1", () =>
      resolve({ servidor, porta: servidor.address().port }),
    );
  });
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { servidor, porta } = await servirRaiz();
const BASE_PDFJS = `http://127.0.0.1:${porta}/node_modules/pdfjs-dist/legacy/build/pdf.mjs`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${porta}/`);

let ok = 0;
for (const caso of CASOS) {
  const { caixa, ancoras, tipo } = await medirCaixa(pdfjs, caso.arquivo, caso.pagina);
  assert.equal(tipo, "prancha", `${caso.arquivo} p.${caso.pagina} devia ser prancha`);
  assert.ok(ancoras >= 3, "a caixa tem de ser MEDIDA, não a de reserva");

  const bytes = [...(await fs.promises.readFile(caso.arquivo))];
  const url = BASE_PDFJS;

  // O MESMO cálculo de `renderSeloCrop`, rodando onde ele roda de verdade.
  const resultado = await page.evaluate(
    async ({ bytes, numero, caixa, url }) => {
      const pdfjsLib = await import(url);
      pdfjsLib.GlobalWorkerOptions.workerSrc = url.replace("pdf.mjs", "pdf.worker.mjs");
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const p = await doc.getPage(numero);

      const RENDER_SCALE = 2;
      const MAX_IMAGE_EDGE = 2400;
      const viewport = p.getViewport({ scale: RENDER_SCALE });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.ceil(viewport.width);
      pageCanvas.height = Math.ceil(viewport.height);
      const ctx = pageCanvas.getContext("2d");
      await p.render({ canvasContext: ctx, viewport }).promise;

      const cropX = Math.floor(caixa.x0 * pageCanvas.width);
      const cropY = Math.floor(caixa.y0 * pageCanvas.height);
      const cropW = Math.max(
        1,
        Math.min(Math.ceil((caixa.x1 - caixa.x0) * pageCanvas.width), pageCanvas.width - cropX),
      );
      const cropH = Math.max(
        1,
        Math.min(Math.ceil((caixa.y1 - caixa.y0) * pageCanvas.height), pageCanvas.height - cropY),
      );
      const longest = Math.max(cropW, cropH);
      const factor = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;
      const outW = Math.max(1, Math.round(cropW * factor));
      const outH = Math.max(1, Math.round(cropH * factor));

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = outW;
      cropCanvas.height = outH;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(pageCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

      // Quanto da imagem NÃO é branco. Recorte fora do papel sai todo branco —
      // e um JPEG branco passa por qualquer verificação de tamanho.
      const dados = cropCtx.getImageData(0, 0, outW, outH).data;
      let tinta = 0;
      for (let i = 0; i < dados.length; i += 4) {
        if (dados[i] < 200 || dados[i + 1] < 200 || dados[i + 2] < 200) tinta++;
      }
      return {
        dataUrl: cropCanvas.toDataURL("image/jpeg", 0.92),
        outW,
        outH,
        fracaoComTinta: tinta / (outW * outH),
      };
    },
    { bytes, numero: caso.pagina, caixa, url },
  );

  const nome = `${path.basename(caso.arquivo, ".pdf")}-p${caso.pagina}.jpg`;
  fs.writeFileSync(
    path.join(OUT, nome),
    Buffer.from(resultado.dataUrl.split(",")[1], "base64"),
  );

  assert.ok(resultado.outW > 200 && resultado.outH > 100, `recorte degenerado em ${nome}`);
  assert.ok(
    resultado.fracaoComTinta > 0.01,
    `recorte praticamente em branco em ${nome} (tinta=${resultado.fracaoComTinta})`,
  );

  console.log(
    `  ok  ${nome}  ${resultado.outW}x${resultado.outH}  âncoras=${ancoras}  ` +
      `caixa=[${caixa.x0.toFixed(2)},${caixa.y0.toFixed(2)}]  tinta=${(resultado.fracaoComTinta * 100).toFixed(1)}%`,
  );
  ok++;
}

await browser.close();
servidor.close();
console.log(`\n${ok} recorte(s) ok — imagens em ${OUT}`);
