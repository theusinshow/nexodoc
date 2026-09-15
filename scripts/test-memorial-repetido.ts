/**
 * Teste da DEDUPLICAÇÃO do memorial: mesmo nome E mesmo conteúdo.
 *
 * Decidido pelo Matheus em 15/09/2026 (cenário C1 da bateria): soltar de novo o
 * memorial que a conversa já tem não cria chip nem relê o documento.
 *
 * Refinado no mesmo dia (revisão final da segunda rodada): a primeira versão
 * comparava só o NOME, e dois PDFs diferentes com o mesmo nome são a regra na
 * revisão de memorial (`use-delta-do-memorial.ts`) — a revisão B era ignorada e
 * a auditoria rodava na A. Agora repetido é mesmo nome, mesmo tamanho e mesmo
 * sha-256; mesmo nome com bytes novos é REVISÃO e troca o memorial.
 *
 *   node scripts/test-memorial-repetido.ts
 */
import assert from "node:assert/strict";

import { separarMemorialRepetido } from "../modules/nexo/lib/memorial-repetido.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

/** Um File mínimo: nome, tamanho e bytes — o que o navegador entrega no drop. */
function arquivo(name: string, texto = "memorial versão A") {
  const bytes = new TextEncoder().encode(texto);
  let lidas = 0;
  return {
    name,
    size: bytes.byteLength,
    get lidas() {
      return lidas;
    },
    async arrayBuffer() {
      lidas++;
      return bytes.slice().buffer;
    },
  };
}

const MD = "990_26_md_bateria_a.pdf";

await test("sem memorial retido, tudo é novo", async () => {
  const pdfs = [arquivo(MD)];
  const r = await separarMemorialRepetido(pdfs, null);
  assert.deepEqual(r.novos, pdfs);
  assert.equal(r.repetido, null);
  assert.equal(r.revisao, null);
});

await test("mesmo nome e mesmos bytes: sai do lote e é dito", async () => {
  const r = await separarMemorialRepetido([arquivo(MD)], arquivo(MD));
  assert.deepEqual(r.novos, []);
  assert.equal(r.repetido, MD);
  assert.equal(r.revisao, null);
});

await test("mesmo nome com bytes novos (mesmo tamanho): é revisão, fica no lote", async () => {
  const novo = arquivo(MD, "memorial versão B");
  const r = await separarMemorialRepetido([novo], arquivo(MD, "memorial versão A"));
  assert.deepEqual(r.novos, [novo]);
  assert.equal(r.repetido, null);
  assert.equal(r.revisao, MD);
});

await test("mesmo nome com tamanho diferente: é revisão, sem ler os bytes", async () => {
  const novo = arquivo(MD, "memorial versão B, com uma seção a mais");
  const retido = arquivo(MD, "memorial versão A");
  const r = await separarMemorialRepetido([novo], retido);
  assert.deepEqual(r.novos, [novo]);
  assert.equal(r.revisao, MD);
  assert.equal(novo.lidas + retido.lidas, 0, "tamanho diferente já decide");
});

await test("no lote misto, as pranchas seguem e só o memorial repetido sai", async () => {
  const prancha = arquivo("990_26_est_001_a.pdf", "prancha");
  const r = await separarMemorialRepetido([arquivo(MD), prancha], arquivo(MD));
  assert.deepEqual(r.novos, [prancha]);
  assert.equal(r.repetido, MD);
  assert.equal(r.revisao, null);
});

await test("outro memorial, com outro nome, não é repetido nem revisão", async () => {
  const pdfs = [arquivo("990_26_md_bateria_b.pdf")];
  const r = await separarMemorialRepetido(pdfs, arquivo(MD));
  assert.deepEqual(r.novos, pdfs);
  assert.equal(r.repetido, null);
  assert.equal(r.revisao, null);
});

await test("o nome é exato: caixa diferente é outro arquivo", async () => {
  const pdfs = [arquivo("990_26_MD_BATERIA_A.pdf")];
  const r = await separarMemorialRepetido(pdfs, arquivo(MD));
  assert.deepEqual(r.novos, pdfs);
  assert.equal(r.repetido, null);
  assert.equal(r.revisao, null);
});

console.log(`\n${passed} teste(s) passaram`);
