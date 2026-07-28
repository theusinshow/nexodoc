/**
 * Teste da GEOMETRIA do canvas: onde cada folha cai na grade do tomo e quanto a
 * fileira ocupa. Puro — roda em Node pelado.
 *
 *   node scripts/test-nexo-layout.ts   (== npm run test:nexo:layout)
 */
import assert from "node:assert/strict";

import {
  ALTURA_MINIMA_FILEIRA,
  COLUNAS_MAXIMAS,
  COLUNAS_MINIMAS,
  PASSO_X,
  PASSO_Y,
  alturaDaFileira,
  alturaDaGrade,
  colunasDaGrade,
  larguraDaGrade,
  posicaoNaGrade,
  topoDasFileiras,
} from "../modules/nexo/lib/layout-canvas.ts";

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

test("a grade preenche da esquerda para a direita e quebra na 7ª folha", () => {
  assert.deepEqual(posicaoNaGrade(0, 6), { x: 0, y: 0 });
  assert.deepEqual(posicaoNaGrade(5, 6), { x: 5 * PASSO_X, y: 0 });
  assert.deepEqual(posicaoNaGrade(6, 6), { x: 0, y: PASSO_Y });
  assert.deepEqual(posicaoNaGrade(13, 6), { x: PASSO_X, y: 2 * PASSO_Y });
});

test("largura para de crescer quando a linha enche", () => {
  assert.equal(larguraDaGrade(0, 6), 0);
  assert.equal(larguraDaGrade(1, 6), PASSO_X);
  assert.equal(larguraDaGrade(6, 6), 6 * PASSO_X);
  assert.equal(larguraDaGrade(7, 6), 6 * PASSO_X);
});

test("altura cresce por linha começada", () => {
  assert.equal(alturaDaGrade(0, 6), 0);
  assert.equal(alturaDaGrade(1, 6), PASSO_Y);
  assert.equal(alturaDaGrade(6, 6), PASSO_Y);
  assert.equal(alturaDaGrade(7, 6), 2 * PASSO_Y);
});

// ---------------------------------------------------------------------------
// Colunas variáveis: o que impede o tomo grande de virar uma coluna infinita
// ---------------------------------------------------------------------------

test("volume normal continua com 6 colunas", () => {
  assert.equal(colunasDaGrade(0), COLUNAS_MINIMAS);
  assert.equal(colunasDaGrade(1), COLUNAS_MINIMAS);
  assert.equal(colunasDaGrade(12), COLUNAS_MINIMAS);
  assert.equal(colunasDaGrade(36), COLUNAS_MINIMAS);
});

test("tomo grande alarga em vez de esticar para baixo", () => {
  assert.equal(colunasDaGrade(200), 15);
  // A grade fica com proporção de fileira, não de coluna: mais larga que alta.
  const linhas = Math.ceil(200 / colunasDaGrade(200));
  assert.ok(colunasDaGrade(200) >= linhas, `${colunasDaGrade(200)} colunas x ${linhas} linhas`);
});

test("a largura tem teto — fileira infinita seria o defeito inverso", () => {
  assert.equal(colunasDaGrade(10000), COLUNAS_MAXIMAS);
});

test("com colunas variáveis, 200 folhas ocupam menos da metade da altura", () => {
  const antes = alturaDaGrade(200, COLUNAS_MINIMAS);
  const agora = alturaDaGrade(200, colunasDaGrade(200));
  assert.ok(agora < antes / 2, `${agora} contra ${antes}`);
});

test("fileira pequena usa a altura mínima; a grande manda", () => {
  assert.equal(alturaDaFileira(0), ALTURA_MINIMA_FILEIRA);
  assert.equal(alturaDaFileira(6), ALTURA_MINIMA_FILEIRA);
  assert.ok(alturaDaFileira(200) > ALTURA_MINIMA_FILEIRA);
});

test("um tomo grande não invade a fileira de baixo", () => {
  const alturas = [alturaDaFileira(200), alturaDaFileira(3)];
  const topos = topoDasFileiras(alturas);
  assert.equal(topos[0], 0);
  assert.ok(
    topos[1] >= alturas[0],
    `a 2ª fileira começa em ${topos[1]}, dentro da 1ª que tem ${alturas[0]} de altura`,
  );
});

test("fileiras vazias e lista vazia não quebram", () => {
  assert.deepEqual(topoDasFileiras([]), []);
  assert.deepEqual(topoDasFileiras([ALTURA_MINIMA_FILEIRA]), [0]);
});

console.log(`\n${passed} testes de layout OK`);
