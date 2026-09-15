/**
 * Teste dos DOCUMENTOS SINTÉTICOS da bateria.
 *
 * Uma jornada que anexa "um memorial com uma folha muda" só prova alguma coisa
 * se o PDF for mesmo isso para o produto. Aqui cada fixture passa pelo MESMO
 * leitor que a produção usa — pdf.js, `extractPdfText`, `classificarPagina` do
 * carimbo, `parseFilename` —, e não por uma inspeção feita à mão. Sem isto, uma
 * jornada verde poderia estar anexando um documento que nunca exercitou o caso.
 *
 *   node scripts/test-fixtures-da-bateria.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { NOMES, bytesDasFixtures, garantirFixtures } from "./bateria/lib/fixtures.mjs";
import { normalizarItens } from "../lib/coordenada-do-pdf.ts";
import { diagnosticarPaginasMudas } from "../lib/pagina-muda.ts";
import { extractPdfText } from "../lib/pdf-text.ts";
import { parseFilename } from "../server/nexo/parse-filename.ts";
import {
  acharCaixaDoSelo,
  classificarPagina,
  conteudoDoSelo,
  valeLerComoPrancha,
} from "../server/nexo/selo-regiao.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

/** A mesma regra do código do projeto que a classificação do memorial usa (lib/audit-classify.ts:93). */
const CODIGO_NO_TEXTO = /\b\d{2,4}[_-]\d{2}\b/g;

const bytes = await bytesDasFixtures();

/** Os itens de texto da página 1, normalizados como `analisarPagina` faz no navegador. */
async function itensDaPagina(dados: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(dados),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const pagina = await doc.getPage(1);
  const viewport = pagina.getViewport({ scale: 1 });
  const conteudo = await pagina.getTextContent();
  const brutos = (conteudo.items as { str?: string; transform?: number[] }[])
    .filter((i) => i.str && i.transform)
    .map((i) => {
      const [x, y] = viewport.convertToViewportPoint(i.transform![4], i.transform![5]);
      return { texto: i.str!.trim(), x, y };
    });
  const itens = normalizarItens(brutos, { largura: viewport.width, altura: viewport.height });
  await doc.destroy();
  return { itens, largura: viewport.width, altura: viewport.height };
}

await test("memorial curto: memorial pelo nome, código 990-26, texto de sobra e nenhuma folha muda", async () => {
  const nome = NOMES.memorialCurto;
  assert.equal(parseFilename(nome).tipo, "memorial");
  assert.equal(parseFilename(nome).codigo, "990-26");
  const extraido = await extractPdfText(Buffer.from(bytes[nome]));
  assert.equal(extraido.pageCount, 3);
  assert.ok(extraido.charCount >= 300, `charCount=${extraido.charCount}`);
  assert.deepEqual([...new Set(extraido.text.match(CODIGO_NO_TEXTO))], ["990-26"]);
  assert.deepEqual(diagnosticarPaginasMudas(extraido).mudas, []);
  const citaveis = extraido.text.split("\n").filter((l) => l.trim().length >= 40 && l.trim().length <= 160);
  assert.ok(citaveis.length >= 3, `linhas citáveis=${citaveis.length}`);
});

await test("memorial com folha muda: a quarta página, e só ela, é muda", async () => {
  const extraido = await extractPdfText(Buffer.from(bytes[NOMES.memorialComFolhaMuda]));
  const diagnostico = diagnosticarPaginasMudas(extraido);
  assert.equal(diagnostico.totalDePaginas, 4);
  assert.deepEqual(diagnostico.mudas, [4]);
});

await test("memorial sem código: nem no nome, nem no texto", async () => {
  const nome = NOMES.memorialSemCodigo;
  assert.equal(parseFilename(nome).tipo, "memorial");
  assert.equal(parseFilename(nome).codigo, "");
  const extraido = await extractPdfText(Buffer.from(bytes[nome]));
  assert.equal(extraido.text.match(CODIGO_NO_TEXTO), null);
  assert.ok(extraido.charCount >= 300);
  assert.deepEqual(diagnosticarPaginasMudas(extraido).mudas, []);
});

await test("prancha legível: carimbo achado pelas âncoras e CONTEÚDO lido pela geometria", async () => {
  for (const [i, nome] of NOMES.pranchas.entries()) {
    assert.notEqual(parseFilename(nome).tipo, "memorial", nome);
    const { itens, largura, altura } = await itensDaPagina(bytes[nome]);
    assert.equal(classificarPagina({ largura, altura, itens }), "prancha", nome);
    assert.ok(acharCaixaDoSelo(itens).ancoras >= 3, nome);
    assert.equal(conteudoDoSelo(itens), `PLANTA DE FORMAS DO BLOCO ${"ABC"[i]}`, nome);
    const codigos = itens.filter((it) => /\b\d{2,4}[_-]\d{2}[_a-z0-9.]*[_-]\d{2,3}[_-][a-z]\b/i.test(it.texto));
    assert.equal(codigos.length, 1, `${nome}: um código de prancha só (três viram índice)`);
  }
});

await test("prancha sem selo: nenhum texto, e mesmo assim vai para a leitura", async () => {
  const { itens, largura, altura } = await itensDaPagina(bytes[NOMES.pranchaSemSelo]);
  assert.equal(itens.length, 0);
  const tipo = classificarPagina({ largura, altura, itens });
  assert.equal(tipo, "outra");
  assert.equal(valeLerComoPrancha(tipo), true);
});

await test("a revisão do memorial curto tem o MESMO nome e outros bytes (c1)", async () => {
  assert.equal(path.basename(NOMES.memorialCurtoRevisado), NOMES.memorialCurto);
  assert.ok(!Buffer.from(bytes[NOMES.memorialCurto]).equals(Buffer.from(bytes[NOMES.memorialCurtoRevisado])));
});

await test("duas gerações dão os mesmos bytes", async () => {
  const outra = await bytesDasFixtures();
  for (const nome of Object.keys(bytes)) {
    assert.ok(Buffer.from(bytes[nome]).equals(Buffer.from(outra[nome])), nome);
  }
});

await test("garantirFixtures grava os arquivos que as jornadas anexam", async () => {
  const f = await garantirFixtures();
  const caminhos = [f.memorialCurto, f.memorialCurtoRevisado, f.memorialComFolhaMuda, f.memorialSemCodigo, ...f.pranchas, f.pranchaSemSelo];
  assert.equal(caminhos.length, 8);
  for (const c of caminhos) {
    assert.ok(fs.existsSync(c), c);
    assert.ok(c.replaceAll("\\", "/").startsWith("scratchpad/bateria/fixtures/"), c);
  }
});

console.log(`\n${passed} teste(s) passaram`);
