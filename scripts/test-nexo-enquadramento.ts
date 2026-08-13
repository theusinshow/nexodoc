/**
 * O enquadramento do carimbo — núcleo PURO, roda com node cru.
 *
 *   node scripts/test-nexo-enquadramento.ts   (== npm run test:nexo:enquadramento)
 */
import assert from "node:assert/strict";

import {
  DENSIDADE_MAXIMA,
  PAGINA_INTEIRA,
  densidadeDeRender,
  enquadrarSelo,
} from "../modules/nexo/lib/enquadramento-do-selo.ts";

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

/** A0 medida nas pranchas reais de docs/samples/040-26. */
const A0 = { largura: 2384, altura: 1684 };
const QUADRO = { largura: 800, altura: 600 };
/** Caixa típica do carimbo: canto inferior direito. */
const SELO = { x0: 0.79, y0: 0.81, x1: 1, y1: 1 };

test("caixa degenerada -> pagina inteira, sem dividir por zero", () => {
  assert.deepEqual(
    enquadrarSelo({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 }, A0, QUADRO),
    PAGINA_INTEIRA,
  );
  assert.deepEqual(
    enquadrarSelo({ x0: 1, y0: 1, x1: 0, y1: 0 }, A0, QUADRO),
    PAGINA_INTEIRA,
  );
});

test("quadro sem tamanho (antes do layout) -> pagina inteira", () => {
  assert.deepEqual(
    enquadrarSelo(SELO, A0, { largura: 0, altura: 0 }),
    PAGINA_INTEIRA,
  );
});

test("o centro do carimbo cai no centro do quadro", () => {
  const e = enquadrarSelo(SELO, A0, QUADRO);
  const centroX = ((SELO.x0 + SELO.x1) / 2) * A0.largura;
  const centroY = ((SELO.y0 + SELO.y1) / 2) * A0.altura;
  assert.ok(Math.abs(e.escala * centroX + e.x - QUADRO.largura / 2) < 0.001);
  assert.ok(Math.abs(e.escala * centroY + e.y - QUADRO.altura / 2) < 0.001);
});

test("o carimbo cabe no quadro, com folga nas duas dimensoes", () => {
  const e = enquadrarSelo(SELO, A0, QUADRO);
  const larguraFinal = (SELO.x1 - SELO.x0) * A0.largura * e.escala;
  const alturaFinal = (SELO.y1 - SELO.y0) * A0.altura * e.escala;
  assert.ok(larguraFinal <= QUADRO.largura, "estourou a largura");
  assert.ok(alturaFinal <= QUADRO.altura, "estourou a altura");
  // E ENCHE: um enquadramento que sobra metade do quadro nao enquadrou nada.
  assert.ok(
    Math.max(larguraFinal / QUADRO.largura, alturaFinal / QUADRO.altura) > 0.85,
    "sobrou quadro demais",
  );
});

test("A0 e A1 dao enquadramentos diferentes, e os dois cabem", () => {
  const a1 = { largura: 3370, altura: 1684 };
  for (const pagina of [A0, a1]) {
    const e = enquadrarSelo(SELO, pagina, QUADRO);
    const l = (SELO.x1 - SELO.x0) * pagina.largura * e.escala;
    const a = (SELO.y1 - SELO.y0) * pagina.altura * e.escala;
    assert.ok(l <= QUADRO.largura && a <= QUADRO.altura, "estourou o quadro");
  }
  assert.notEqual(
    enquadrarSelo(SELO, A0, QUADRO).escala,
    enquadrarSelo(SELO, a1, QUADRO).escala,
  );
});

test("a escala tem teto: carimbo minusculo nao vira raster gigante", () => {
  const e = enquadrarSelo({ x0: 0.98, y0: 0.98, x1: 1, y1: 1 }, A0, QUADRO);
  assert.ok(e.escala <= 6, `escala ${e.escala} passou do teto`);
});

/*
 * DENSIDADE DE RENDER — o carimbo enquadrado tem de ser LEGÍVEL.
 *
 * O visor rasterizava numa largura fixa e ampliava por CSS: o carimbo abria
 * enquadrado e borrado. Ampliar bitmap não cria detalhe, e um carimbo que não
 * se lê derruba a razão de existir do modo selo.
 */
test("a densidade acompanha o zoom do enquadramento", () => {
  assert.equal(densidadeDeRender(3, 1), 3);
  assert.equal(densidadeDeRender(2, 2), 4);
});

test("nunca abaixo da densidade da tela", () => {
  assert.equal(densidadeDeRender(1, 2), 2, "num retina, a folha inteira já precisa de 2x");
  assert.equal(densidadeDeRender(0.5, 2), 2);
});

test("tem teto: o canvas cresce ao quadrado e o navegador devolve branco", () => {
  assert.equal(densidadeDeRender(6, 2), DENSIDADE_MAXIMA);
  assert.equal(densidadeDeRender(99, 1), DENSIDADE_MAXIMA);
});

test("entrada torta não produz densidade inválida", () => {
  assert.equal(densidadeDeRender(Number.NaN, Number.NaN), 1);
  assert.equal(densidadeDeRender(0, 0), 1);
});

console.log(`\n${passed} teste(s) ok`);
