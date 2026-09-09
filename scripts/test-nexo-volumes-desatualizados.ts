/**
 * O VOLUME QUE ENVELHECEU — a peça regerada depois dele o denuncia.
 * Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-volumes-desatualizados.ts
 *   (== npm run test:nexo:desatualizados)
 */
import assert from "node:assert/strict";

import {
  identidadeDoVolume,
  ordenarPartes,
  volumesDesatualizados,
} from "../modules/nexo/lib/volumes-desatualizados.ts";

const PDF = "application/pdf";

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

const volume = (
  tomo: number,
  partes: { id: string; em: number }[] | undefined,
  extras: Record<string, unknown> = {},
): any => ({
  artifactId: `vol:084-25${tomo > 0 ? `:t${tomo}` : ""}`,
  kind: "volume",
  generatedAt: 1000,
  payload: { tomo, folhas: "a|b", ...(partes ? { partes } : {}), conferencia: null },
  files: [{ name: "084_25_met_tomo2.pdf", mime: PDF, url: "blob:vol", primary: true }],
  ...extras,
});

const peca = (
  artifactId: string,
  kind: string,
  generatedAt: number,
  canvas?: Record<string, unknown>,
): any => ({
  artifactId,
  kind,
  generatedAt,
  summary: artifactId,
  ...(canvas ? { canvas } : {}),
  files: [{ name: `${artifactId}.pdf`, mime: PDF, url: `blob:${artifactId}`, primary: true }],
});

test("peça regerada DEPOIS do volume denuncia o volume", () => {
  const results = [
    volume(2, [{ id: "ld:1", em: 900 }]),
    peca("ld:1", "ld", 1500, { label: "LD METALÚRGICO", titulo: "METALÚRGICO" }),
  ];
  const velhos = volumesDesatualizados(results);
  assert.equal(velhos.length, 1);
  assert.equal(velhos[0].artifactId, "vol:084-25:t2");
  assert.equal(velhos[0].tomo, 2);
  assert.match(velhos[0].motivos[0], /LD METALÚRGICO/);
  assert.match(velhos[0].motivos[0], /depois/i);
});

test("peça com a mesma hora não denuncia nada", () => {
  const results = [
    volume(2, [{ id: "ld:1", em: 1500 }]),
    peca("ld:1", "ld", 1500, { label: "LD METALÚRGICO" }),
  ];
  assert.deepEqual(volumesDesatualizados(results), []);
});

test("peça mais VELHA que o registro não denuncia (não anda para trás)", () => {
  const results = [
    volume(2, [{ id: "ld:1", em: 1500 }]),
    peca("ld:1", "ld", 900, { label: "LD METALÚRGICO" }),
  ];
  assert.deepEqual(volumesDesatualizados(results), []);
});

test("peça que sumiu dos resultados denuncia, com motivo próprio", () => {
  const results = [volume(2, [{ id: "sep:1", em: 900 }])];
  const velhos = volumesDesatualizados(results);
  assert.equal(velhos.length, 1);
  assert.match(velhos[0].motivos[0], /não está mais/i);
});

test("volume legado (sem partes gravadas) NÃO grita", () => {
  const results = [
    volume(2, undefined),
    peca("ld:1", "ld", 9999, { label: "LD METALÚRGICO" }),
  ];
  assert.deepEqual(volumesDesatualizados(results), []);
});

test("sem generatedAt em algum dos lados, não há veredito", () => {
  const semHora = peca("ld:1", "ld", 0, { label: "LD METALÚRGICO" });
  delete semHora.generatedAt;
  assert.deepEqual(volumesDesatualizados([volume(2, [{ id: "ld:1", em: 900 }]), semHora]), []);
});

test("dois blocos: só a peça nova entra nos motivos", () => {
  const results = [
    volume(2, [
      { id: "ld:est", em: 900 },
      { id: "ld:hid", em: 900 },
      { id: "capa", em: 900 },
    ]),
    peca("ld:est", "ld", 900, { label: "LD ESTRUTURAL" }),
    peca("ld:hid", "ld", 1500, { label: "LD HIDROSSANITÁRIO" }),
    peca("capa", "capa", 900, { label: "Capa" }),
  ];
  const velhos = volumesDesatualizados(results);
  assert.equal(velhos.length, 1);
  assert.equal(velhos[0].motivos.length, 1);
  assert.match(velhos[0].motivos[0], /HIDROSSANITÁRIO/);
});

