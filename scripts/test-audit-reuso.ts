/**
 * As decisões de REUSO entre duas revisões do mesmo memorial.
 *
 * Todas determinísticas e sem token: é o módulo que decide o que o modelo vai
 * reler e qual achado sobrevive. Errar aqui é caro dos dois lados — herdar
 * achado com página errada manda o engenheiro para a folha errada; deixar de
 * herdar faz o parecer encolher sem ninguém pedir.
 *
 *   node scripts/test-audit-reuso.ts   (== npm run test:audit:reuso)
 */
import assert from "node:assert/strict";

import {
  capituloDoAchado,
  paginaDoAchado,
  reancorarPorAritmetica,
} from "../lib/audit-reuso.ts";
import type { CapituloImpresso } from "../lib/audit-report.ts";

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

const cap = (
  titulo: string,
  startPage: number,
  endPage: number,
  hash: string,
): CapituloImpresso => ({ titulo, startPage, endPage, chars: 1000, hash });

// Três capítulos com o MESMO título — a armadilha real destes memoriais.
const CAPITULOS = [
  cap("1 - APRESENTACAO", 1, 3, "h1"),
  cap("2 - ARQUITETURA", 4, 9, "h2"),
  cap("1 - APRESENTACAO", 10, 12, "h3"),
];

test("página simples vira número", () => {
  assert.equal(paginaDoAchado("7"), 7);
  assert.equal(paginaDoAchado(" 12 "), 12);
});

test("página composta usa a primeira — é onde o visor abre", () => {
  assert.equal(paginaDoAchado("11 e 14"), 11);
  assert.equal(paginaDoAchado("pág. 5"), 5);
});

test("página ilegível devolve null, nunca zero", () => {
  assert.equal(paginaDoAchado(""), null);
  assert.equal(paginaDoAchado("não informada"), null);
});

test("achado cai no capítulo cuja FAIXA o contém", () => {
  assert.equal(capituloDoAchado("5", CAPITULOS)?.hash, "h2");
  assert.equal(capituloDoAchado("1", CAPITULOS)?.hash, "h1");
});

test("título repetido não confunde — quem decide é a página", () => {
  // Os capítulos 1 e 3 têm título idêntico; o achado da página 11 pertence ao
  // terceiro, e nenhuma comparação de texto conseguiria distinguir.
  assert.equal(capituloDoAchado("11", CAPITULOS)?.hash, "h3");
});

test("página fora de qualquer faixa devolve null", () => {
  assert.equal(capituloDoAchado("99", CAPITULOS), null);
  assert.equal(capituloDoAchado("", CAPITULOS), null);
});

test("capítulo que andou junto: a página do achado anda o mesmo tanto", () => {
  // Entrou um capítulo antes dele; o capítulo em si é idêntico (mesmo hash) e
  // ocupa o mesmo número de páginas. Tudo depois andou +3.
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 27, "hf");
  assert.equal(reancorarPorAritmetica("21", antes, agora), 24);
  assert.equal(reancorarPorAritmetica("20", antes, agora), 23);
});

test("capítulo parado devolve a mesma página", () => {
  const c = cap("3 - FUNDACOES", 20, 24, "hf");
  assert.equal(reancorarPorAritmetica("22", c, c), 22);
});

test("capítulo que passou a ocupar outro número de páginas NÃO usa aritmética", () => {
  // Mesmo texto, mas as quebras internas mudaram: a soma uniforme mentiria.
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 28, "hf");
  assert.equal(reancorarPorAritmetica("21", antes, agora), null);
});

test("página fora da faixa antiga não é reancorada", () => {
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 27, "hf");
  assert.equal(reancorarPorAritmetica("40", antes, agora), null);
  assert.equal(reancorarPorAritmetica("sem página", antes, agora), null);
});

console.log(`\n${passed} verificações de reuso passaram.`);
