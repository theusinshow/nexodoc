/**
 * A costura da camada de texto, contra o pdf.js DE VERDADE.
 *
 *   node scripts/prova-texto-do-pdf.ts   (== npm run prova:texto-do-pdf)
 *
 * POR QUE ESTA PROVA EXISTE ALÉM DO TESTE PURO
 *
 * `test:texto-do-pdf` prova a REGRA sobre itens que eu mesmo montei. Isso deixa
 * de fora justamente a premissa em que a regra inteira se apoia: que
 * `transform[4]` é o x, que `width` é a largura já ocupada e que `height` é o
 * corpo da fonte. Se o pdf.js entregasse qualquer uma dessas em outra unidade,
 * os testes puros continuariam verdes e a extração continuaria quebrando
 * palavra ao meio.
 *
 * A PRIMEIRA VERSÃO DESTA PROVA PASSAVA À TOA, e o registro fica porque a
 * armadilha é boa: eu havia montado o PDF posicionando os pedaços à mão, supondo
 * que kerning bastasse para o pdf.js devolver itens separados. Não basta — ele
 * junta trechos colados sozinho, e o "antes" saía idêntico ao "depois". O corte
 * de verdade acontece quando o ESTADO do texto muda, e o caso que aparece em
 * memorial é a troca de fonte no meio da palavra (um "R" em negrito seguido do
 * resto em regular). É assim que o fixture é montado agora — e a primeira
 * asserção confere que ele ainda reproduz o defeito, para esta prova nunca mais
 * ficar verde por não ter o que testar.
 *
 * Não gasta token e não precisa de amostra confidencial: o arquivo nasce e
 * morre em memória.
 */
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { extractPdfText } from "../lib/pdf-text.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const CORPO = 12;
/** Ajuste de kerning: fração pequena do corpo, longe de um espaço. */
const KERNING = CORPO * 0.05;
/** Avanço de um espaço de verdade em fonte de texto. */
const ESPACO = CORPO * 0.28;
/** Espaço APERTADO, o pior caso do lado de cá do limiar. */
const ESPACO_APERTADO = CORPO * 0.22;

const doc = await PDFDocument.create();
const regular = await doc.embedFont(StandardFonts.Helvetica);
const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
const pagina = doc.addPage([595, 842]);

/**
 * Escreve uma linha alternando negrito e regular a cada pedaço. A alternância é
 * o que força o pdf.js a cortar item — é ela que reproduz o defeito.
 */
function linha(y: number, pedacos: Array<[string, number]>) {
  let x = 60;
  pedacos.forEach(([texto, vao], i) => {
    const fonte = i % 2 === 0 ? negrito : regular;
    pagina.drawText(texto, { x, y, size: CORPO, font: fonte });
    x += fonte.widthOfTextAtSize(texto, CORPO) + vao;
  });
}

linha(780, [["r", KERNING], ["espingos", 0]]);
linha(756, [["d", KERNING], ["a pia", 0]]);
linha(732, [["P", KERNING], ["c", KERNING], ["D", 0]]);
linha(708, [["PROJETO", ESPACO], ["EXECUTIVO", 0]]);
linha(684, [["kg", ESPACO_APERTADO], ["f", 0]]);
linha(660, [["ABNT", ESPACO], ["NBR", ESPACO], ["9050", 0]]);

const buffer = Buffer.from(await doc.save());

// --- o fixture ainda reproduz o defeito? ------------------------------------
/*
 * Lê a mesma página pelo pdf.js cru e refaz a costura ANTIGA (todo item colado
 * ao seguinte por um espaço). Se este texto vier certo, o PDF parou de partir
 * as palavras e o resto da prova não estaria medindo nada.
 */
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const cru = await pdfjs.getDocument({
  data: new Uint8Array(buffer),
  disableWorker: true,
} as Parameters<typeof pdfjs.getDocument>[0]).promise;
const itens = (await (await cru.getPage(1)).getTextContent()).items as Array<{ str?: string }>;
await cru.destroy();
const comoEra = itens
  .map((i) => (typeof i.str === "string" ? i.str : ""))
  .filter(Boolean)
  .join(" ")
  .replace(/\s+/g, " ")
  .trim();

console.log(`\n  costura antiga: ${JSON.stringify(comoEra)}`);

test("o fixture REPRODUZ o defeito (senão esta prova não mede nada)", () => {
  assert.match(comoEra, /r espingos/);
  assert.match(comoEra, /P c D/);
});

// --- e o caminho de verdade conserta? ---------------------------------------
const extraido = await extractPdfText(buffer);
const texto = extraido.pages[0]?.text ?? "";
console.log(`  costura nova:   ${JSON.stringify(texto)}\n`);

test("palavra partida por troca de fonte volta inteira", () => {
  assert.match(texto, /respingos/);
  assert.doesNotMatch(texto, /r espingos/);
});

test("letra solta antes de palavra com espaço interno", () => {
  assert.match(texto, /da pia/);
});

test("sigla escrita em três desenhos volta como uma", () => {
  assert.match(texto, /PcD/);
  assert.doesNotMatch(texto, /P c D/);
});

test("espaço de verdade continua espaço", () => {
  assert.match(texto, /PROJETO EXECUTIVO/);
});

test("unidade com espaço apertado não gruda no número", () => {
  assert.match(texto, /kg f/);
});

test("norma não vira palavra única", () => {
  assert.match(texto, /ABNT NBR 9050/);
});

console.log(`\n${passed} teste(s) OK`);