test("cada volume responde pelas SUAS partes", () => {
  const results = [
    volume(2, [{ id: "ld:t2", em: 900 }]),
    { ...volume(3, [{ id: "ld:t3", em: 900 }]), artifactId: "vol:084-25:t3" },
    peca("ld:t2", "ld", 1500, { label: "LD METALÚRGICO" }),
    peca("ld:t3", "ld", 900, { label: "LD METALÚRGICO" }),
  ];
  const velhos = volumesDesatualizados(results);
  assert.equal(velhos.length, 1);
  assert.equal(velhos[0].tomo, 2);
});

test("o rótulo leva tomo e o título da LD que está dentro", () => {
  const results = [
    volume(2, [{ id: "ld:1", em: 900 }]),
    peca("ld:1", "ld", 1500, { label: "LD METALÚRGICO", titulo: "METALÚRGICO" }),
  ];
  assert.equal(volumesDesatualizados(results)[0].rotulo, "TOMO 02 · METALÚRGICO");
});

test("volume indiviso (tomo 0) não inventa TOMO no rótulo", () => {
  const results = [
    volume(0, [{ id: "ld:1", em: 900 }]),
    peca("ld:1", "ld", 1500, { label: "LD METALÚRGICO", titulo: "METALÚRGICO" }),
  ];
  const velhos = volumesDesatualizados(results);
  assert.equal(velhos[0].rotulo, "Volume · METALÚRGICO");
  assert.equal(velhos[0].tomo, undefined);
});

test("os desatualizados saem em ordem de tomo", () => {
  const results = [
    { ...volume(3, [{ id: "ld:t3", em: 900 }]), artifactId: "vol:c:t3" },
    { ...volume(2, [{ id: "ld:t2", em: 900 }]), artifactId: "vol:c:t2" },
    peca("ld:t2", "ld", 1500, { label: "LD A" }),
    peca("ld:t3", "ld", 1500, { label: "LD A" }),
  ];
  assert.deepEqual(
    volumesDesatualizados(results).map((v) => v.tomo),
    [2, 3],
  );
});

test("ordenarPartes é estável: mesma lista, mesmo JSON", () => {
  const a = ordenarPartes([
    { id: "ld:hid", em: 2 },
    { id: "capa", em: 1 },
  ]);
  const b = ordenarPartes([
    { id: "capa", em: 1 },
    { id: "ld:hid", em: 2 },
  ]);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(a.map((p) => p.id), ["capa", "ld:hid"]);
});

test("ordenarPartes deduplica pelo id, guardando a hora MAIOR", () => {
  const partes = ordenarPartes([
    { id: "ld:1", em: 100 },
    { id: "ld:1", em: 300 },
  ]);
  assert.equal(partes.length, 1);
  assert.equal(partes[0].em, 300);
});

test("identidadeDoVolume deixa de fora o que RESULTOU do volume", () => {
  const gravado = {
    tomo: 2,
    folhas: "a|b",
    partes: [{ id: "ld:1", em: 900 }],
    conferencia: { status: "sem_problemas" },
  };
  assert.deepEqual(identidadeDoVolume(gravado), { tomo: 2, folhas: "a|b" });
  /*
   * A prova do defeito que isto conserta: o que o volume GRAVA e o que o card
   * COMPARA tinham de sair com o mesmo JSON, e não saíam -- `conferencia`
   * sobrava de um lado, e `estadoDoArtefato` compara literalmente.
   */
  assert.equal(
    JSON.stringify(identidadeDoVolume(gravado)),
    JSON.stringify({ tomo: 2, folhas: "a|b" }),
  );
});

test("identidadeDoVolume aguenta payload ausente", () => {
  assert.deepEqual(identidadeDoVolume(undefined), {
    tomo: undefined,
    folhas: undefined,
  });
});

console.log(`\n${passed} teste(s) do volume desatualizado: OK`);
