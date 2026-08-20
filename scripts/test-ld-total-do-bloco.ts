/**
 * O DENOMINADOR DA LD É O DO BLOCO, NÃO O DO VOLUME.
 *
 * Medido em 20/08/2026 no volume 10 de 040-26 (HIS 11 · INC 5 · SPD 4). A LD do
 * bloco SPDA saía numerando `01/20`, e o carimbo impresso na própria prancha diz
 * `01/04`. O gabarito do escritório diz `01/04`. A lista discordava do desenho
 * que ela lista — e num volume misto isso é o caso comum, não a exceção: 6 dos 8
 * volumes reais são mistos.
 *
 * `build-ld-proposal` já dizia a regra certa, para o caso do TOMO:
 *
 *   "`referenceTotal` NÃO muda — continua sendo o total do conjunto. O selo
 *    impresso na prancha diz '05/24', e a LD do tomo 1 tem que continuar dizendo
 *    isso; trocar para '05/12' faria a lista discordar do próprio desenho."
 *
 * A regra estava certa e a implementação a aplicava à população errada: o total
 * saía de `Math.max(dominantTotal, maxSheet, validos.length)` sobre TODOS os
 * selos, antes de `folhasDoTomo` filtrar. Num volume de uma disciplina só isso
 * dava no mesmo; num misto, `validos.length` é o volume inteiro e vence.
 *
 * Calcular sobre a SELEÇÃO honra os dois casos, porque quem manda é o carimbo:
 * as folhas do tomo 1 continuam trazendo `total: 24` no selo, e as do bloco SPDA
 * trazem `total: 4`.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs scripts/test-ld-total-do-bloco.ts
 *   (== npm run test:ld:total-do-bloco)
 */
import assert from "node:assert/strict";

import { buildLdProposal, type SeloForLd } from "../server/nexo/build-ld-proposal.ts";

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

/** Um selo de prancha como o leitor devolve: o carimbo diz folha E total. */
function selo(
  disciplina: string,
  folha: number,
  total: number,
  conteudo = `FOLHA ${folha}`,
): SeloForLd {
  const nome = `040_26_${disciplina}_${String(folha).padStart(3, "0")}_a`;
  return {
    fileName: `${nome}.pdf`,
    pageNumber: 1,
    arquivo: `${nome}.dwg`,
    disciplina: disciplina.toUpperCase(),
    folha,
    total,
    numeroFolha: `${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`,
    conteudo,
    obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ",
    cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ",
  } as SeloForLd;
}

const id = (s: SeloForLd) => `${s.fileName}#${s.pageNumber ?? "?"}`;

/** O volume 10 de 040-26, na proporção real. */
const HIS = Array.from({ length: 11 }, (_, i) => selo("his", i + 1, 11));
const INC = Array.from({ length: 5 }, (_, i) => selo("inc", i + 1, 5));
const SPD = Array.from({ length: 4 }, (_, i) => selo("spd", i + 1, 4));
const VOLUME = [...HIS, ...INC, ...SPD];

const denominadores = (rows: readonly { sheet: string }[]) =>
  [...new Set(rows.map((r) => r.sheet.split("/")[1]))];

test("o bloco SPDA numera pelo carimbo dele, não pelo volume", () => {
  const ld = buildLdProposal(VOLUME, {
    folhasDoTomo: SPD.map(id),
    respeitarOrdem: true,
  });
  assert.equal(ld.input.rows.length, 4);
  assert.deepEqual(denominadores(ld.input.rows), ["04"]);
  assert.equal(ld.input.rows[0].sheet, "01/04");
});

test("o bloco hidrossanitário do mesmo volume numera /11", () => {
  const ld = buildLdProposal(VOLUME, {
    folhasDoTomo: HIS.map(id),
    respeitarOrdem: true,
  });
  assert.equal(ld.input.rows.length, 11);
  assert.deepEqual(denominadores(ld.input.rows), ["11"]);
});

test("o bloco preventivo do mesmo volume numera /05", () => {
  const ld = buildLdProposal(VOLUME, {
    folhasDoTomo: INC.map(id),
    respeitarOrdem: true,
  });
  assert.deepEqual(denominadores(ld.input.rows), ["05"]);
});

/*
 * A REGRA DO TOMO NÃO PODE REGREDIR. Uma disciplina só, 24 pranchas, partida em
 * dois tomos: a LD do tomo 1 lista 12 linhas e continua dizendo /24, porque é o
 * que está impresso na prancha.
 */
test("tomo de uma disciplina só continua dizendo o total do conjunto", () => {
  const est = Array.from({ length: 24 }, (_, i) => selo("est", i + 1, 24));
  const tomo1 = buildLdProposal(est, {
    folhasDoTomo: est.slice(0, 12).map(id),
    respeitarOrdem: true,
  });
  assert.equal(tomo1.input.rows.length, 12);
  assert.deepEqual(denominadores(tomo1.input.rows), ["24"]);
  assert.equal(tomo1.input.rows[0].sheet, "01/24");

  const tomo2 = buildLdProposal(est, {
    folhasDoTomo: est.slice(12).map(id),
    respeitarOrdem: true,
  });
  assert.deepEqual(denominadores(tomo2.input.rows), ["24"]);
  assert.equal(tomo2.input.rows[0].sheet, "13/24");
});

/*
 * SEM FATIA, NADA MUDA: o volume de disciplina única continua contando o
 * conjunto inteiro. É o caminho de sempre, e ele não pode ter mexido.
 */
test("sem fatia, o total continua sendo o do conjunto", () => {
  const ld = buildLdProposal(HIS, { respeitarOrdem: true });
  assert.equal(ld.input.rows.length, 11);
  assert.deepEqual(denominadores(ld.input.rows), ["11"]);
});

/*
 * O TOTAL DECLARADO PELO ENGENHEIRO VENCE. A precedência já existia
 * (`totalDeReferencia`), e mexer na população não pode tê-la afrouxado.
 */
test("referenceTotal declarado vence o carimbo", () => {
  const ld = buildLdProposal(VOLUME, {
    folhasDoTomo: SPD.map(id),
    respeitarOrdem: true,
    referenceTotal: 9,
  });
  assert.deepEqual(denominadores(ld.input.rows), ["09"]);
});

/*
 * CARIMBO MAL LIDO NÃO ENCOLHE A LISTA. Se um selo do bloco vier com total
 * menor que o número de folhas que a LD lista, quem manda é a contagem — a
 * alternativa seria imprimir "05/04", que é uma lista que se contradiz.
 */
test("total do carimbo menor que a contagem não vale", () => {
  const capenga = [selo("spd", 1, 2), selo("spd", 2, 2), selo("spd", 3, 2), selo("spd", 4, 2)];
  const ld = buildLdProposal(capenga, { respeitarOrdem: true });
  assert.deepEqual(denominadores(ld.input.rows), ["04"]);
});

console.log(`\n${passed} teste(s) passaram.`);
