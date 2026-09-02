/**
 * A PÁGINA MUDA — a folha que tem conteúdo e não entrega caractere.
 *
 * O caso real: `114_19_VOLUME ÚNICO.pdf` entregou 7.470 caracteres em 31
 * páginas (241 por página) e a auditoria opinou sobre o memorial com um décimo
 * dele na mão, sem avisar. 25 das 31 folhas têm o texto DESENHADO — curva
 * vetorial ou tira de imagem —, não escrito.
 *
 *   node scripts/test-pagina-muda.ts   (== npm run test:pagina-muda)
 */
import assert from "node:assert/strict";

import {
  LIMIAR_DE_CARACTERES,
  aplicarTranscricao,
  classificarPagina,
  diagnosticarPaginasMudas,
  fraseDoDiagnostico,
} from "../lib/pagina-muda.ts";
import { montarDocumento, type ExtractedPdf, type ExtractedPdfPage } from "../lib/pdf-text.ts";

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

function pagina(page: number, text: string, tinta?: { desenho: number; imagem: number }) {
  return { page, text, ...(tinta ? { tinta } : {}) } satisfies ExtractedPdfPage;
}

/*
 * O documento sai do MONTADOR de verdade, e não de uma soma escrita aqui.
 *
 * A primeira versão deste ajudante juntava as páginas com "\n" e chamava o
 * comprimento disso de `charCount` — e assim a fixture media 502 onde o
 * `extractPdfText` mediria 500. Fixture que discorda do produtor real testa o
 * ajudante, não o código.
 */
function documento(pages: ExtractedPdfPage[]): ExtractedPdf {
  return montarDocumento(pages);
}

test("página com texto é texto, e não olha a tinta", () => {
  const p = classificarPagina(pagina(2, "x".repeat(3350), { desenho: 0, imagem: 0 }));
  assert.equal(p.classe, "texto");
  assert.equal(p.caracteres, 3350);
});

/*
 * A p5 do 114-19 é a LISTA DE FIGURAS inteira — 14 entradas com número de
 * página. Rasterizada, é texto nítido. Extraída, é vazia: 0 caracteres, 56
 * caminhos vetoriais e 1 imagem.
 */
test("a Lista de Figuras do 114-19: zero caractere COM tinta é muda", () => {
  const p = classificarPagina(pagina(5, "", { desenho: 56, imagem: 1 }));
  assert.equal(p.classe, "muda");
});

/* A p9 do 114-19: cada LINHA do parágrafo virou uma tira de imagem 944x92. */
test("parágrafo colado como tira de imagem é muda", () => {
  const p = classificarPagina(pagina(9, "", { desenho: 24, imagem: 24 }));
  assert.equal(p.classe, "muda");
});

/*
 * O sinal existe para ISTO: sem ele o detector é um contador de caracteres, e
 * pagaria transcrição por toda folha de separação em branco de todo volume.
 */
test("folha em branco de verdade é vazia, e não paga transcrição", () => {
  const p = classificarPagina(pagina(12, "", { desenho: 0, imagem: 0 }));
  assert.equal(p.classe, "vazia");
});

test("sem medição de tinta, a folha muda é suspeita — nunca declarada vazia", () => {
  // Fixture antiga e parecer velho não trazem `tinta`. Chamá-los de "vazia"
  // faria o detector afirmar em silêncio que não há nada a recuperar.
  assert.equal(classificarPagina(pagina(7, "")).classe, "muda");
});

/*
 * A prancha de cálculo (p23-p29): 24 caracteres, que são só a legenda
 * "Passarela Canal da Barra". Os rótulos do desenho — POA-PAS. ACO CANAL DA
 * BARRA, GEOMETRIA, as cotas — estão todos em vetor.
 */
test("legenda solta sob prancha vetorial não conta como página lida", () => {
  const p = classificarPagina(pagina(23, "Passarela Canal da Barra", { desenho: 8, imagem: 1 }));
  assert.equal(p.classe, "muda");
  assert.ok(p.caracteres < LIMIAR_DE_CARACTERES);
});

test("o limiar fica no vão medido do 114-19, entre 59 e 359", () => {
  // As mudas entregam 0, 24, 33 e 59; as de texto real, 359 e acima.
  assert.ok(LIMIAR_DE_CARACTERES > 59, "59 caracteres não é uma página lida");
  assert.ok(LIMIAR_DE_CARACTERES < 359, "359 caracteres é folha de rosto legítima");
});

