/**
 * QUAL CÓPIA ABRIR — disco ou servidor.
 *
 * A abertura escolhia por PRESENÇA: o disco tinha algo, então o disco vencia.
 * Uma gravação que falhou deixa no disco uma versão VELHA, e ela eclipsava a
 * cópia boa do servidor — a conversa voltava com as mensagens e sem o parecer.
 *
 * O comentário da própria abertura já dizia qual era o critério certo: que o
 * conflito de versões "é resolvida na lista, por `updatedAt`, não aqui". A lista
 * comparava data; o caminho de abertura, não.
 *
 *   node scripts/test-copia-mais-nova.ts   (== npm run test:copia-mais-nova)
 */
import assert from "node:assert/strict";

import { escolherCopia } from "../modules/nexo/lib/copia-mais-nova.ts";

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

test("servidor mais novo vence — é o caso que a falha de disco cria", () => {
  assert.equal(escolherCopia({ updatedAt: 100 }, { updatedAt: 200 }), "servidor");
});

test("disco mais novo vence — trabalho offline não é atropelado", () => {
  assert.equal(escolherCopia({ updatedAt: 300 }, { updatedAt: 200 }), "disco");
});

test("empate resolve para o disco, como em fundirListas", () => {
  /*
   * A mesma regra que `fundirListas` já usa na listagem ("empate resolve para o
   * local: é o que a pessoa tem na frente"). Duas regras de desempate
   * diferentes para o mesmo dado fariam a lista e a abertura discordarem.
   */
  assert.equal(escolherCopia({ updatedAt: 200 }, { updatedAt: 200 }), "disco");
});

test("sem remoto — inclusive quando a lista remota ainda não carregou", () => {
  assert.equal(escolherCopia({ updatedAt: 100 }, null), "disco");
});

test("só no servidor: conversa de outra máquina", () => {
  assert.equal(escolherCopia(null, { updatedAt: 100 }), "servidor");
});

test("nenhuma das duas", () => {
  assert.equal(escolherCopia(null, null), "nenhuma");
});

console.log(`\n${passed} teste(s) de escolha de cópia OK`);
