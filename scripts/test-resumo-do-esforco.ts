/**
 * O RESUMO DO ESFORÇO não pode exagerar o que foi feito.
 *
 * O relatório do 084_25 afirmou "98 blocos de leitura por capítulo" numa corrida
 * que leu 8 — a frase usava o total de capítulos do documento em vez dos blocos
 * que foram ao modelo, e a leitura global tinha recebido 16% do texto.
 *
 *   node scripts/test-resumo-do-esforco.ts   (== npm run test:resumo-esforco)
 */
import assert from "node:assert/strict";

import {
  coberturaCompleta,
  fracaoLida,
  resumoDoEsforco,
} from "../lib/resumo-do-esforco.ts";

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

/** A corrida real do 084_25 em 17/08/2026. */
const O_084_25 = {
  caracteres_lidos: 90_000,
  caracteres_totais: 547_855,
  blocos_lidos: 8,
  blocos_totais: 98,
};

const COMPLETA = {
  caracteres_lidos: 547_855,
  caracteres_totais: 547_855,
  blocos_lidos: 98,
  blocos_totais: 98,
};

test("o caso real: diz 8 de 98, não 98", () => {
  const frase = resumoDoEsforco(O_084_25);
  assert.match(frase, /8 de 98 blocos/);
  assert.doesNotMatch(frase, /(?<!de )98 blocos/, "não pode anunciar 98 como lidos");
});

test("o caso real: declara a fração lida do documento", () => {
  assert.match(resumoDoEsforco(O_084_25), /16% do documento/);
});

test("o caso real: AVISA que partes não foram lidas", () => {
  /*
   * O aviso vai DENTRO da frase, não num campo à parte: foi a ausência dele que
   * deixou uma leitura de 16% chegar à tela com cara de auditoria completa.
   */
  assert.match(resumoDoEsforco(O_084_25), /ATENÇÃO/);
});

test("cobertura completa não leva aviso", () => {
  const frase = resumoDoEsforco(COMPLETA);
  assert.doesNotMatch(frase, /ATENÇÃO/);
  assert.match(frase, /documento inteiro/);
  assert.match(frase, /98 blocos de leitura por capítulo \(todos\)/);
});

test("ler tudo numa passada, mas nenhum bloco, NÃO é cobertura completa", () => {
  // É o Profundo de hoje: global inteira e `chunkLimit = 0`. Ler o documento de
  // uma vez e não examinar capítulo nenhum é uma cobertura; chamar de completa
  // seria a mesma imprecisão que se está consertando.
  const soGlobal = { ...COMPLETA, blocos_lidos: 0, blocos_totais: 98 };
  assert.equal(coberturaCompleta(soGlobal), false);
  assert.match(resumoDoEsforco(soGlobal), /ATENÇÃO/);
});

test("sem blocos, a frase não inventa a parte de blocos", () => {
  const soGlobal = { ...COMPLETA, blocos_lidos: 0, blocos_totais: 98 };
  assert.doesNotMatch(resumoDoEsforco(soGlobal), /blocos de leitura/);
});

test("fração nunca passa de 100% nem divide por zero", () => {
  assert.equal(fracaoLida({ ...COMPLETA, caracteres_lidos: 999_999 }), 1);
  assert.equal(fracaoLida({ ...COMPLETA, caracteres_totais: 0 }), 0);
});

test("sem medição, não afirma cobertura nenhuma", () => {
  const frase = resumoDoEsforco(undefined);
  assert.doesNotMatch(frase, /\d/, "parecer antigo não ganha número inventado");
  assert.ok(frase.length > 10);
});

console.log(`\n${passed} teste(s) de resumo do esforço OK`);
