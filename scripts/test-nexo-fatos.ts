/**
 * Teste da REGRA DE FATOS do agente: sobre o que ele pode falar, dado o que a
 * conversa tem. Substitui a guarda "sem selos, recusa" — que impedia auditar
 * memorial, porque memorial não tem selo de prancha.
 *
 *   node scripts/test-nexo-fatos.ts   (== npm run test:nexo:fatos)
 */
import assert from "node:assert/strict";

import { fatosDaConversa } from "../server/nexo/agent/fatos.ts";

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

const MEMORIAL = {
  fileName: "017_26_md_geral_c.pdf",
  obra: "Centro Comunitário Primeira Linha",
  municipio: "Criciúma",
  codigo: "017-26",
};

test("sem selos e sem memorial, o agente NÃO tem sobre o que falar", () => {
  const f = fatosDaConversa([], null);
  assert.equal(f.temFatos, false);
  assert.equal(f.temSelos, false);
  assert.equal(f.temMemorial, false);
});

test("só memorial: tem fatos, e o gabarito vem do próprio documento", () => {
  const f = fatosDaConversa([], MEMORIAL);
  assert.equal(f.temFatos, true);
  assert.equal(f.temMemorial, true);
  assert.equal(f.gabarito.obra, MEMORIAL.obra);
  assert.equal(f.gabarito.origem, "memorial");
});

test("só selos: tem fatos, sem memorial para auditar", () => {
  const f = fatosDaConversa([{ obra: "OBRA DAS PRANCHAS" }], null);
  assert.equal(f.temFatos, true);
  assert.equal(f.temSelos, true);
  assert.equal(f.temMemorial, false);
  assert.equal(f.gabarito.origem, "selos");
});

test("OS DOIS: o carimbo manda no gabarito — fonte independente do memorial", () => {
  // É o caso mais forte do produto: o memorial pode estar inteiro com o nome de
  // outra obra, e é o carimbo da prancha que denuncia.
  const f = fatosDaConversa([{ obra: "OBRA DAS PRANCHAS" }], MEMORIAL);
  assert.equal(f.temSelos, true);
  assert.equal(f.temMemorial, true);
  assert.equal(f.gabarito.obra, "OBRA DAS PRANCHAS");
  assert.equal(f.gabarito.origem, "selos");
});

test("memorial sem obra legível não inventa gabarito", () => {
  const f = fatosDaConversa([], { fileName: "x.pdf" });
  assert.equal(f.temFatos, true);
  assert.equal(f.gabarito.obra, null);
  assert.equal(f.gabarito.origem, "nenhuma");
});

test("obra em branco ou só espaço conta como ausente", () => {
  const f = fatosDaConversa([], { fileName: "x.pdf", obra: "   " });
  assert.equal(f.gabarito.obra, null);
});

console.log(`\n${passed} teste(s) de fatos OK`);
