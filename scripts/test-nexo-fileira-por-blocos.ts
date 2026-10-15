/**
 * A fileira do canvas na ORDEM DO VOLUME (15/10/2026): capa → (separatriz → LD
 * → pranchas) por bloco → volume. O caso real: 6 pranchas EST + 1 HID, e o
 * canvas desenhava as duas separatrizes juntas, as duas LDs juntas e as sete
 * pranchas numa grade só.
 *
 *   node scripts/test-nexo-fileira-por-blocos.ts   (== npm run test:nexo:fileira-por-blocos)
 */
import assert from "node:assert/strict";

import { codigoDoBlocoDoArtefato, fileiraPorBlocos } from "../modules/nexo/lib/fileira-por-blocos.ts";
import type { Folha } from "../modules/nexo/lib/folhas.ts";

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

const folha = (id: string, disc: string) => ({ id, disc }) as unknown as Folha;
const codigo = (f: Folha) => (f as unknown as { disc: string }).disc;
const item = (id: string, rank: number) => ({ id, rank });

test("id do artefato → código do bloco", () => {
  assert.equal(codigoDoBlocoDoArtefato("ld:139-26:R00:est"), "est");
  assert.equal(codigoDoBlocoDoArtefato("ld:139-26:x:hid:t02"), "hid");
  assert.equal(codigoDoBlocoDoArtefato("separatriz:139-26:hid"), "hid");
  assert.equal(codigoDoBlocoDoArtefato("separatriz:139-26:sem"), "");
  // Documento do volume inteiro (uma disciplina só): não tem bloco. A revisão
  // "x" da LD não pode ser lida como código.
  assert.equal(codigoDoBlocoDoArtefato("ld:139-26:x"), null);
  assert.equal(codigoDoBlocoDoArtefato("separatriz:139-26"), null);
  assert.equal(codigoDoBlocoDoArtefato("capa:139-26"), null);
});

test("EST + HID: cada bloco leva a SUA separatriz, a SUA LD e as SUAS pranchas", () => {
  const itens = [
    item("capa:139-26", 0),
    item("separatriz:139-26:est", 1),
    item("separatriz:139-26:hid", 1),
    item("ld:139-26:x:est", 2),
    item("ld:139-26:x:hid", 2),
    item("volume:139-26", 9),
  ];
  const folhas = [1, 2, 3, 4, 5, 6].map((n) => folha(`e${n}`, "est")).concat(folha("h1", "hid"));
  const r = fileiraPorBlocos(itens, folhas, codigo, 3);
  assert.deepEqual(r.antes.map((i) => i.id), ["capa:139-26"]);
  assert.deepEqual(
    r.blocos.map((b) => ({ codigo: b.codigo, docs: b.documentos.map((d) => d.id), folhas: b.folhas.map((f) => f.id) })),
    [
      { codigo: "est", docs: ["separatriz:139-26:est", "ld:139-26:x:est"], folhas: ["e1", "e2", "e3", "e4", "e5", "e6"] },
      { codigo: "hid", docs: ["separatriz:139-26:hid", "ld:139-26:x:hid"], folhas: ["h1"] },
    ],
  );
  assert.deepEqual(r.depois.map((i) => i.id), ["volume:139-26"]);
});

test("bloco único: tudo num segmento sem código, como sempre foi", () => {
  const itens = [item("capa:1", 0), item("separatriz:1", 1), item("ld:1:x", 2), item("volume:1", 9)];
  const r = fileiraPorBlocos(itens, [folha("a", "arq"), folha("b", "arq")], codigo, 3);
  assert.equal(r.blocos.length, 1);
  assert.equal(r.blocos[0].codigo, null);
  assert.deepEqual(r.blocos[0].documentos.map((d) => d.id), ["separatriz:1", "ld:1:x"]);
});

test("bloco que perdeu todas as pranchas continua na fileira (destino para elas voltarem)", () => {
  const itens = [item("capa:1", 0), item("separatriz:1:est", 1), item("separatriz:1:hid", 1), item("ld:1:x:est", 2), item("ld:1:x:hid", 2)];
  const r = fileiraPorBlocos(itens, [folha("e1", "est"), folha("h1", "est")], codigo, 3);
  assert.deepEqual(r.blocos.map((b) => [b.codigo, b.folhas.length, b.documentos.length]), [["est", 2, 2], ["hid", 0, 2]]);
});

test("folhas sem disciplina ficam num bloco próprio, por último", () => {
  const r = fileiraPorBlocos([], [folha("x", ""), folha("e", "est"), folha("h", "hid")], codigo, 3);
  assert.deepEqual(r.blocos.map((b) => b.codigo), ["est", "hid", ""]);
});

console.log(`\n${passed} teste(s) da fileira por blocos OK`);
