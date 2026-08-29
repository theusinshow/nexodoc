/**
 * O TRACE DO TURNO — sem navegador.
 *
 *   node scripts/test-trace-do-turno.ts   (== npm run test:trace)
 */
import assert from "node:assert/strict";

import { traceDoTurno } from "../modules/nexo/lib/trace-do-turno.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("o turno que leu e propos diz as tres coisas", () => {
  assert.equal(
    traceDoTurno({ selosLidos: 23, propostas: ["ld"], duracaoMs: 8400 }),
    "leu 23 selos · propôs LD · 8,4s",
  );
});

test("TURNO SIMPLES NAO GANHA LINHA — e o aceite da proposta", () => {
  assert.equal(
    traceDoTurno({ selosLidos: 0, propostas: [], duracaoMs: 400 }),
    null,
  );
});

test("o tempo nunca aparece sozinho: sem trabalho nomeado ele nao tem assunto", () => {
  assert.equal(
    traceDoTurno({ selosLidos: 0, propostas: [], duracaoMs: 99999 }),
    null,
  );
});

test("propostas repetidas contam UMA vez — capa de tres tomos e um trabalho so", () => {
  assert.equal(
    traceDoTurno({
      selosLidos: 0,
      propostas: ["capa", "capa", "capa"],
      duracaoMs: 1000,
    }),
    "propôs capa · 1,0s",
  );
});

test("varias propostas se juntam como se fala", () => {
  assert.equal(
    traceDoTurno({
      selosLidos: 4,
      propostas: ["ld", "capa", "separatriz"],
      duracaoMs: 2500,
    }),
    "leu 4 selos · propôs LD, capa e separatriz · 2,5s",
  );
});

test("um selo so fala no singular", () => {
  assert.equal(
    traceDoTurno({ selosLidos: 1, propostas: [], duracaoMs: 1000 }),
    "leu 1 selo · 1,0s",
  );
});

test("kind desconhecido passa cru, em vez de sumir", () => {
  assert.ok(
    traceDoTurno({
      selosLidos: 0,
      propostas: ["coisa-nova"],
      duracaoMs: 0,
    })?.includes("coisa-nova"),
  );
});

test("duracao invalida nao vira NaN na tela", () => {
  assert.equal(
    traceDoTurno({ selosLidos: 2, propostas: [], duracaoMs: Number.NaN }),
    "leu 2 selos",
  );
});

console.log(`\n${passed} ok`);
