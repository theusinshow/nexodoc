/**
 * Smoke-test dos próximos passos contextuais (chips abaixo da resposta). Núcleo
 * PURO (só type-import) → roda com node cru.
 *
 *   node scripts/test-nexo-next-steps.ts   (== npm run test:nexo:next-steps)
 */
import assert from "node:assert/strict";

import { nextStepsFor } from "../modules/nexo/lib/next-steps.ts";
import type { NexoAgentProposal } from "../modules/nexo/types.ts";

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

const props = (...kinds: string[]) =>
  kinds.map((kind) => ({ kind })) as unknown as NexoAgentProposal[];
const labels = (p: NexoAgentProposal[] | undefined) => nextStepsFor(p).map((s) => s.label);

test("vazio/undefined -> nenhum passo", () => {
  assert.deepEqual(nextStepsFor(undefined), []);
  assert.deepEqual(nextStepsFor([]), []);
});

test("sem ld/capa (conferencia/volume) -> nada a encadear", () => {
  assert.deepEqual(labels(props("conferencia", "volume")), []);
});

test("só LD -> Gerar a capa + Conferir + Montar", () => {
  assert.deepEqual(labels(props("ld")), [
    "Gerar a capa",
    "Conferir as folhas",
    "Montar o volume",
  ]);
});

test("só capa -> Gerar a LD + Conferir + Montar", () => {
  assert.deepEqual(labels(props("capa")), [
    "Gerar a LD",
    "Conferir as folhas",
    "Montar o volume",
  ]);
});

test("LD + capa -> não sugere gerar LD/capa de novo", () => {
  assert.deepEqual(labels(props("ld", "capa")), [
    "Conferir as folhas",
    "Montar o volume",
  ]);
});

test("cada passo carrega uma frase p/ o agente", () => {
  const steps = nextStepsFor(props("ld"));
  assert.ok(steps.every((s) => s.send.trim().length > 0));
});

console.log(`\n${passed} testes ok`);
