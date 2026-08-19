/**
 * O CORPO do texto no frame, por modo. Núcleo puro → node cru.
 *
 *   node scripts/test-corpo-do-frame.ts   (== npm run test:nexo:corpo)
 */
import assert from "node:assert/strict";

import { classeDeCorpo } from "../modules/nexo/lib/corpo-do-frame.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("corpo do frame\n");

test("modo CAMPO ignora o corpo do ODT e usa a escala da UI", () => {
  /*
   * O frame promete no cabeçalho ser a ESTRUTURA, não pré-visualização fiel —
   * e importava o corpo da fonte do ODT assim mesmo. É daí que vinha o
   * "pequeno": uma A4 encolhida numa coluna de 520px.
   */
  assert.equal(classeDeCorpo(18, "campo"), classeDeCorpo(8, "campo"));
  assert.equal(classeDeCorpo(undefined, "campo"), classeDeCorpo(11, "campo"));
});

test("modo CAMPO nunca inventa tamanho", () => {
  for (const corpo of [6, 8, 10, 12, 16, 24, undefined]) {
    const c = classeDeCorpo(corpo, "campo");
    assert.ok(!/text-\[/.test(c), `tamanho solto em ${corpo}: ${c}`);
  }
});

test("modo DOCUMENTO volta a seguir o corpo do ODT", () => {
  const grande = classeDeCorpo(18, "documento");
  const medio = classeDeCorpo(16, "documento");
  const corrido = classeDeCorpo(13, "documento");
  assert.notEqual(grande, medio);
  assert.notEqual(medio, corrido);
});

test("modo DOCUMENTO também respeita o piso — fiel é o TEXTO, não o sumiço", () => {
  for (const corpo of [4, 6, 8, 9, 11]) {
    const c = classeDeCorpo(corpo, "documento");
    assert.ok(!/text-\[/.test(c), `tamanho solto em ${corpo}: ${c}`);
  }
  // Tudo abaixo do piso desce até o mesmo degrau, e para por lá.
  assert.equal(classeDeCorpo(4, "documento"), classeDeCorpo(11, "documento"));
});

test("a hierarquia do documento é monotônica: maior nunca vira menor", () => {
  const ordem = ["text-xs", "text-sm", "text-base font-medium", "text-lg font-medium"];
  const posicao = (c: string) => ordem.indexOf(c);
  let anterior = -1;
  for (const corpo of [8, 12, 13, 16, 18, 24]) {
    const p = posicao(classeDeCorpo(corpo, "documento"));
    assert.ok(p >= 0, `classe fora da escala em ${corpo}`);
    assert.ok(p >= anterior, `corpo ${corpo} encolheu em relação ao anterior`);
    anterior = p;
  }
});

console.log(`\n${passed} teste(s) passaram.`);
