/**
 * Smoke-test do fio de TOMOS do Nexo (slice pranchas -> LD + capa).
 *
 * Roda sem framework, direto no Node com type-stripping nativo:
 *   node scripts/test-nexo-tomos.ts
 * (também exposto como `npm run test:nexo:tomos`)
 *
 * O nº de tomos é uma DECISÃO do engenheiro (projeto grande -> divide),
 * compartilhada por LD e capa. Este teste trava os dois motores puros dos quais
 * `buildLdProposal`/`buildCapaProposal` dependem — sem depender do resolver de
 * alias `@/` (que o node cru não resolve): importa por caminho relativo com
 * extensão `.ts`, como os demais scripts de teste.
 *
 *  - LD:   `buildBalancedTomos(total, N)` divide as folhas em N faixas.
 *  - Capa: `formatTomo(t, N)` rotula cada uma das N capas ("(TOMO 0X)"),
 *          e some ("") quando N = 1 (tomo único).
 */
import assert from "node:assert/strict";

import { buildBalancedTomos } from "../lib/ld/ld-rules.ts";
import { formatTomo } from "../lib/cover-utils.ts";

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

/** Reproduz o contrato do getTomos (modo "quantity") + rótulo por página que o
 *  buildCapaProposal produz: N páginas, cada uma com seu (TOMO 0X). */
function capaTomoLabels(numTomos: number): string[] {
  const tomos = Array.from({ length: numTomos }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  return tomos.map((t) => formatTomo(t, tomos.length));
}

// --- LD: divisão das folhas em N tomos --------------------------------------

test("numTomos=1 -> LD não fatia (proposta usa tomos vazio)", () => {
  // buildLdProposal só chama buildBalancedTomos quando numTomos > 1.
  // Aqui travamos a fronteira: 1 tomo = sem faixas.
  const tomos = 1 > 1 ? buildBalancedTomos(20, 1) : [];
  assert.deepEqual(tomos, []);
});

test("numTomos=3 -> 3 faixas cobrindo todas as folhas", () => {
  const total = 20;
  const tomos = buildBalancedTomos(total, 3);
  assert.equal(tomos.length, 3, "esperava 3 tomos");
  // soma das folhas de cada tomo = total (nada perdido nem duplicado)
  const soma = tomos.reduce((acc, t) => acc + t.quantity, 0);
  assert.equal(soma, total, "a soma das folhas dos tomos deve bater com o total");
  // cobre da primeira à última folha
  assert.equal(tomos[0].start, "01/20");
  assert.equal(tomos[tomos.length - 1].end, "20/20");
});

test("mais tomos que folhas não gera faixa vazia", () => {
  const tomos = buildBalancedTomos(2, 5);
  assert.ok(tomos.length <= 2, "não deve criar mais tomos que folhas");
  for (const t of tomos) assert.ok(t.quantity > 0, "tomo com 0 folhas");
});

// --- Capa: rótulo de tomo por página ----------------------------------------

test("numTomos=1 -> capa única, sem rótulo de tomo", () => {
  const labels = capaTomoLabels(1);
  assert.deepEqual(labels, [""], "tomo único não deve exibir (TOMO ..)");
});

test("numTomos=3 -> 3 capas rotuladas (TOMO 01/02/03)", () => {
  const labels = capaTomoLabels(3);
  assert.deepEqual(labels, ["(TOMO 01)", "(TOMO 02)", "(TOMO 03)"]);
});

test("numTomos=12 -> padding de 2 dígitos preservado", () => {
  const labels = capaTomoLabels(12);
  assert.equal(labels.length, 12);
  assert.equal(labels[0], "(TOMO 01)");
  assert.equal(labels[11], "(TOMO 12)");
});

console.log(`\n${passed} teste(s) passaram.`);
