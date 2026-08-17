/**
 * O CONTEXTO DA LEITURA GLOBAL numa reauditoria.
 *
 * Capítulo que não mudou vai como RESUMO, não como texto — é para isso que
 * `runtime.sintese` é gravado em todo parecer. Sem isso, a passada mais cara da
 * auditoria (US$ 1,19 medidos no 084_25 em 17/08/2026) continuaria relendo o
 * documento inteiro e o reuso teria piso alto.
 *
 *   node scripts/test-contexto-da-global.ts   (== npm run test:contexto-global)
 */
import assert from "node:assert/strict";

import { buildDocumentContextComReuso } from "../lib/audit-validation-prompt.ts";

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

const CAPITULOS = [
  { hash: "h1", titulo: "1 - APRESENTACAO", texto: "TEXTO INTEGRAL DA APRESENTACAO" },
  { hash: "h2", titulo: "2 - PAREDES", texto: "TEXTO INTEGRAL DAS PAREDES" },
  { hash: "h3", titulo: "3 - ELETRICA", texto: "TEXTO INTEGRAL DA ELETRICA" },
];
const RESUMOS = new Map([
  ["h1", "Apresenta a obra e o municipio."],
  ["h3", "Descreve quadros e circuitos."],
]);

test("capítulo herdado entra como resumo; o mudado, como texto", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(["h1", "h3"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.ok(ctx.includes("TEXTO INTEGRAL DAS PAREDES"), "o capítulo mudado vai inteiro");
  assert.ok(!ctx.includes("TEXTO INTEGRAL DA APRESENTACAO"), "o herdado não vai inteiro");
  assert.ok(ctx.includes("Apresenta a obra e o municipio."), "o herdado vai resumido");
  assert.ok(ctx.includes("Descreve quadros e circuitos."));
});

test("o resumo diz que é resumo — o modelo precisa saber o que está lendo", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(["h1"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.match(ctx, /resumo|inalterado/i);
});

test("herdado SEM resumo gravado volta a ir como texto", () => {
  /*
   * Parecer antigo pode ter impressão e não ter síntese. Mandar o capítulo como
   * uma linha em branco esconderia o conteúdo do modelo — o lado seguro é
   * gastar, não perder.
   */
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(["h2"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.ok(ctx.includes("TEXTO INTEGRAL DAS PAREDES"));
});

test("todos herdados ainda produz contexto útil, não vazio", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: [CAPITULOS[0], CAPITULOS[2]],
    hashesHerdados: new Set(["h1", "h3"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.ok(ctx.length > 20);
  assert.ok(ctx.includes("1 - APRESENTACAO"), "o título fica, para o modelo ver a estrutura");
});

test("respeita o teto de caracteres", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(),
    resumoPorHash: new Map(),
    maxChars: 50,
  });
  assert.ok(ctx.length <= 200, `contexto de ${ctx.length} chars estourou o teto`);
});

console.log(`\n${passed} teste(s) de contexto da global OK`);
