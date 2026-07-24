/**
 * Smoke-test do agrupamento de conversas da sidebar (busca + pastas por obra).
 * Núcleo PURO (só type-import) → roda com node cru.
 *
 *   node scripts/test-nexo-group.ts   (== npm run test:nexo:group)
 */
import assert from "node:assert/strict";

import { groupConversations } from "../modules/nexo/lib/group-conversations.ts";
import type { ConversationSummary } from "../modules/nexo/lib/nexo-db.ts";

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

let t = 0;
const conv = (title: string, folderKey?: string): ConversationSummary => ({
  id: `id-${t++}`,
  title,
  updatedAt: 0,
  createdAt: 0,
  folderKey,
});

test("vazio -> sem grupos", () => {
  assert.deepEqual(groupConversations([], ""), []);
});

test("agrupa por folderKey preservando ordem de aparição", () => {
  const list = [
    conv("LD est", "040-26"),
    conv("Capa arq", "117-25"),
    conv("Volume", "040-26"),
  ];
  const g = groupConversations(list, "");
  assert.deepEqual(g.map((x) => x.key), ["040-26", "117-25"]);
  assert.equal(g[0].items.length, 2); // 040-26 tem 2
  assert.equal(g[1].items.length, 1);
});

test("sem folderKey -> grupo key null (Sem pasta)", () => {
  const g = groupConversations([conv("avulsa")], "");
  assert.equal(g.length, 1);
  assert.equal(g[0].key, null);
});

test("busca filtra por título (case-insensitive)", () => {
  const list = [conv("Auditoria memorial", "1"), conv("LD estrutural", "1")];
  const g = groupConversations(list, "AUDIT");
  assert.equal(g.length, 1);
  assert.equal(g[0].items.length, 1);
  assert.equal(g[0].items[0].title, "Auditoria memorial");
});

test("busca sem match -> nenhum grupo", () => {
  assert.deepEqual(groupConversations([conv("x", "1")], "zzz"), []);
});

console.log(`\n${passed} testes ok`);
