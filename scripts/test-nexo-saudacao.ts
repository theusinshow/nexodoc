/**
 * Teste da frase de entrada — as faixas de horário e o nome.
 *
 * Parece bobagem até alguém abrir o software às 18h01 e ser recebido com "bom
 * dia". As bordas (5, 12, 18) são o teste inteiro; o resto é cortesia.
 *
 *   node scripts/test-nexo-saudacao.ts   (== npm run test:nexo:saudacao)
 */
import assert from "node:assert/strict";

import {
  montarSaudacao,
  primeiroNome,
  saudacaoDaHora,
} from "../modules/nexo/lib/saudacao.ts";

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
// As bordas do dia
// ---------------------------------------------------------------------------

test("as três faixas do dia", () => {
  assert.equal(saudacaoDaHora(8), "Bom dia");
  assert.equal(saudacaoDaHora(14), "Boa tarde");
  assert.equal(saudacaoDaHora(21), "Boa noite");
});

test("as BORDAS exatas — é onde a saudação erra feio", () => {
  assert.equal(saudacaoDaHora(4), "Boa noite"); // madrugada
  assert.equal(saudacaoDaHora(5), "Bom dia"); // vira o dia
  assert.equal(saudacaoDaHora(11), "Bom dia");
  assert.equal(saudacaoDaHora(12), "Boa tarde"); // meio-dia já é tarde
  assert.equal(saudacaoDaHora(17), "Boa tarde");
  assert.equal(saudacaoDaHora(18), "Boa noite"); // 18h01 não pode ser "bom dia"
  assert.equal(saudacaoDaHora(0), "Boa noite"); // meia-noite
});

test("hora quebrada é truncada, não arredondada", () => {
  // 11,9h ainda é manhã; arredondar viraria meio-dia e trocaria a saudação.
  assert.equal(saudacaoDaHora(11.9), "Bom dia");
});

test("hora inválida cai no meio do dia em vez de quebrar", () => {
  assert.equal(saudacaoDaHora(Number.NaN), "Boa tarde");
});

// ---------------------------------------------------------------------------
// O nome
// ---------------------------------------------------------------------------

test("usa só o primeiro nome", () => {
  assert.equal(primeiroNome("Matheus Mendes da Silva"), "Matheus");
});

test("nome em CAIXA ALTA não vira grito", () => {
  assert.equal(primeiroNome("MATHEUS MENDES"), "Matheus");
});

test("sem nome, a saudação não fica com vírgula pendurada", () => {
  assert.equal(primeiroNome(null), "");
  assert.equal(primeiroNome("   "), "");
  const frase = montarSaudacao(14, null);
  assert.ok(frase.startsWith("Boa tarde."), frase);
  assert.ok(!frase.includes(", ."), frase);
});

test("com nome, cumprimenta pelo nome", () => {
  assert.equal(
    montarSaudacao(9, "Matheus Mendes"),
    "Bom dia, Matheus.\nO que vamos montar — ou auditar?",
  );
});

test("a pergunta nomeia AS DUAS portas (montar e auditar)", () => {
  // Quem chega com um memorial na mão precisa ver que a auditoria mora aqui.
  const frase = montarSaudacao(14, "Ana");
  assert.match(frase, /montar/);
  assert.match(frase, /auditar/);
});

test("a frase tem exatamente duas linhas — o typewriter conta com isso", () => {
  assert.equal(montarSaudacao(14, "Ana").split("\n").length, 2);
});

console.log(`\n${passed} teste(s) OK`);
