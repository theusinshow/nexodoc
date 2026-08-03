/**
 * Teste do TOTAL DE REFERÊNCIA corrigido à mão — o "24" de "05/24".
 *
 * Cobre as duas metades da regra:
 *  1. `totalDoConjunto` (puro): quando a correção vale para um conjunto.
 *  2. `buildLdProposal`: a correção VENCE o carimbo, inclusive para menos.
 *
 * A segunda é a que importa de verdade. Um total manual que só valesse quando
 * fosse MAIOR que a inferência seria aceito e ignorado justamente no caso que o
 * motiva — o OCR lendo o total a mais —, e correção que perde para o parser é
 * pior que correção nenhuma.
 *
 *   node scripts/test-nexo-totais.ts   (== npm run test:nexo:totais)
 */
import assert from "node:assert/strict";

import { folhas, type Folha } from "../modules/nexo/lib/folhas.ts";
import { totalDoConjunto } from "../modules/nexo/lib/totais.ts";
import { totalDeReferencia } from "../server/nexo/reconcile-sheets.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";

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

/** Uma prancha de HIS, com o total que o carimbo diz. */
function selo(n: number, total: number, disciplina = "his"): SeloForLd {
  return {
    fileName: `040_26_${disciplina}_${String(n).padStart(3, "0")}_a.pdf`,
    pageNumber: 1,
    disciplina,
    folha: n,
    total,
    numeroFolha: `${n}/${total}`,
    arquivo: `040_26_${disciplina}_${String(n).padStart(3, "0")}_a`,
    conteudo: `Prancha ${n}`,
    cliente: null,
    secretaria: null,
    obra: "ESCOLA MUNICIPAL",
    fase: null,
    tituloSecao: null,
  };
}

/** A disciplina de uma folha, do jeito simples que este teste precisa. */
const codigoDe = (f: Folha) => (f.disciplina ?? "").toLowerCase();

// ---------------------------------------------------------------------------
// Quando a correção vale para o conjunto
// ---------------------------------------------------------------------------

test("conjunto de UMA disciplina usa o total corrigido dela", () => {
  const lista = folhas([selo(1, 21), selo(2, 21)], {});
  assert.equal(totalDoConjunto(lista, { his: 11 }, codigoDe), 11);
});

test("sem correção para aquela disciplina, o carimbo continua mandando", () => {
  const lista = folhas([selo(1, 21)], {});
  assert.equal(totalDoConjunto(lista, { arq: 11 }, codigoDe), undefined);
  assert.equal(totalDoConjunto(lista, {}, codigoDe), undefined);
});

test("conjunto MISTO não recebe total nenhum — não existe um total só", () => {
  // "de 11" e "de 5" são verdades de blocos diferentes; escolher uma numeraria
  // metade das folhas errado, o que é pior do que não corrigir.
  const lista = folhas([selo(1, 21, "his"), selo(1, 5, "inc")], {});
  assert.equal(totalDoConjunto(lista, { his: 11, inc: 5 }, codigoDe), undefined);
});

test("conjunto vazio não inventa total", () => {
  assert.equal(totalDoConjunto([], { his: 11 }, codigoDe), undefined);
});

test("total zerado ou negativo é ignorado (é como limpar o campo)", () => {
  const lista = folhas([selo(1, 21)], {});
  assert.equal(totalDoConjunto(lista, { his: 0 }, codigoDe), undefined);
  assert.equal(totalDoConjunto(lista, { his: -3 }, codigoDe), undefined);
});

// ---------------------------------------------------------------------------
// A precedência — a MESMA função que a LD e a conferência usam
//
// `buildLdProposal` não roda em node cru (importa `./parse-filename` sem
// extensão e alias `@/`), então a regra mora no módulo puro e é aqui que ela é
// provada. A fiação até o PDF é exercitada no navegador, em
// `scripts/shot-nexo-folhas.mjs`.
// ---------------------------------------------------------------------------

test("sem correção, vale a inferência do carimbo (comportamento de sempre)", () => {
  assert.equal(totalDeReferencia(11, undefined), 11);
  assert.equal(totalDeReferencia(11, null), 11);
});

test("o total corrigido VENCE a inferência", () => {
  // O OCR leu "21" nas pranchas; quem olhou a prancha diz 11.
  assert.equal(totalDeReferencia(21, 11), 11);
});

test("o total corrigido vence MESMO SENDO MENOR que a inferência", () => {
  // Este é o caso que motiva tudo: o carimbo lido A MAIS é que faz a conferência
  // acusar folhas faltando. Se o manual só valesse quando maior, o conserto
  // seria aceito e descartado — e o engenheiro veria o valor voltar.
  assert.equal(totalDeReferencia(40, 2), 2);
});

test("total corrigido inválido (0, negativo, quebrado) cai na inferência", () => {
  assert.equal(totalDeReferencia(11, 0), 11);
  assert.equal(totalDeReferencia(11, -5), 11);
  assert.equal(totalDeReferencia(11, Number.NaN), 11);
});

test("total corrigido fracionário é truncado (o campo só aceita dígitos)", () => {
  assert.equal(totalDeReferencia(11, 9.7), 9);
});

console.log(`\n${passed} teste(s) OK`);
