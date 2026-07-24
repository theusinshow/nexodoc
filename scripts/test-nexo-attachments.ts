/**
 * Smoke-test da partição de anexos (memorial vs prancha). Núcleo PURO sem
 * imports → roda com node cru; o classificador é injetado (aqui, um stub que
 * imita a regra filename-first).
 *
 *   node scripts/test-nexo-attachments.ts   (== npm run test:nexo:attachments)
 */
import assert from "node:assert/strict";

import { partitionAttachments } from "../modules/nexo/lib/attachments-core.ts";

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

// Stub do classificador filename-first (memorial = md_geral/memorial no nome).
const isMemorial = (name: string) => /md_geral|memorial/i.test(name);
const f = (name: string) => ({ name });

test("separa memorial de pranchas", () => {
  const r = partitionAttachments(
    [f("040_26_md_geral_a.pdf"), f("040_26_est_005_a.pdf"), f("040_26_est_006_a.pdf")],
    isMemorial,
  );
  assert.deepEqual(r.memorials.map((x) => x.name), ["040_26_md_geral_a.pdf"]);
  assert.equal(r.pranchas.length, 2);
});

test("sem memorial -> tudo prancha", () => {
  const r = partitionAttachments([f("a_est_1.pdf"), f("b_est_2.pdf")], isMemorial);
  assert.equal(r.memorials.length, 0);
  assert.equal(r.pranchas.length, 2);
});

test("só memorial -> nenhuma prancha", () => {
  const r = partitionAttachments([f("117_25_memorial.pdf")], isMemorial);
  assert.equal(r.memorials.length, 1);
  assert.equal(r.pranchas.length, 0);
});

test("preserva a ordem dentro de cada grupo", () => {
  const r = partitionAttachments(
    [f("p1.pdf"), f("md_geral.pdf"), f("p2.pdf"), f("memorial_2.pdf")],
    isMemorial,
  );
  assert.deepEqual(r.pranchas.map((x) => x.name), ["p1.pdf", "p2.pdf"]);
  assert.deepEqual(r.memorials.map((x) => x.name), ["md_geral.pdf", "memorial_2.pdf"]);
});

test("lista vazia -> grupos vazios", () => {
  const r = partitionAttachments([], isMemorial);
  assert.equal(r.memorials.length, 0);
  assert.equal(r.pranchas.length, 0);
});

console.log(`\n${passed} testes ok`);
