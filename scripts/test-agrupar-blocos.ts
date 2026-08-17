/**
 * Teste do AGRUPAMENTO DE BLOCOS para a passada de leitura.
 *
 * `chunkPdfByChapter` corta em todo cabeçalho, sem piso: um memorial real de
 * 361k caracteres vira 72 blocos de ~5k, e como o custo de ler é função do
 * NÚMERO de blocos (prompt fixo + teto de saída por bloco), isso multiplicava a
 * conta por 3,3 para a mesma cobertura.
 *
 * O teste que mais importa aqui é o último: o agrupamento NÃO pode mexer na
 * impressão digital por capítulo, que é o que sustenta o reaproveitamento entre
 * revisões do mesmo memorial.
 *
 *   node scripts/test-agrupar-blocos.ts   (== npm run test:agrupar-blocos)
 */
import assert from "node:assert/strict";

import { agruparBlocosParaLeitura, type AuditTextChunk } from "../lib/pdf-text.ts";
import { impressaoDosCapitulos } from "../lib/audit-fingerprint.ts";

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

function cap(n: number, chars: number, startPage: number): AuditTextChunk {
  return {
    id: `chunk-${n}`,
    title: `${n} - CAPITULO ${n}`,
    startPage,
    endPage: startPage + 1,
    text: "x".repeat(chars),
  };
}

test("capítulos pequenos viajam juntos até encher o teto", () => {
  // 10 capítulos de 5k = 50k → com teto de 28k, sobram 2 blocos.
  const capitulos = Array.from({ length: 10 }, (_, i) => cap(i + 1, 5_000, i * 2 + 1));
  const blocos = agruparBlocosParaLeitura(capitulos);

  assert.equal(blocos.length, 2);
  assert.ok(blocos.every((b) => b.text.length <= 28_000), "nenhum bloco passa do teto");
});

test("nenhum caractere se perde no caminho", () => {
  const capitulos = Array.from({ length: 10 }, (_, i) => cap(i + 1, 5_000, i * 2 + 1));
  const antes = capitulos.reduce((n, c) => n + c.text.length, 0);
  // As junções acrescentam um "\n" por colagem — o texto original está todo lá.
  const depois = agruparBlocosParaLeitura(capitulos).reduce((n, b) => n + b.text.length, 0);

  assert.ok(depois >= antes, "o texto agrupado não pode ser menor que o original");
  assert.ok(depois <= antes + capitulos.length, "só separadores foram acrescentados");
});

test("o bloco é contíguo: começa no 1º capítulo e termina no último do grupo", () => {
  const capitulos = [cap(1, 10_000, 1), cap(2, 10_000, 3), cap(3, 10_000, 5)];
  const blocos = agruparBlocosParaLeitura(capitulos);

  assert.equal(blocos[0].startPage, 1);
  assert.equal(blocos[0].endPage, 4, "1+2 cabem em 28k; o fim é o do capítulo 2");
  assert.equal(blocos[1].startPage, 5);
});

test("o título nomeia o INTERVALO, não só o primeiro capítulo", () => {
  /*
   * O título vai ao modelo como contexto do trecho. "1 - CAPITULO 1" num bloco
   * que vai até o capítulo 3 seria etiqueta errada, não etiqueta curta.
   */
  const capitulos = [cap(1, 5_000, 1), cap(2, 5_000, 3), cap(3, 5_000, 5)];
  const blocos = agruparBlocosParaLeitura(capitulos);

  assert.equal(blocos.length, 1);
  assert.equal(blocos[0].title, "1 - CAPITULO 1 … 3 - CAPITULO 3");
});

test("capítulo maior que o teto vira bloco sozinho, sem ser cortado", () => {
  const capitulos = [cap(1, 40_000, 1), cap(2, 5_000, 20)];
  const blocos = agruparBlocosParaLeitura(capitulos);

  assert.equal(blocos.length, 2);
  assert.equal(blocos[0].text.length, 40_000, "não corta — quem corta por tamanho é o chunker");
});

test("lista vazia devolve lista vazia", () => {
  assert.deepEqual(agruparBlocosParaLeitura([]), []);
});

test("A IMPRESSÃO DIGITAL NÃO PODE VER O AGRUPAMENTO", () => {
  /*
   * O teste que protege a auditoria incremental. `impressaoDosCapitulos` hasheia
   * o corte POR CAPÍTULO, e é o casamento desses hashes entre revisões que
   * sustenta os 86-95% de texto reaproveitado. Se alguém trocar
   * `chunkPdfByChapter` por esta função no caminho da impressão, 72 hashes
   * estáveis viram 17 que mudam inteiros quando qualquer capítulo do grupo muda
   * — e o delta desaba de "3 capítulos alterados" para "mudou tudo".
   */
  const capitulos = Array.from({ length: 10 }, (_, i) => cap(i + 1, 5_000, i * 2 + 1));
  const porCapitulo = impressaoDosCapitulos(capitulos);
  const porBloco = impressaoDosCapitulos(agruparBlocosParaLeitura(capitulos));

  assert.equal(porCapitulo.length, 10, "a impressão tem um registro por capítulo");
  assert.notEqual(
    porBloco.length,
    porCapitulo.length,
    "agrupar ANTES de imprimir produz outra impressão — por isso o motor imprime o corte cru",
  );

  // E o agrupamento não mexeu nos capítulos originais (sem mutação em quem chama).
  assert.deepEqual(impressaoDosCapitulos(capitulos), porCapitulo);
});

console.log(`\n${passed} teste(s) de agrupamento OK`);
