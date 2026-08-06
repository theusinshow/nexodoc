/**
 * Teste da PRECEDÊNCIA entre a decisão do engenheiro e a proposta do agente.
 *
 * "Correção aceita e revertida sem aviso" já aconteceu duas vezes neste
 * projeto. Aqui está a regra que impede a terceira:
 *
 *   cada decisão guarda o valor do agente que ela substituiu. No turno
 *   seguinte, se o agente mudou de ideia ele vence; se repetiu o mesmo valor,
 *   a decisão do engenheiro fica.
 *
 * Uma regra mais simples erraria um dos dois casos: "a decisão sempre vence"
 * impediria pedir "muda o título para X" pelo chat; "o agente sempre vence"
 * apagaria a edição feita no frame.
 *
 * Sem isso o `numTomos` é o caso feio: o agente recalcula os 6 tomos todo
 * turno, e a troca manual para 4 seria desfeita em silêncio a cada mensagem.
 *
 *   node scripts/test-nexo-decisoes.ts   (== npm run test:nexo:decisoes)
 */
import assert from "node:assert/strict";

import { anotarDecisao, mesclarDecisoes } from "../modules/nexo/lib/decisoes.ts";

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
// Anotar
// ---------------------------------------------------------------------------

test("a decisão guarda o valor do agente que ela substituiu", () => {
  const d = anotarDecisao({}, "tituloCapa", "PROJETO ESTRUTURAL", "");
  assert.deepEqual(d.tituloCapa, { valor: "PROJETO ESTRUTURAL", sobre: "" });
});

test("decidir o mesmo que o agente propôs não cria decisão", () => {
  const d = anotarDecisao({}, "numTomos", "6", "6");
  assert.deepEqual(d, {});
});

test("apagar o campo desfaz a decisão", () => {
  const antes = anotarDecisao({}, "tituloCapa", "X", "");
  assert.deepEqual(anotarDecisao(antes, "tituloCapa", "", ""), {});
});

test("decidir um campo não mexe nos outros", () => {
  const antes = anotarDecisao({}, "tituloCapa", "X", "");
  const depois = anotarDecisao(antes, "volume", "6", "");
  assert.deepEqual(Object.keys(depois).sort(), ["tituloCapa", "volume"]);
});

// ---------------------------------------------------------------------------
// Mesclar — a regra que importa
// ---------------------------------------------------------------------------

test("o agente REPETIU o valor: a decisão do engenheiro fica", () => {
  const d = anotarDecisao({}, "numTomos", "4", "6");
  const r = mesclarDecisoes(d, { numTomos: "6" });
  assert.equal(r.valores.numTomos, "4");
  assert.ok(r.vivas.numTomos, "a decisão deveria continuar viva");
});

test("o agente MUDOU de ideia: o agente vence e a decisão cai", () => {
  const d = anotarDecisao({}, "tituloCapa", "MEU TITULO", "");
  const r = mesclarDecisoes(d, { tituloCapa: "TITULO NOVO DO AGENTE" });
  assert.equal(r.valores.tituloCapa, "TITULO NOVO DO AGENTE");
  assert.equal(r.vivas.tituloCapa, undefined);
});

test("campo sem decisão passa direto o que o agente propôs", () => {
  const r = mesclarDecisoes({}, { volume: "6" });
  assert.equal(r.valores.volume, "6");
});

test("decisão sobre campo que o agente não propôs continua valendo", () => {
  const d = anotarDecisao({}, "bairro", "JARDIM MARISTELA", "");
  const r = mesclarDecisoes(d, {});
  assert.equal(r.valores.bairro, "JARDIM MARISTELA");
  assert.ok(r.vivas.bairro);
});

test("o título vazio do agente não apaga a decisão do engenheiro", () => {
  // O agente devolve `tituloCapa: ""` de propósito quando ninguém lhe deu um.
  const d = anotarDecisao({}, "tituloCapa", "PROJETO ESTRUTURAL", "");
  const r = mesclarDecisoes(d, { tituloCapa: "" });
  assert.equal(r.valores.tituloCapa, "PROJETO ESTRUTURAL");
});

test("mesclar duas vezes seguidas é estável (a decisão não some sozinha)", () => {
  const d = anotarDecisao({}, "numTomos", "4", "6");
  const um = mesclarDecisoes(d, { numTomos: "6" });
  const dois = mesclarDecisoes(um.vivas, { numTomos: "6" });
  assert.equal(dois.valores.numTomos, "4");
  assert.ok(dois.vivas.numTomos);
});

console.log(`\n${passed} teste(s) ok.`);
