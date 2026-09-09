/**
 * O NOME DO ZIP do conjunto de volumes — centro de custo + disciplina + volume.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs scripts/test-nexo-nome-do-zip.ts
 *   (== npm run test:nexo:nome-do-zip)
 */
import assert from "node:assert/strict";

import { nomeDoZipDosVolumes } from "../modules/nexo/lib/nome-do-volume.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const folha = (disciplina: string, codigo = "084-25"): any => ({
  // O nome do arquivo carrega a sigla, como nos projetos reais -- e o carimbo
  // repete a disciplina por extenso.
  fileName: "084_25_met_001_a.pdf",
  pageNumber: 1,
  codigo,
  disciplina,
  revisao: "R00",
  obra: "Ginasio",
});

test("o nome que o escritorio usa", () => {
  assert.equal(
    nomeDoZipDosVolumes([folha("Estrutura metálica")], { codigo: "084-25" }, "12"),
    "084_25_met_vol_12.zip",
  );
});

test('"Volume 12" nao vira vol_volume_12', () => {
  assert.equal(
    nomeDoZipDosVolumes([folha("Estrutura metálica")], { codigo: "084-25" }, "Volume 12"),
    "084_25_met_vol_12.zip",
  );
});

test("sem volume declarado, o trecho nao entra", () => {
  assert.equal(
    nomeDoZipDosVolumes([folha("Estrutura metálica")], { codigo: "084-25" }, ""),
    "084_25_met.zip",
  );
  assert.equal(
    nomeDoZipDosVolumes([folha("Estrutura metálica")], { codigo: "084-25" }, undefined),
    "084_25_met.zip",
  );
});

test("o codigo corrigido a mao vence o do carimbo", () => {
  assert.equal(
    nomeDoZipDosVolumes([folha("Estrutura metálica", "999-99")], { codigo: "084-25" }, "12"),
    "084_25_met_vol_12.zip",
  );
});

test("sem nada, cai no rotulo antigo em vez de sair um zip sem nome", () => {
  assert.equal(nomeDoZipDosVolumes([], {}, ""), "volumes-montados.zip");
});

console.log(`\n${passed} teste(s) do nome do zip do conjunto: OK`);
