/**
 * Teste da regra de QUEBRA DE LINHA da capa.
 *
 * A regra existia só para o título e vivia dentro do construtor, como um
 * `.replace` de uma linha. Duas coisas a tiraram de lá: a obra precisa da mesma
 * quebra (o carimbo a escreve numa tira só, e a capa impressa tem duas linhas),
 * e o frame do editor precisa MOSTRAR o mesmo resultado que vai sair impresso —
 * uma segunda cópia da regra é como a tela volta a discordar do PDF.
 *
 * O que se prova aqui é a precedência: o Enter digitado manda, e o " - " do
 * carimbo só opina quando não há Enter nenhum.
 *
 *   node scripts/test-nexo-capa-linhas.ts   (== npm run test:nexo:capa-linhas)
 */
import assert from "node:assert/strict";

import { linhasDaCapa, textoEmLinhasDaCapa } from "../server/nexo/capa-linhas.ts";

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

// ---------------------------------------------------------------------------
// O " - " do carimbo
// ---------------------------------------------------------------------------

test("a obra do carimbo quebra no ' - ' — é a capa que este escritório emite", () => {
  assert.deepEqual(
    linhasDaCapa("REFORMA E AMPLIAÇÃO - EMEB RUBENS DE ARRUDA RAMOS"),
    ["REFORMA E AMPLIAÇÃO", "EMEB RUBENS DE ARRUDA RAMOS"],
  );
});

test("o travessão vale tanto quanto o hífen", () => {
  assert.deepEqual(linhasDaCapa("PROJETO ESTRUTURAL – IMPLANTAÇÃO"), [
    "PROJETO ESTRUTURAL",
    "IMPLANTAÇÃO",
  ]);
});

test("só o PRIMEIRO ' - ' quebra: o segundo costuma ser parte do nome", () => {
  assert.deepEqual(linhasDaCapa("A - B - C"), ["A", "B - C"]);
});

test("hífen SEM espaços não quebra — é composição de palavra", () => {
  assert.deepEqual(linhasDaCapa("CENTRO-OESTE"), ["CENTRO-OESTE"]);
});

// ---------------------------------------------------------------------------
// O Enter digitado manda
// ---------------------------------------------------------------------------

test("com Enter digitado, o ' - ' não opina mais", () => {
  assert.deepEqual(
    linhasDaCapa("PROJETO DE URBANIZAÇÃO - FASE 2\nPROJETO DE PAISAGISMO"),
    ["PROJETO DE URBANIZAÇÃO - FASE 2", "PROJETO DE PAISAGISMO"],
  );
});

test("três linhas digitadas saem como três linhas", () => {
  assert.deepEqual(
    linhasDaCapa("PROJETO DE URBANIZAÇÃO\nPROJETO DE PAISAGISMO\nMAQUETE ELETRÔNICA"),
    ["PROJETO DE URBANIZAÇÃO", "PROJETO DE PAISAGISMO", "MAQUETE ELETRÔNICA"],
  );
});

test("linha em branco no meio não vira linha impressa", () => {
  assert.deepEqual(linhasDaCapa("A\n\n  \nB"), ["A", "B"]);
});

// ---------------------------------------------------------------------------
// Bordas
// ---------------------------------------------------------------------------

test("vazio e ausente não produzem linha nenhuma", () => {
  assert.deepEqual(linhasDaCapa(""), []);
  assert.deepEqual(linhasDaCapa("   "), []);
  assert.deepEqual(linhasDaCapa(undefined), []);
});

test("textoEmLinhasDaCapa devolve a forma que o gerador de ODT consome", () => {
  assert.equal(
    textoEmLinhasDaCapa("REFORMA E AMPLIAÇÃO - EMEB RUBENS DE ARRUDA RAMOS"),
    "REFORMA E AMPLIAÇÃO\nEMEB RUBENS DE ARRUDA RAMOS",
  );
  assert.equal(textoEmLinhasDaCapa(""), "");
});

console.log(`\n${passed} teste(s) ok.`);
