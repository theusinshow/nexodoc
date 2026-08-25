/**
 * O QUE VAI PARA O BANCO É O QUE O CHAT PRECISA RELER.
 *
 * Sem banco e sem token: `memoriasDosArquivos` é função pura sobre o
 * `ExtractedPdf` que a corrida já tem na mão. A gravação acontece dentro de uma
 * transação que já existe, e o que decide o CONTEÚDO da linha precisa ser
 * testável sem subir Postgres.
 *
 *   node scripts/test-memoria-do-documento.ts  (== npm run test:memoria)
 */
import assert from "node:assert/strict";

import { memoriasDosArquivos } from "../lib/memoria-do-documento.ts";

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

const paginas = [
  { page: 1, text: "1 - PAREDES E PAINEIS\nAs alvenarias serao em bloco ceramico." },
  { page: 2, text: "Continuacao das paredes, com chapisco e emboco." },
  { page: 3, text: "2 - REVESTIMENTOS DE PISO\nPiso vinilico em manta." },
];

const extracted = (p: { page: number; text: string }[]) =>
  ({
    pages: p,
    text: p.map((x) => x.text).join("\n"),
    pageCount: p.length,
    charCount: p.reduce((s, x) => s + x.text.length, 0),
  }) as never;

const memorias = memoriasDosArquivos([
  { file: { name: "063_26_md_geral_a.pdf" }, extracted: extracted(paginas) },
]);

test("uma memoria por arquivo, com o nome do arquivo", () => {
  assert.equal(memorias.length, 1);
  assert.equal(memorias[0].fileName, "063_26_md_geral_a.pdf");
});

test("guarda UMA entrada por pagina, com o numero real da pagina", () => {
  assert.deepEqual(
    memorias[0].paginas.map((p) => p.page),
    [1, 2, 3],
  );
  assert.ok(memorias[0].paginas[0].text.includes("bloco ceramico"));
});

test("o indice de capitulos vem SEM o texto", () => {
  const cap = memorias[0].capitulos;
  assert.ok(cap.length >= 2, `esperava 2+ capitulos, veio ${cap.length}`);
  for (const c of cap) {
    // Guardar o texto aqui tambem dobraria o armazenamento: ele se reconstroi
    // das paginas.
    assert.ok(!("text" in c), `capitulo ${c.id} carregou o texto`);
    assert.equal(typeof c.chars, "number");
    assert.ok(c.startPage >= 1 && c.endPage >= c.startPage);
  }
});

test("o titulo do capitulo sai do cabecalho da pagina", () => {
  const titulos = memorias[0].capitulos.map((c) => c.title).join(" | ");
  assert.ok(/PAREDES/i.test(titulos), `titulos: ${titulos}`);
  assert.ok(/REVESTIMENTOS/i.test(titulos), `titulos: ${titulos}`);
});

test("charCount bate com a soma das paginas", () => {
  const soma = memorias[0].paginas.reduce((s, p) => s + p.text.length, 0);
  assert.equal(memorias[0].charCount, soma);
});

test("a pagina guardada leva a grade da tabela junto", () => {
  // `textoDaPaginaParaIA` anexa a grade; e o texto que o modelo le, e o chat
  // precisa ver a tabela pelo mesmo motivo que o auditor precisa.
  const comTabela = memoriasDosArquivos([
    {
      file: { name: "t.pdf" },
      extracted: {
        pages: [{ page: 1, text: "Quadro de areas", tabelas: [{ linhas: [["Sala", "12,5"]] }] }],
        text: "Quadro de areas",
        pageCount: 1,
        charCount: 15,
      } as never,
    },
  ]);
  assert.ok(comTabela[0].paginas[0].text.includes("12,5"));
});

test("arquivo sem paginas nao vira memoria vazia no banco", () => {
  // Uma memoria vazia faria o chat achar que TEM o documento e responder "nao
  // consta" sobre tudo -- pior que o modo degradado, que ao menos avisa.
  const vazio = memoriasDosArquivos([{ file: { name: "v.pdf" }, extracted: extracted([]) }]);
  assert.equal(vazio.length, 0);
});

console.log(`\n${passed} teste(s) de memoria do documento OK`);
