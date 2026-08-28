/**
 * O ZOOM SEMÂNTICO — os três níveis, sem navegador.
 *
 *   node scripts/test-densidade-do-canvas.ts   (== npm run test:densidade)
 */
import assert from "node:assert/strict";

import {
  ZOOM_LONGE,
  ZOOM_PERTO,
  densidadeDoZoom,
  oQueMostrar,
} from "../modules/nexo/lib/densidade-do-canvas.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("os limiares cabem na escala do canvas (0,3 a 1,5)", () => {
  assert.ok(ZOOM_LONGE > 0.3 && ZOOM_LONGE < ZOOM_PERTO && ZOOM_PERTO < 1.5);
});

test("as tres faixas existem de verdade", () => {
  assert.equal(densidadeDoZoom(0.3), "longe");
  assert.equal(densidadeDoZoom(0.8), "media");
  assert.equal(densidadeDoZoom(1.5), "perto");
});

test("o limiar e INCLUSIVO para cima — nao ha zoom sem nivel", () => {
  assert.equal(densidadeDoZoom(ZOOM_LONGE), "media");
  assert.equal(densidadeDoZoom(ZOOM_PERTO), "perto");
  assert.equal(densidadeDoZoom(ZOOM_LONGE - 0.001), "longe");
  assert.equal(densidadeDoZoom(ZOOM_PERTO - 0.001), "media");
});

test("zoom invalido cai na densidade do meio, e nao quebra o no", () => {
  // Infinity tambem NAO e finito: cair em "perto" faria um valor absurdo abrir
  // o carimbo inteiro em duzentos nos de uma vez. O meio e o unico fallback que
  // nao piora nada.
  assert.equal(densidadeDoZoom(Number.NaN), "media");
  assert.equal(densidadeDoZoom(Infinity), "media");
  assert.equal(densidadeDoZoom(-Infinity), "media");
});

test("de longe, o no e so padrao: numero sim, texto nao", () => {
  const m = oQueMostrar("longe");
  assert.equal(m.numero, true);
  assert.equal(m.titulo, false);
  assert.equal(m.sigla, false);
  assert.equal(m.carimbo, false);
});

test("so de PERTO o carimbo inteiro aparece", () => {
  assert.equal(oQueMostrar("media").carimbo, false);
  assert.equal(oQueMostrar("perto").carimbo, true);
});

test("A MARCA DE CORRIGIDO A MAO sobrevive aos tres niveis", () => {
  for (const d of ["longe", "media", "perto"] as const) {
    assert.equal(oQueMostrar(d).marcas, true, d);
  }
});

test("o numero nunca some: sem ele a fileira vira mancha sem ordem", () => {
  for (const d of ["longe", "media", "perto"] as const) {
    assert.equal(oQueMostrar(d).numero, true, d);
  }
});

console.log(`\n${passed} ok`);
