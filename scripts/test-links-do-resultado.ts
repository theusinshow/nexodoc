/**
 * A REGRA DE VISIBILIDADE DOS LINKS — sem navegador, sem token.
 *
 *   node scripts/test-links-do-resultado.ts   (== npm run test:links)
 *
 * O `ResultLinks` saía cedo quando não havia ARQUIVO, e o caso mais comum de
 * bytes ausentes é justamente esse: conversa aberta noutra máquina não tem blob
 * nenhum, o restaurador pula todos e marca `bytesAusentes`. O aviso — e agora o
 * botão Regenerar — nunca chegavam à tela no único caso que os pedia.
 */
import assert from "node:assert/strict";

import { temAlgoADizer } from "../modules/nexo/lib/links-do-resultado.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("com arquivo, fala", () => {
  assert.equal(temAlgoADizer({ files: [{}] }), true);
});

test("sem arquivo e sem marca, cala — não há o que mostrar", () => {
  assert.equal(temAlgoADizer({ files: [] }), false);
});

test("SEM ARQUIVO E COM BYTES AUSENTES, fala — era este o buraco", () => {
  assert.equal(temAlgoADizer({ files: [], bytesAusentes: true }), true);
});

test("com arquivo E marca (bytes de parte deles), fala", () => {
  assert.equal(temAlgoADizer({ files: [{}], bytesAusentes: true }), true);
});

console.log(`\n${passed} ok`);
