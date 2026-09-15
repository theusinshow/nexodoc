/**
 * Teste de ONDE O PARECER QUE CHEGA É GRAVADO.
 *
 * Em 15/09/2026 a jornada c5 abriu outra conversa enquanto a auditoria de A
 * rodava: quando a resposta chegou, `saveResult` gravou o parecer de A na
 * conversa aberta, B, e o `finally` limpou o bilhete de B em vez do de A. A
 * regra: só a conversa que pediu recebe o parecer; aberta outra, o bilhete de A
 * fica, e A se reconecta ao ser reaberta.
 *
 *   node scripts/test-destino-do-parecer.ts
 */
import assert from "node:assert/strict";

import { desfechoNaChegada } from "../modules/nexo/lib/destino-do-parecer.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

test("a mesma conversa aberta: grava o parecer e fecha o bilhete", () => {
  assert.deepEqual(
    desfechoNaChegada({ origem: "A", aberta: "A", desconectou: false }),
    { gravarParecer: true, limparBilhete: true },
  );
});

test("outra conversa aberta: não grava nela, e o bilhete de A fica para a reconexão", () => {
  assert.deepEqual(
    desfechoNaChegada({ origem: "A", aberta: "B", desconectou: false }),
    { gravarParecer: false, limparBilhete: false },
  );
});

test("conexão caída na própria conversa: o bilhete fica (regra de 12/08/2026)", () => {
  assert.deepEqual(
    desfechoNaChegada({ origem: "A", aberta: "A", desconectou: true }),
    { gravarParecer: false, limparBilhete: false },
  );
});

test("origem desconhecida nunca grava em conversa nenhuma", () => {
  assert.deepEqual(
    desfechoNaChegada({ origem: "", aberta: "", desconectou: false }),
    { gravarParecer: false, limparBilhete: false },
  );
});

console.log(`\n${passed} teste(s) passaram`);
