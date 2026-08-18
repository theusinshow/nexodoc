/**
 * A GRADE DA TABELA, reconstruída das coordenadas que o pdf.js já entrega.
 *
 * A camada determinística inteira da auditoria é ancorada em PROSA e os achados
 * numéricos do benchmark moram em TABELA. `ExtractedPdfPage` era `{ page, text }`
 * e o `transform[4]`/`[5]` de cada item ia para o lixo.
 *
 *   node scripts/test-tabela-do-pdf.ts   (== npm run test:tabela-do-pdf)
 */
import assert from "node:assert/strict";

import { linhasDaPagina, tabelasDaPagina } from "../lib/tabela-do-pdf.ts";
import type { ItemDeTexto } from "../lib/texto-do-pdf.ts";

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

/** Item com corpo de fonte 10, na posição (x, y) e com a largura medida. */
function item(str: string, x: number, y: number, largura = str.length * 5): ItemDeTexto {
  return { str, transform: [10, 0, 0, 10, x, y], width: largura, height: 10 };
}

test("itens no mesmo y viram uma linha só", () => {
  const linhas = linhasDaPagina([item("AMBIENTE", 50, 700), item("AREA", 300, 700)]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].itens.length, 2);
});

test("degrau no y abre linha nova", () => {
  const linhas = linhasDaPagina([
    item("AMBIENTE", 50, 700),
    item("Sala 1", 50, 680),
    item("Sala 2", 50, 660),
  ]);
  assert.equal(linhas.length, 3);
});

test("o marcador hasEOL do pdf.js também fecha a linha", () => {
  const linhas = linhasDaPagina([
    item("Sala 1", 50, 700),
    { str: "", transform: [10, 0, 0, 10, 0, 700], width: 0, height: 10, hasEOL: true },
    item("Sala 2", 50, 700),
  ]);
  assert.equal(linhas.length, 2);
});

test("item vazio sem hasEOL é descartado, não vira linha", () => {
  const linhas = linhasDaPagina([
    item("Sala 1", 50, 700),
    { str: "", transform: [10, 0, 0, 10, 0, 700], width: 0, height: 10 },
    item("Sala 2", 200, 700),
  ]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].itens.length, 2);
});

test("página vazia não quebra", () => {
  assert.deepEqual(linhasDaPagina([]), []);
});

/** Uma linha de tabela: textos nas posições x dadas, todos no mesmo y. */
function linhaEm(y: number, celulas: [string, number][]): ItemDeTexto[] {
  return celulas.map(([texto, x]) => item(texto, x, y));
}

test("grade limpa de 3 colunas vira tabela", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["AMBIENTE", 50], ["AREA", 300], ["PISO", 450]]),
      ...linhaEm(680, [["Sala 1", 50], ["32,50", 300], ["Ceramica", 450]]),
      ...linhaEm(660, [["Sala 2", 50], ["28,10", 300], ["Ceramica", 450]]),
      ...linhaEm(640, [["TOTAL", 50], ["60,60", 300]]),
    ],
    45,
  );
  assert.equal(tabelas.length, 1);
  assert.equal(tabelas[0].pagina, 45);
  assert.equal(tabelas[0].linhas.length, 4);
  assert.deepEqual(tabelas[0].linhas[1], ["Sala 1", "32,50", "Ceramica"]);
});

test("celula vazia no meio NAO desmancha a tabela", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["AMBIENTE", 50], ["AREA", 300], ["PISO", 450]]),
      ...linhaEm(680, [["Sala 1", 50], ["Ceramica", 450]]),
      ...linhaEm(660, [["Sala 2", 50], ["28,10", 300], ["Ceramica", 450]]),
      ...linhaEm(640, [["Sala 3", 50], ["11,00", 300], ["Ceramica", 450]]),
    ],
    1,
  );
  assert.equal(tabelas.length, 1);
  assert.equal(tabelas[0].linhas.length, 4);
});

test("PROSA CORRIDA NAO E TABELA — o falso positivo estrutural", () => {
  /*
   * Prosa justificada tem vãos largos, mas em x DIFERENTE a cada linha. É essa
   * discordância que a torna auto-excluída, e é por isso que a regra não precisa
   * de ninguém declarando onde a tabela começa nem de lista de exclusão.
   */
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["O", 50], ["memorial", 90], ["descreve", 210]]),
      ...linhaEm(680, [["a", 50], ["execucao", 130], ["dos", 280]]),
      ...linhaEm(660, [["servicos", 50], ["previstos", 175], ["em", 330]]),
    ],
    1,
  );
  assert.deepEqual(tabelas, []);
});

test("uma linha isolada nao e tabela", () => {
  const tabelas = tabelasDaPagina(linhaEm(700, [["A", 50], ["B", 300]]), 1);
  assert.deepEqual(tabelas, []);
});

test("numero com milhar e decimal NAO e partido em duas celulas", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["AMBIENTE", 50], ["AREA", 300]]),
      ...linhaEm(680, [["Bloco A", 50], ["4.530,98", 300]]),
      ...linhaEm(660, [["Bloco B", 50], ["1.200,00", 300]]),
    ],
    1,
  );
  assert.equal(tabelas[0].linhas[1][1], "4.530,98");
});

test("O VAO QUE VEM COMO ITEM DE ESPACO tambem separa colunas", () => {
  /*
   * A regressão que os 11 testes puros deixaram passar. O pdf.js real emite o
   * recuo entre colunas como `{ str: " ", width: 182 }` em vez de deixar um
   * buraco entre os itens — medir a distância entre o fim de um e o começo do
   * outro dava sempre zero, e a extração de verdade devolvia ZERO tabelas com
   * todos os testes verdes. Pego por `prova-tabela-do-pdf.ts`.
   */
  const branco = (x: number, y: number, largura: number): ItemDeTexto => ({
    str: " ",
    transform: [10, 0, 0, 10, x, y],
    width: largura,
    height: 0,
  });
  const tabelas = tabelasDaPagina(
    [
      item("AMBIENTE", 50, 700, 50), branco(100, 700, 150), item("AREA", 250, 700, 30),
      item("Sala 1", 50, 680, 40), branco(90, 680, 160), item("32,50", 250, 680, 30),
      item("Sala 2", 50, 660, 40), branco(90, 660, 160), item("28,10", 250, 660, 30),
    ],
    1,
  );
  assert.equal(tabelas.length, 1, "o vao como item de espaco nao foi reconhecido");
  assert.deepEqual(tabelas[0].linhas[1], ["Sala 1", "32,50"]);
});

test("duas tabelas separadas por prosa saem como duas", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["A", 50], ["1", 300]]),
      ...linhaEm(680, [["B", 50], ["2", 300]]),
      ...linhaEm(660, [["C", 50], ["3", 300]]),
      ...linhaEm(620, [["Texto corrido explicando o quadro acima.", 50]]),
      ...linhaEm(580, [["D", 50], ["4", 300]]),
      ...linhaEm(560, [["E", 50], ["5", 300]]),
      ...linhaEm(540, [["F", 50], ["6", 300]]),
    ],
    1,
  );
  assert.equal(tabelas.length, 2);
});

console.log(`\n${passed} teste(s) de tabela do PDF OK`);
