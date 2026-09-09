/**
 * O NOME DA PASTA BAIXADA — centro de custo + disciplina + volume.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs scripts/test-nome-do-zip.ts
 *   (== npm run test:nome-do-zip)
 */
import assert from "node:assert/strict";

import { generateZipFileName } from "../modules/volume-builder/lib/volume/volume-naming.ts";
import type {
  AssemblyRow,
  VolumeMetadata,
} from "../modules/volume-builder/lib/volume/volume-types.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

function metadata(extra: Partial<VolumeMetadata> = {}): VolumeMetadata {
  return { projectCode: "084_25", projectName: "Ginasio", ...extra };
}

function linha(disciplinas: string[], id = "r1"): AssemblyRow {
  return {
    id,
    order: 1,
    title: "Volume",
    blocks: disciplinas.map((disciplineCode, i) => ({
      id: `${id}-b${i}`,
      title: disciplineCode,
      disciplineCode,
      separatorTitle: "SEPARATRIZ",
      documents: [],
      status: "sem_problemas" as const,
      warnings: [],
    })),
    outputFileName: "",
    status: "sem_problemas",
    warnings: [],
    requiresManualConfirmation: false,
  };
}

test("uma disciplina: o nome que o escritorio usa", () => {
  assert.equal(
    generateZipFileName(metadata({ volume: "12" }), [linha(["MET"])]),
    "084_25_met_vol_12.zip",
  );
});

test("volume misto lista as disciplinas na ordem em que aparecem", () => {
  assert.equal(
    generateZipFileName(metadata({ volume: "12" }), [
      linha(["MET", "ELE"], "r1"),
      linha(["HID", "ELE"], "r2"),
    ]),
    "084_25_met_ele_hid_vol_12.zip",
  );
});

test("volume vazio some do nome em vez de virar rotulo inventado", () => {
  assert.equal(
    generateZipFileName(metadata(), [linha(["MET"])]),
    "084_25_met.zip",
  );
});

test('"Volume 12" nao vira vol_volume_12', () => {
  assert.equal(
    generateZipFileName(metadata({ volume: "Volume 12" }), [linha(["MET"])]),
    "084_25_met_vol_12.zip",
  );
  assert.equal(
    generateZipFileName(metadata({ volume: "vol. 12" }), [linha(["MET"])]),
    "084_25_met_vol_12.zip",
  );
});

test("bloco sem disciplina nao entra no nome", () => {
  assert.equal(
    generateZipFileName(metadata({ volume: "12" }), [linha(["", "MET"])]),
    "084_25_met_vol_12.zip",
  );
});

test("sem disciplina e sem volume, o rotulo antigo segura o nome", () => {
  assert.equal(
    generateZipFileName(metadata(), [linha([""])]),
    "084_25_volumes_montados.zip",
  );
});

test("sem nada, ainda sai um nome legivel", () => {
  assert.equal(
    generateZipFileName({ projectCode: "", projectName: "" }, []),
    "volumes_montados.zip",
  );
});

console.log(`\n${passed} teste(s) do nome do zip: OK`);
