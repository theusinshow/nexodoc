/**
 * Smoke-test do separador de fluxo do turno (prosa na tela, JSON na cauda).
 * Núcleo PURO (sem imports de runtime) → roda com node cru.
 *
 *   node scripts/test-nexo-stream.ts   (== npm run test:nexo:stream)
 */
import assert from "node:assert/strict";

import {
  createSplitState,
  pushChunk,
  endStream,
  parseTail,
} from "../server/nexo/agent/split-stream.ts";

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

/** Roda os pedaços pelo separador e devolve { visivel, cauda }. */
function run(chunks: string[]) {
  const state = createSplitState();
  let visivel = "";
  for (const c of chunks) visivel += pushChunk(state, c);
  const { trailing, tail } = endStream(state);
  return { visivel: visivel + trailing, cauda: tail };
}

test("prosa + cerca no fim -> prosa limpa, cauda com o JSON", () => {
  const r = run([
    "Li 15 folhas de estrutura.",
    " Qual título você quer na LD?",
    '\n```json\n{"proposals":[{"kind":"ld"}]}\n```',
  ]);
  assert.equal(r.visivel, "Li 15 folhas de estrutura. Qual título você quer na LD?");
  assert.match(r.cauda, /"kind":"ld"/);
});

test("cerca partida entre pedaços -> não vaza crase na tela", () => {
  const r = run(["Pronto.\n", "``", '`json\n{"proposals":[]}\n```']);
  assert.equal(r.visivel, "Pronto.\n");
  assert.match(r.cauda, /proposals/);
});

test("sem cerca nenhuma -> tudo é prosa, cauda vazia", () => {
  const r = run(["Não entendi o pedido.", " Pode repetir?"]);
  assert.equal(r.visivel, "Não entendi o pedido. Pode repetir?");
  assert.equal(r.cauda, "");
});

test("JSON solto sem cerca (após quebra de linha) -> vira cauda", () => {
  const r = run(['Segue a proposta.\n{"proposals":[{"kind":"capa"}]}']);
  assert.equal(r.visivel, "Segue a proposta.");
  assert.match(r.cauda, /"kind":"capa"/);
});

test("modelo devolve o JSON ANTIGO inteiro -> prosa vazia, tudo na cauda", () => {
  const r = run(['{"reply":"Olá","proposals":[{"kind":"ld"}]}']);
  assert.equal(r.visivel, "");
  const parsed = parseTail(r.cauda);
  assert.equal(parsed.reply, "Olá");
  assert.deepEqual(parsed.proposals, [{ kind: "ld" }]);
});

test("parseTail: cauda inválida não explode", () => {
  assert.deepEqual(parseTail("```json\n{quebrado"), { reply: null, proposals: null });
  assert.deepEqual(parseTail(""), { reply: null, proposals: null });
});

console.log(`\n${passed} teste(s) do separador de fluxo OK.`);
