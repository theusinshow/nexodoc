/**
 * A folha em branco depois da capa (15/10/2026): o 138-26 de Chapecó, com obra
 * de quatro linhas e dois títulos, saía com a capa em DUAS páginas — a segunda
 * vazia — e o volume levava as duas.
 *
 *   node scripts/test-pagina-em-branco.ts   (== npm run test:pagina-em-branco)
 *
 * Com um PDF de capa real como argumento, conta também as páginas dele:
 *   node scripts/test-pagina-em-branco.ts capa.pdf
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PDFDocument, StandardFonts } from "pdf-lib";

import { conteudoPinta, semPaginasEmBranco } from "../server/nexo/tools/pagina-em-branco.ts";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

// O fluxo EXATO da página 2 da capa gerada pelo LibreOffice.
const PAGINA_VAZIA_DO_LIBREOFFICE = "0.1 w\n/Artifact BMC\nq 0 0.028 595.276 841.861 re\nW* n\nEMC\nQ\n";

await test("a página vazia do LibreOffice (só o recorte) não pinta nada", () => {
  assert.equal(conteudoPinta(PAGINA_VAZIA_DO_LIBREOFFICE), false);
});

await test("texto, imagem e traço pintam", () => {
  assert.equal(conteudoPinta("BT\n143.5 731.9 Td /F1 16 Tf[<01>4<0203>]TJ\nET"), true);
  assert.equal(conteudoPinta("q 100 0 0 50 0 0 cm /Im1 Do Q"), true);
  assert.equal(conteudoPinta("0 0 m 100 100 l S"), true);
  assert.equal(conteudoPinta("0 0 100 100 re f"), true);
  assert.equal(conteudoPinta("BT /F1 12 Tf (oi) Tj ET"), true);
});

await test("Tf (só escolhe a fonte) não conta como pintar", () => {
  assert.equal(conteudoPinta("BT /F1 12 Tf ET"), false);
});

async function pdfCom(paginas: ("texto" | "vazia")[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (const p of paginas) {
    const pagina = doc.addPage([595, 842]);
    if (p === "texto") pagina.drawText("CAPA", { x: 100, y: 700, size: 16, font: fonte });
  }
  return Buffer.from(await doc.save());
}

await test("capa + página vazia → só a capa", async () => {
  const { buffer, removidas } = await semPaginasEmBranco(await pdfCom(["texto", "vazia"]));
  assert.equal(removidas, 1);
  assert.equal((await PDFDocument.load(buffer)).getPageCount(), 1);
});

await test("duas capas (tomos) com vazias intercaladas → as duas capas", async () => {
  const { buffer } = await semPaginasEmBranco(await pdfCom(["texto", "vazia", "texto", "vazia"]));
  assert.equal((await PDFDocument.load(buffer)).getPageCount(), 2);
});

await test("nada em branco → o MESMO buffer", async () => {
  const original = await pdfCom(["texto", "texto"]);
  const { buffer, removidas } = await semPaginasEmBranco(original);
  assert.equal(removidas, 0);
  assert.equal(buffer, original);
});

await test("tudo em branco → não tira nada (o defeito é outro, e tem de aparecer)", async () => {
  const original = await pdfCom(["vazia"]);
  const { buffer } = await semPaginasEmBranco(original);
  assert.equal(buffer, original);
});

const real = process.argv[2];
if (real) {
  await test(`PDF real (${real}): sai com 1 página`, async () => {
    const { buffer, removidas } = await semPaginasEmBranco(readFileSync(real));
    console.log(`      removidas: ${removidas}`);
    assert.equal((await PDFDocument.load(buffer)).getPageCount(), 1);
  });
}

console.log(`\n${passed} teste(s) da página em branco OK`);
