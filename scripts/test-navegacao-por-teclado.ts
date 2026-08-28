/**
 * ANDAR PELO CANVAS SEM O MOUSE — sem navegador.
 *
 *   node scripts/test-navegacao-por-teclado.ts   (== npm run test:teclado)
 */
import assert from "node:assert/strict";

import { ehDigitacao, passoDoTeclado } from "../modules/nexo/lib/navegacao-por-teclado.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

const ids = ["capa", "ld", "folha-1", "folha-2", "folha-3"];

test("a seta anda na ordem do canvas", () => {
  assert.equal(passoDoTeclado("ArrowRight", ids, "ld").proximo, "folha-1");
  assert.equal(passoDoTeclado("ArrowDown", ids, "ld").proximo, "folha-1");
});

test("e volta pelo mesmo caminho", () => {
  assert.equal(passoDoTeclado("ArrowLeft", ids, "folha-1").proximo, "ld");
  assert.equal(passoDoTeclado("ArrowUp", ids, "folha-1").proximo, "ld");
});

test("NADA selecionado, a seta entra pela ponta certa", () => {
  assert.equal(passoDoTeclado("ArrowRight", ids, null).proximo, "capa");
  assert.equal(passoDoTeclado("ArrowLeft", ids, null).proximo, "folha-3");
});

test("a ponta SEGURA — nao da a volta e nao perde o lugar", () => {
  assert.equal(passoDoTeclado("ArrowRight", ids, "folha-3").proximo, "folha-3");
  assert.equal(passoDoTeclado("ArrowLeft", ids, "capa").proximo, "capa");
});

test("tecla que nao navega nao e consumida — o resto da tela ainda a recebe", () => {
  assert.deepEqual(passoDoTeclado("e", ids, "capa"), { proximo: null, consumiu: false });
  assert.deepEqual(passoDoTeclado("Enter", ids, "capa"), { proximo: null, consumiu: false });
});

test("canvas vazio nao consome seta nenhuma", () => {
  assert.deepEqual(passoDoTeclado("ArrowRight", [], null), { proximo: null, consumiu: false });
});

test("selecionado que sumiu do canvas cai na ponta, em vez de travar", () => {
  assert.equal(passoDoTeclado("ArrowRight", ids, "folha-apagada").proximo, "capa");
});

// --- a guarda do compositor
test("campo de texto fica com a tecla", () => {
  assert.equal(ehDigitacao({ tagName: "INPUT" }), true);
  assert.equal(ehDigitacao({ tagName: "textarea" }), true);
  assert.equal(ehDigitacao({ tagName: "SELECT" }), true);
  assert.equal(ehDigitacao({ tagName: "DIV", isContentEditable: true }), true);
});

test("o resto da tela nao fica", () => {
  assert.equal(ehDigitacao({ tagName: "DIV" }), false);
  assert.equal(ehDigitacao(null), false);
});

console.log(`\n${passed} ok`);
