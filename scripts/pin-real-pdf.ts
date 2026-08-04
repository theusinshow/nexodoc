/**
 * Porta de qualidade do PIN da auditoria visual: roda `locateTermOnPage` contra
 * a camada de texto REAL de um memorial (pdfjs), não contra itens de mentira.
 *
 * O que se mede aqui não é a matemática do percentual — isso o teste puro já
 * prova. É a única pergunta que o teste puro NUNCA alcança: a evidência que a
 * auditoria escreve casa com o texto que o pdfjs devolve? Se não casar, o pin
 * não existe no produto e o desenho do canvas muda.
 *
 *   node scripts/pin-real-pdf.ts "<caminho.pdf>" ["<pagina>=<termo>" ...]
 *
 * Sem casos na linha de comando, usa os erros reais de identidade do 017_26
 * (memorial de Criciúma com texto reaproveitado de outros 3 projetos).
 */
import { readFile } from "node:fs/promises";

import { locateTermOnPage } from "../server/nexo/audit/locate-term.ts";
import type { TextItem } from "../server/nexo/audit/locate-term.ts";

// Erros reais, página conferida à mão no PDF assinado.
const CASOS_017_26: { pagina: number; termo: string }[] = [
  { pagina: 11, termo: "Cidade do Autista" },
  { pagina: 112, termo: "Centro Dia do Idoso" },
  { pagina: 114, termo: "Centro Dia do Idoso" },
  { pagina: 115, termo: "unidade básica de saúde" },
  { pagina: 118, termo: "Centro Comunitário Boa Vista" },
];

const caminho = process.argv[2];
if (!caminho) {
  console.error('uso: node scripts/pin-real-pdf.ts "<caminho.pdf>" ["<pagina>=<termo>" ...]');
  process.exit(2);
}

const casos = process.argv.slice(3).length
  ? process.argv.slice(3).map((arg) => {
      const [pagina, ...resto] = arg.split("=");
      return { pagina: Number.parseInt(pagina, 10), termo: resto.join("=") };
    })
  : CASOS_017_26;

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const buffer = await readFile(caminho);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(buffer),
  disableWorker: true,
} as Parameters<typeof pdfjs.getDocument>[0]).promise;

console.log(`\n${caminho}\n${doc.numPages} páginas · ${casos.length} casos\n`);

let acertos = 0;
for (const caso of casos) {
  if (!Number.isFinite(caso.pagina) || caso.pagina < 1 || caso.pagina > doc.numPages) {
    console.log(`  MISS  p.${caso.pagina} "${caso.termo}" — página fora do documento`);
    continue;
  }

  const page = await doc.getPage(caso.pagina);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const items: TextItem[] = content.items
    .filter((item): item is Extract<typeof item, { str: string }> => "str" in item)
    .map((item) => ({
      str: item.str,
      transform: item.transform,
      width: item.width,
      height: item.height,
    }));

  const pos = locateTermOnPage({
    items,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    termo: caso.termo,
  });

  if (pos) {
    acertos++;
    console.log(
      `  ok    p.${caso.pagina} "${caso.termo}" → x=${(pos.xPct * 100).toFixed(1)}% y=${(pos.yPct * 100).toFixed(1)}%`,
    );
  } else {
    // Diagnóstico do MISS: o termo está na página, só não casou item a item?
    const juntou = items
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ");
    const naPagina = juntou
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .includes(
        caso.termo
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase(),
      );
    console.log(
      `  MISS  p.${caso.pagina} "${caso.termo}" — ${
        naPagina
          ? "o termo ESTÁ na página, mas quebrado entre itens da camada de texto"
          : "o termo não está nesta página"
      }`,
    );
  }
}

await doc.destroy();

const taxa = casos.length ? Math.round((acertos / casos.length) * 100) : 0;
console.log(`\n${acertos}/${casos.length} ancorados (${taxa}%)`);

// Metade dos pins é o piso: abaixo disso o canvas viraria uma parede de badges
// de página e o desenho centrado no pin não se sustenta.
if (taxa < 50) {
  console.error("\nTaxa abaixo do piso de 50% — o pin não se sustenta como desenho.");
  process.exitCode = 1;
}
