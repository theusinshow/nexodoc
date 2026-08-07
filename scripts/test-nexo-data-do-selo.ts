/**
 * Trava o parser da DATA DO CARIMBO. Os formatos vêm dos projetos reais em
 * `docs/samples` — carimbo não tem padrão, e cada escritório escreve de um jeito.
 *
 *   node scripts/test-nexo-data-do-selo.ts   (== npm run test:nexo:data-do-selo)
 */
import assert from "node:assert/strict";

import { parseDataDoSelo, dataDominante } from "../server/nexo/data-do-selo.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  }
}

test("mês por extenso com ano cheio", () => {
  assert.deepEqual(parseDataDoSelo("JUNHO/2026"), { mes: 6, ano: 2026 });
});

test("mês abreviado com ano de dois dígitos", () => {
  assert.deepEqual(parseDataDoSelo("JUN/26"), { mes: 6, ano: 2026 });
});

test("mês numérico", () => {
  assert.deepEqual(parseDataDoSelo("06/2026"), { mes: 6, ano: 2026 });
});

test("data completa: o dia é descartado", () => {
  assert.deepEqual(parseDataDoSelo("12/06/2026"), { mes: 6, ano: 2026 });
});

test("acento faltando (fonte CAD quebrada) ainda casa", () => {
  assert.deepEqual(parseDataDoSelo("MARCO/2026"), { mes: 3, ano: 2026 });
});

test("com acento também casa", () => {
  assert.deepEqual(parseDataDoSelo("MARÇO/2026"), { mes: 3, ano: 2026 });
});

test("lixo em volta não atrapalha", () => {
  assert.deepEqual(parseDataDoSelo("DATA: AGOSTO/2026"), { mes: 8, ano: 2026 });
});

test("mês inválido devolve null", () => {
  assert.equal(parseDataDoSelo("13/2026"), null);
});

test("vazio, nulo e sem data devolvem null", () => {
  assert.equal(parseDataDoSelo(""), null);
  assert.equal(parseDataDoSelo(null), null);
  assert.equal(parseDataDoSelo(undefined), null);
  assert.equal(parseDataDoSelo("ESCALA 1:50"), null);
});

/*
 * A ESCALA é o vizinho mais perigoso do campo DATA no carimbo: "1:50" tem a
 * mesma forma de dois números separados. O separador `:` não entra na lista
 * justamente por isso.
 */
test("escala não é confundida com data", () => {
  assert.equal(parseDataDoSelo("1:50"), null);
  assert.equal(parseDataDoSelo("ESCALA 1:100"), null);
});

test("dominante: maioria vence e conta os divergentes", () => {
  const r = dataDominante(["JUNHO/2026", "JUNHO/2026", "JULHO/2026"]);
  assert.deepEqual(r, { mes: 6, ano: 2026, folhas: 2, divergentes: 1 });
});

test("dominante: empate NÃO é maioria", () => {
  assert.equal(dataDominante(["JUNHO/2026", "JULHO/2026"]), null);
});

test("dominante: ignora as folhas ilegíveis", () => {
  const r = dataDominante(["AGOSTO/2026", null, "ESCALA 1:50"]);
  assert.deepEqual(r, { mes: 8, ano: 2026, folhas: 1, divergentes: 0 });
});

test("dominante sem nenhuma data devolve null", () => {
  assert.equal(dataDominante([null, ""]), null);
  assert.equal(dataDominante([]), null);
});

test("dominante: mesmo mês em anos diferentes não se funde", () => {
  const r = dataDominante(["JUNHO/2026", "JUNHO/2026", "JUNHO/2025"]);
  assert.deepEqual(r, { mes: 6, ano: 2026, folhas: 2, divergentes: 1 });
});

console.log(`\n${passed} teste(s) ok.`);
