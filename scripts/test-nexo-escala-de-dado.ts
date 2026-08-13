/**
 * A escala SEQUENCIAL de dado — o donut de consumo e o que vier depois. Núcleo
 * PURO (nenhum import de valor) → roda com node cru.
 *
 *   node scripts/test-nexo-escala-de-dado.ts   (== npm run test:nexo:escala)
 */
import assert from "node:assert/strict";

import {
  ESCALA_DE_DADO,
  FORA_DA_ESCALA,
  fatiasDaEscala,
} from "../modules/nexo/lib/escala-de-dado.ts";

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

test("zero ou negativo -> nenhuma fatia", () => {
  assert.deepEqual(fatiasDaEscala(0), []);
  assert.deepEqual(fatiasDaEscala(-3), []);
});

test("uma fatia -> o degrau mais claro (o que mais avanca no fundo escuro)", () => {
  assert.deepEqual(fatiasDaEscala(1), ["var(--data-5)"]);
});

test("duas fatias -> os extremos, nunca dois tons vizinhos", () => {
  assert.deepEqual(fatiasDaEscala(2), ["var(--data-5)", "var(--data-1)"]);
});

test("tres fatias -> extremos + meio", () => {
  assert.deepEqual(fatiasDaEscala(3), [
    "var(--data-5)",
    "var(--data-3)",
    "var(--data-1)",
  ]);
});

test("cinco fatias -> a rampa inteira, do claro ao escuro", () => {
  assert.deepEqual(fatiasDaEscala(5), [...ESCALA_DE_DADO]);
});

test("acima da rampa -> o excedente sai da escala, sem repetir degrau", () => {
  const sete = fatiasDaEscala(7);
  assert.equal(sete.length, 7);
  assert.deepEqual(sete.slice(0, 5), [...ESCALA_DE_DADO]);
  assert.deepEqual(sete.slice(5), [FORA_DA_ESCALA, FORA_DA_ESCALA]);
});

test("toda fatia e distinta enquanto a rampa alcanca", () => {
  for (const n of [2, 3, 4, 5]) {
    const fatias = fatiasDaEscala(n);
    assert.equal(new Set(fatias).size, n, `${n} fatias deveriam ser distintas`);
  }
});

/*
 * O TESTE QUE EXISTE PELA REGRA, não pelo comportamento.
 *
 * O donut pintava as fatias com `var(--ring)` e duas transparências do teal — e
 * o docblock de lá ASSUMIA o desvio ("escala do teal do sistema — distinção,
 * não semântica"). Teal significa interativo (§2, Regra do Acento Único), e
 * fatia de gráfico não se clica. Sem esta asserção, a próxima pessoa com pressa
 * devolve o teal por achar mais bonito, e a regra morre onde é ensinada.
 */
test("nenhum degrau usa cor de interatividade", () => {
  const proibidos = ["--ring", "--primary", "--accent", "5bdac6", "00a693"];
  for (const cor of [...ESCALA_DE_DADO, FORA_DA_ESCALA]) {
    for (const p of proibidos) {
      assert.ok(
        !cor.includes(p),
        `"${cor}" usa ${p}, que significa interatividade`,
      );
    }
  }
});

console.log(`\n${passed} teste(s) ok`);
