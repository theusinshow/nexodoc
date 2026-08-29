/**
 * DE ONDE VEIO O NÚMERO DA FOLHA — sem navegador.
 *
 *   node scripts/test-origem-do-numero.ts   (== npm run test:origem)
 *
 * A origem é DEDUZIDA das etapas que já decidem, nunca recalculada por uma
 * segunda regra. Estes testes existem para garantir que a explicação continue
 * casando com a decisão: se um dia a precedência mudar e a origem não, é aqui
 * que a divergência aparece.
 */
import assert from "node:assert/strict";

import {
  resolveSheetNumbersComOrigem,
  sheetNumberFromSelo,
  sheetNumberFromSeloComOrigem,
} from "../server/nexo/parse-filename.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("o campo ARQUIVO do carimbo manda, e a origem diz carimbo", () => {
  const r = sheetNumberFromSeloComOrigem({
    arquivo: "040_26_arq_005_a",
    fileName: "qualquer_coisa_009.pdf",
    folha: 3,
  });
  assert.deepEqual(r, { numero: 5, origem: "carimbo" });
});

test("sem o campo ARQUIVO, o NOME do arquivo decide", () => {
  const r = sheetNumberFromSeloComOrigem({ fileName: "040_26_arq_007_a.pdf", folha: 3 });
  assert.deepEqual(r, { numero: 7, origem: "nome" });
});

test("sem nome legivel, sobra a folha lida no carimbo", () => {
  const r = sheetNumberFromSeloComOrigem({ fileName: "digitalizado.pdf", folha: 3 });
  assert.deepEqual(r, { numero: 3, origem: "carimbo" });
});

test("sem nenhuma das tres, nao ha numero nem origem", () => {
  assert.deepEqual(sheetNumberFromSeloComOrigem({ fileName: "digitalizado.pdf" }), {
    numero: null,
    origem: null,
  });
});

test("a funcao antiga e uma VISTA da nova — nao uma segunda implementacao", () => {
  const selo = { arquivo: "040_26_arq_005_a", fileName: "x.pdf", folha: 9 };
  assert.equal(sheetNumberFromSelo(selo), sheetNumberFromSeloComOrigem(selo).numero);
});

test("a correcao a mao vence tudo, e a origem diz mao", () => {
  const r = resolveSheetNumbersComOrigem([
    { fileName: "040_26_arq_001_a.pdf", pageNumber: 1, folhaManual: 42 },
  ]);
  assert.deepEqual(r[0], { numero: 42, origem: "mao" });
});

test("A RECONCILIACAO POR ORDEM aparece como origem propria", () => {
  // Mesmo PDF, mesmo candidato nas tres paginas: sem ancora, a reconciliacao
  // ranqueia por pagina. O numero deixou de ser leitura e virou POSICAO — e e
  // exatamente isso que quem confere precisa saber.
  const selos = [
    { fileName: "vol.pdf", pageNumber: 1, folha: 1 },
    { fileName: "vol.pdf", pageNumber: 2, folha: 1 },
    { fileName: "vol.pdf", pageNumber: 3, folha: 1 },
  ];
  const r = resolveSheetNumbersComOrigem(selos);
  assert.deepEqual(
    r.map((x) => x.numero),
    [1, 2, 3],
  );
  assert.equal(r[0].origem, "carimbo", "a primeira nao mudou de valor");
  assert.equal(r[1].origem, "ordem");
  assert.equal(r[2].origem, "ordem");
});

test("leitura limpa NAO e rotulada de ordem", () => {
  const r = resolveSheetNumbersComOrigem([
    { fileName: "040_26_arq_001_a.pdf", pageNumber: 1 },
    { fileName: "040_26_arq_002_a.pdf", pageNumber: 2 },
  ]);
  assert.deepEqual(
    r.map((x) => x.origem),
    ["nome", "nome"],
  );
});

console.log(`\n${passed} ok`);
