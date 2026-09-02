/**
 * O NÚMERO DA FOLHA SAI DO NOME — e por uma regra só.
 *
 * `server/nexo/parse-filename.ts` tinha DUAS noções de "qual é a folha desta
 * prancha", e uma delas estava errada:
 *
 *   sheetNumberFromFilename   tira o código do projeto e pega o ÚLTIMO número
 *                             — é a que o fluxo de volume usa, e está certa;
 *   o campo `folha`           pegava o PRIMEIRO grupo de 3 dígitos, que num
 *                             nome `040_26_...` é sempre o CÓDIGO do projeto.
 *
 * Medido em 02/09/2026 contra os 654 PDFs de `docs/`: o campo estava errado em
 * 651 deles (99,5%). `040_26_his_001_a.pdf` reportava folha 40, não 1.
 *
 *   node scripts/test-parse-filename.ts   (== npm run test:parse-filename)
 */
import assert from "node:assert/strict";

import { parseFilename, sheetNumberFromFilename } from "../server/nexo/parse-filename.ts";

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

// --- A folha é a folha, não o código -----------------------------------------

test("a folha do 040-26 é 1..11, e não 40", () => {
  for (const n of [1, 2, 3, 11]) {
    const nome = `040_26_his_${String(n).padStart(3, "0")}_a.pdf`;
    assert.equal(parseFilename(nome).folha, String(n), nome);
  }
});

test("prancha do metálico: 004, não 088", () => {
  assert.equal(parseFilename("088_25_met_004.pdf").folha, "4");
});

test("nome sem número de folha não inventa um", () => {
  // `040_26_his_ld_a` é uma LD: não tem folha, e o código não pode virar uma.
  assert.equal(parseFilename("040_26_his_ld_a.pdf").folha, undefined);
  assert.equal(parseFilename("114_19_VOLUME ÚNICO.pdf").folha, undefined);
});

test("o campo `folha` concorda com `sheetNumberFromFilename` — é a mesma regra", () => {
  const nomes = [
    "040_26_his_001_a.pdf",
    "088_25_met_004.pdf",
    "125-23_top_001_A1.pdf",
    "040_26_his_ld_a.pdf",
    "114_19_VOLUME ÚNICO.pdf",
    "040_26_vol10_his_inc_spd_a.pdf",
    "040_26_est_tomo1.pdf",
  ];
  for (const nome of nomes) {
    const doCampo = parseFilename(nome).folha;
    const daFuncao = sheetNumberFromFilename(nome);
    assert.equal(
      doCampo,
      daFuncao == null ? undefined : String(daFuncao),
      `${nome}: campo=${doCampo} funcao=${daFuncao}`,
    );
  }
});

test("volume e tomo não emprestam o número deles para a folha", () => {
  // `vol10` e `tomo1` são recortes do ENTREGÁVEL, não numeração de prancha —
  // `sheetNumberFromFilename` já os removia, e agora o campo também.
  assert.equal(parseFilename("040_26_vol10_his_inc_spd_a.pdf").folha, undefined);
  assert.equal(parseFilename("040_26_est_tomo1.pdf").folha, undefined);
});

// --- O tipo, que a folha ajuda a decidir --------------------------------------

test("prancha com disciplina no nome continua prancha", () => {
  assert.equal(parseFilename("040_26_his_001_a.pdf").tipo, "prancha");
  assert.equal(parseFilename("088_25_met_004.pdf").tipo, "prancha");
});

test("LD sem número continua prancha, pela disciplina", () => {
  // A LD não tem folha; quem a mantém no fluxo de prancha é o `his` do nome.
  const p = parseFilename("040_26_his_ld_a.pdf");
  assert.equal(p.folha, undefined);
  assert.equal(p.tipo, "prancha");
});

test("memorial, capa, separatriz e volume não dependem da folha", () => {
  assert.equal(parseFilename("040_26_md_geral_a.pdf").tipo, "memorial");
  assert.equal(parseFilename("040_26_capa_vol10_his_a.pdf").tipo, "capa");
  assert.equal(parseFilename("040_26_separatriz_his_a.pdf").tipo, "separatriz");
});

/*
 * A ÚNICA MUDANÇA DE CLASSIFICAÇÃO, e ela é uma melhora.
 *
 * `114_19_VOLUME ÚNICO.pdf` é um MEMORIAL que virava "prancha" porque o 114 do
 * código passava por número de folha — foi assim que ele entrou no fluxo de
 * leitura de selo e teve as 31 páginas puladas em silêncio (02/09/2026).
 *
 * Ele continua NÃO sendo memorial: quem decide isso é `md`/`memorial` no nome, e
 * o roteamento por nome fica como está. Mas "outro" é o que ele é.
 */
test("o volume único do 114-19 deixa de ser chamado de prancha", () => {
  assert.equal(parseFilename("114_19_VOLUME ÚNICO.pdf").tipo, "outro");
});

console.log(`\n${passed} teste(s) de parse-filename OK`);
