/**
 * Smoke-test do "baixar todos os volumes". Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-volumes-prontos.ts
 */
import assert from "node:assert/strict";

import {
  todosOsVolumesProntos,
  volumesProntosDosResultados,
} from "../modules/nexo/lib/volumes-prontos.ts";

const PDF = "application/pdf";
const ODT = "application/vnd.oasis.opendocument.text";

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

const volume = (tomo: number, nome: string, extras: any[] = []): any => ({
  kind: "volume",
  payload: { tomo },
  files: [{ label: "PDF do volume", name: nome, mime: PDF, url: `blob:${nome}`, primary: true }, ...extras],
});

test("pega só os volumes, ignorando capa e LD", () => {
  const results = [
    volume(1, "063_26_vol01_a.pdf"),
    { kind: "capa", files: [{ name: "capa.pdf", mime: PDF, url: "blob:capa", primary: true }] } as any,
    { kind: "ld", files: [{ name: "ld.odt", mime: ODT, url: "blob:ld" }] } as any,
  ];
  const prontos = volumesProntosDosResultados(results);
  assert.equal(prontos.length, 1);
  assert.equal(prontos[0].nome, "063_26_vol01_a.pdf");
});

test("ordena por tomo, não pela ordem de montagem", () => {
  const prontos = volumesProntosDosResultados([
    volume(3, "c.pdf"),
    volume(1, "a.pdf"),
    volume(2, "b.pdf"),
  ]);
  assert.deepEqual(prontos.map((v) => v.nome), ["a.pdf", "b.pdf", "c.pdf"]);
});

test("nome repetido não some do ZIP — desempata pelo tomo", () => {
  // Dois tomos gerando o mesmo nome apagariam um arquivo em silêncio.
  const prontos = volumesProntosDosResultados([volume(1, "volume.pdf"), volume(2, "volume.pdf")]);
  assert.deepEqual(prontos.map((v) => v.nome), ["volume.pdf", "tomo-02-volume.pdf"]);
});

test("volume sem PDF não entra", () => {
  const semPdf: any = { kind: "volume", payload: { tomo: 1 }, files: [{ name: "x.odt", mime: ODT, url: "blob:x" }] };
  assert.equal(volumesProntosDosResultados([semPdf]).length, 0);
});

test("conjunto incompleto NÃO libera o download", () => {
  const prontos = volumesProntosDosResultados([volume(1, "a.pdf"), volume(2, "b.pdf")]);
  assert.equal(todosOsVolumesProntos(prontos, 6), false, "4 tomos faltando não pode liberar");
  assert.equal(todosOsVolumesProntos(prontos, 2), true);
});

test("sem tomos planejados, nada libera", () => {
  assert.equal(todosOsVolumesProntos([], 0), false);
});

console.log(`\n${passed} testes ok`);