test("o diagnóstico do 114-19: 6 de texto, 25 mudas, nenhuma vazia", () => {
  const pages: ExtractedPdfPage[] = [];
  // As 6 que a auditoria leu, com os tamanhos medidos.
  for (const [n, chars] of [[1, 359], [2, 3350], [3, 1216], [4, 756], [22, 1030], [30, 383]]) {
    pages.push(pagina(n, "x".repeat(chars)));
  }
  // As 25 mudas.
  for (const n of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 31]) {
    pages.push(pagina(n, "", { desenho: 30, imagem: 2 }));
  }
  pages.sort((a, b) => a.page - b.page);

  const d = diagnosticarPaginasMudas(documento(pages));
  assert.equal(d.mudas.length, 25);
  assert.equal(d.paginas.filter((p) => p.classe === "texto").length, 6);
  assert.equal(d.paginas.filter((p) => p.classe === "vazia").length, 0);
  assert.equal(d.totalDePaginas, 31);
});

test("a frase do portão diz o número, e cala quando não há muda", () => {
  const limpo = documento([pagina(1, "x".repeat(500))]);
  assert.equal(fraseDoDiagnostico(diagnosticarPaginasMudas(limpo)), "");

  const sujo = documento([pagina(1, "x".repeat(500)), pagina(2, "", { desenho: 9, imagem: 0 })]);
  const frase = fraseDoDiagnostico(diagnosticarPaginasMudas(sujo));
  assert.match(frase, /1 de 2 p/);
  assert.match(frase, /desenhado/);
});

// ---------------------------------------------------------------- transcrição

const COM_MUDA = documento([
  pagina(1, "x".repeat(500)),
  pagina(2, "", { desenho: 40, imagem: 1 }),
  pagina(3, "", { desenho: 0, imagem: 0 }),
]);

test("a folha transcrita ganha texto e a marca da origem", () => {
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 2, texto: "3.3 Elementos analisados" }]);
  const p2 = d.pages.find((p) => p.page === 2)!;
  assert.equal(p2.text, "3.3 Elementos analisados");
  assert.equal(p2.origem, "visao");
  assert.equal(d.pages.find((p) => p.page === 1)?.origem, undefined);
});

test("o documento inteiro é remontado — texto, textoParaIA e charCount", () => {
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 2, texto: "seção recuperada" }]);
  assert.match(d.text, /--- PAGINA 2 ---\nseção recuperada/);
  assert.match(d.textoParaIA ?? "", /--- PAGINA 2 ---\nseção recuperada/);
  assert.equal(d.charCount, COM_MUDA.charCount + "seção recuperada".length);
  assert.equal(d.pageCount, 3, "a contagem de páginas não muda");
});

test("não sobrescreve página que já tinha texto próprio", () => {
  // A entrada vem do cliente. Deixá-la ditar a folha que a extração leu seria
  // deixar a EVIDÊNCIA de todo achado daquela página ser escrita de fora.
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 1, texto: "TEXTO INVENTADO" }]);
  assert.equal(d.pages.find((p) => p.page === 1)?.text, "x".repeat(500));
  assert.equal(d, COM_MUDA, "sem nada a aplicar, devolve o mesmo documento");
});

test("transcrição vazia não apaga a página", () => {
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 2, texto: "   " }]);
  assert.equal(d, COM_MUDA);
});

test("folha VAZIA de verdade não recebe transcrição", () => {
  // A p3 não tem tinta: não é candidata, e escrever nela seria inventar conteúdo
  // para uma folha em branco.
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 3, texto: "algo" }]);
  assert.equal(d, COM_MUDA);
});

test("sem transcrição nenhuma, o documento sai intacto", () => {
  assert.equal(aplicarTranscricao(COM_MUDA, []), COM_MUDA);
});

test("depois de transcrever, a folha deixa de ser muda", () => {
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 2, texto: "x".repeat(400) }]);
  assert.deepEqual(diagnosticarPaginasMudas(d).mudas, []);
});

/*
 * O CASO QUE A PROVA CONTRA O ARQUIVO REAL APANHOU.
 *
 * A prancha de cálculo do 114-19 traz só a legenda "Passarela Canal da Barra" —
 * a transcrição dela volta curta porque é isso que está escrito na folha. Pelo
 * limiar sozinho ela continuaria muda, e `contarPaginasDoDocumento` a somaria
 * duas vezes (25 mudas + 25 transcritas − 25 recuperadas = 25 pendentes): o
 * parecer declararia o documento inteiro por ler DEPOIS de a transcrição ter
 * sido paga, e depois de a auditoria ter lido tudo.
 */
test("transcrição CURTA também tira a folha da fila", () => {
  const d = aplicarTranscricao(COM_MUDA, [{ pagina: 2, texto: "Passarela Canal da Barra" }]);
  const p2 = d.pages.find((p) => p.page === 2)!;
  assert.ok(p2.text.length < LIMIAR_DE_CARACTERES, "curta de propósito");
  assert.equal(classificarPagina(p2).classe, "texto");
  assert.deepEqual(diagnosticarPaginasMudas(d).mudas, []);
});

console.log(`\n${passed} teste(s) de página muda OK`);
