/**
 * O MEMORIAL ANEXADO APAGA AS FOLHAS DE CARIMBO DELE MESMO.
 *
 * 17/09/2026, Urubici: o memorial tinha sido lido como prancha e a conversa
 * guardava 206 folhas dele. Reanexado como memorial, as folhas velhas ficavam —
 * e o cartão seguia anunciando a obra "lida do carimbo das pranchas".
 *
 *   node scripts/test-folhas-do-memorial.ts   (== npm run test:folhas-do-memorial)
 */
import assert from "node:assert/strict";

import { folhasDoArquivo, semAsFolhasDoArquivo } from "../modules/nexo/lib/folhas-do-memorial.ts";

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

const folhas = [
  ...Array.from({ length: 206 }, (_, i) => ({ fileName: "031_26_md_geral_a.pdf", pageNumber: i + 1 })),
  { fileName: "031_26_hid_001_a.pdf", pageNumber: 1 },
  { fileName: "031_26_hid_002_a.pdf", pageNumber: 1 },
];

test("REGRESSÃO Urubici: as 206 folhas do próprio memorial saem", () => {
  const restantes = semAsFolhasDoArquivo(folhas, "031_26_md_geral_a.pdf");
  assert.equal(restantes.length, 2);
  assert.equal(folhasDoArquivo(folhas, "031_26_md_geral_a.pdf"), 206);
});

test("as pranchas de verdade ficam — a conversa pode ter os dois trabalhos", () => {
  const restantes = semAsFolhasDoArquivo(folhas, "031_26_md_geral_a.pdf");
  assert.deepEqual(
    restantes.map((f) => f.fileName),
    ["031_26_hid_001_a.pdf", "031_26_hid_002_a.pdf"],
  );
});

test("memorial que nunca virou folha não mexe em nada", () => {
  const restantes = semAsFolhasDoArquivo(folhas, "027_24_md_geral_a.pdf");
  assert.equal(restantes.length, folhas.length);
  assert.equal(folhasDoArquivo(folhas, "027_24_md_geral_a.pdf"), 0);
});

test("lista vazia continua vazia", () => {
  assert.deepEqual(semAsFolhasDoArquivo([], "qualquer.pdf"), []);
});

console.log(`\n${passed} teste(s) de folhas do memorial OK`);
