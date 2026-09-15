/**
 * Teste da DEDUPLICAÇÃO do memorial pelo nome.
 *
 * Decidido pelo Matheus em 15/09/2026 (cenário C1 da bateria): soltar de novo o
 * memorial que a conversa já tem não cria chip nem relê o documento. É a mesma
 * régua que as pranchas seguem desde o "soltar o mesmo arquivo de novo não o
 * duplica" (NexoWorkspace.tsx) — por NOME EXATO, que é o que a tela mostra.
 *
 *   node scripts/test-memorial-repetido.ts
 */
import assert from "node:assert/strict";

import { separarMemorialRepetido } from "../modules/nexo/lib/memorial-repetido.ts";

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

const arquivo = (name: string) => ({ name });

test("sem memorial retido, tudo é novo", () => {
  const pdfs = [arquivo("990_26_md_bateria_a.pdf")];
  assert.deepEqual(separarMemorialRepetido(pdfs, null), { novos: pdfs, repetido: null });
});

test("o mesmo nome do memorial retido sai do lote e é dito", () => {
  const r = separarMemorialRepetido([arquivo("990_26_md_bateria_a.pdf")], "990_26_md_bateria_a.pdf");
  assert.deepEqual(r, { novos: [], repetido: "990_26_md_bateria_a.pdf" });
});

test("no lote misto, as pranchas seguem e só o memorial repetido sai", () => {
  const r = separarMemorialRepetido(
    [arquivo("990_26_md_bateria_a.pdf"), arquivo("990_26_est_001_a.pdf")],
    "990_26_md_bateria_a.pdf",
  );
  assert.deepEqual(r, { novos: [arquivo("990_26_est_001_a.pdf")], repetido: "990_26_md_bateria_a.pdf" });
});

test("outro memorial, com outro nome, não é repetido", () => {
  const pdfs = [arquivo("990_26_md_bateria_b.pdf")];
  assert.deepEqual(separarMemorialRepetido(pdfs, "990_26_md_bateria_a.pdf"), { novos: pdfs, repetido: null });
});

test("a regra é o nome exato, como nas pranchas", () => {
  const pdfs = [arquivo("990_26_MD_BATERIA_A.pdf")];
  assert.deepEqual(separarMemorialRepetido(pdfs, "990_26_md_bateria_a.pdf"), { novos: pdfs, repetido: null });
});

console.log(`\n${passed} teste(s) passaram`);
