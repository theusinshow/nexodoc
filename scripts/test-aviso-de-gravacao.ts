/**
 * QUÃO GRAVE É UMA FALHA DE GRAVAÇÃO.
 *
 * Alarme só onde o próximo clique pode custar trabalho. Aviso que aparece à toa
 * é aviso que se aprende a ignorar — e aí ele não serve para o dia em que
 * importa.
 *
 * Esta função nasceu de um diagnóstico ERRADO: a spec deduziu uma corrida no
 * snapshot, a prova a refutou, e o que sobrou foi a constatação de que
 * `putConversation` engolia a própria falha na linha seguinte ao comentário que
 * a chamava de "a gravação que vale no instante". Enquanto ela falha calada,
 * todo diagnóstico deste produto é dedução.
 *
 *   node scripts/test-aviso-de-gravacao.ts   (== npm run test:aviso-gravacao)
 */
import assert from "node:assert/strict";

import { avisoDeGravacao } from "../modules/nexo/lib/aviso-de-gravacao.ts";

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

test("os dois gravaram → silêncio", () => {
  assert.equal(avisoDeGravacao("ok", "ok"), "nenhum");
});

test("servidor desligado não é falha — o Nexo sempre funcionou assim", () => {
  assert.equal(avisoDeGravacao("ok", "desligada"), "nenhum");
});

test("só o servidor falhou → o aviso âmbar que já existe", () => {
  assert.equal(avisoDeGravacao("ok", "falhou"), "so-disco");
});

test("só o disco falhou → trabalho a salvo, aviso informativo", () => {
  assert.equal(avisoDeGravacao("falhou", "ok"), "so-servidor");
});

test("os DOIS falharam → grave", () => {
  assert.equal(avisoDeGravacao("falhou", "falhou"), "grave");
});

test("disco falhou e servidor DESLIGADO é grave, não silêncio", () => {
  /*
   * O caso que parece inofensivo e é o pior. Servidor desligado não é rede de
   * segurança: se ele nunca grava, o trabalho está só na aba aberta, e fechá-la
   * o perde. É o caso da instalação sem banco — o normal aparente.
   */
  assert.equal(avisoDeGravacao("falhou", "desligada"), "grave");
});

test("expurgada não é perda — é ordem cumprida, e não vira aviso", () => {
  /*
   * O administrador apagou a conversa pelo painel; o servidor respondeu 410 e o
   * cliente está apagando a cópia local. "Não foi possível salvar" mandaria a
   * pessoa tentar recuperar o que alguém decidiu apagar — e insistir é
   * exatamente o que o 410 existe para impedir.
   */
  assert.equal(avisoDeGravacao("ok", "expurgada"), "nenhum");
});

test("expurgada cala o aviso mesmo com o disco falhando", () => {
  // Não há o que proteger numa conversa que está saindo dos dois lados.
  assert.equal(avisoDeGravacao("falhou", "expurgada"), "nenhum");
});

console.log(`\n${passed} teste(s) de aviso de gravação OK`);
