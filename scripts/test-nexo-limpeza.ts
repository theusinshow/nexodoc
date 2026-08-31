/**
 * O QUE A LIMPEZA GUIADA PODE OFERECER — e o que ela nunca oferece.
 *
 * A regra que, errada, sugere apagar trabalho bom. Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-limpeza.ts   (== npm run test:nexo:limpeza)
 */
import assert from "node:assert/strict";

import {
  candidatasDaPasta,
  type ConversaDaPasta,
} from "../modules/nexo/lib/conversas-superadas.ts";

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

const c = (
  id: string,
  updatedAt: number,
  kinds: string[],
  extra: Partial<ConversaDaPasta> = {},
): ConversaDaPasta => ({ id, title: "MET", updatedAt, kinds, ...extra });

const ids = (lista: { id: string }[]) => lista.map((x) => x.id).sort();

// ------------------------------------------------------------- o caso real

test("as quatro MET: as três velhas são superadas, a mais nova fica", () => {
  /*
   * O caso que motivou tudo (`088-25-CRICIUMA`, 31/08/2026): quatro conversas
   * "MET" do mesmo volume, distinguíveis só pelo horário.
   */
  const pasta = [
    c("t1", 1000, ["ld", "capa", "volume"]),
    c("t2", 2000, ["ld", "capa", "volume"]),
    c("t3", 3000, ["ld", "capa", "volume"]),
    c("t4", 4000, ["ld", "capa", "volume"]),
  ];
  const r = candidatasDaPasta(pasta);
  assert.deepEqual(ids(r), ["t1", "t2", "t3"]);
  assert.ok(!r.some((x) => x.id === "t4"), "a mais nova NUNCA é oferecida");
  assert.equal(r[0].motivo, "superada");
  assert.equal(r[0].superadaPor?.id, "t4");
});

// ------------------------------------------------------- as portas fechadas

test("a conversa ABERTA nunca é candidata", () => {
  const pasta = [c("velha", 1000, ["ld"]), c("nova", 2000, ["ld"])];
  assert.deepEqual(ids(candidatasDaPasta(pasta, { idAberta: "velha" })), []);
});

test("conversa com AUDITORIA EM VOO nunca é candidata", () => {
  const pasta = [
    c("rodando", 1000, ["ld"], { auditoriaPendente: true }),
    c("nova", 2000, ["ld", "capa"]),
  ];
  assert.deepEqual(ids(candidatasDaPasta(pasta)), []);
});

test("a mais nova de cada grupo nunca é superada", () => {
  const pasta = [c("a", 1000, ["ld"]), c("b", 2000, ["ld"])];
  const r = candidatasDaPasta(pasta);
  assert.deepEqual(ids(r), ["a"]);
});

// ------------------------------------------ o que NÃO é superada de verdade

test("quem produziu MAIS que a mais nova NÃO é superada", () => {
  /*
   * A guarda que importa: a conversa velha chegou a montar o volume, a nova
   * parou na LD. Oferecê-la apagaria o único volume da pasta.
   */
  const pasta = [
    c("completa", 1000, ["ld", "capa", "volume"]),
    c("incompleta", 2000, ["ld"]),
  ];
  assert.deepEqual(ids(candidatasDaPasta(pasta)), []);
});

test("basta ALGUMA mais nova conter tudo — não precisa ser a última", () => {
  /*
   * Num grupo de três, a do meio pode ter o volume que a última não tem.
   * Exigir que a campeã fosse sempre a última deixaria de fora o caso real.
   */
  const pasta = [
    c("velha", 1000, ["ld", "volume"]),
    c("meio", 2000, ["ld", "capa", "volume"]),
    c("ultima", 3000, ["ld"]),
  ];
  const r = candidatasDaPasta(pasta);
  assert.deepEqual(ids(r), ["velha"]);
  assert.equal(r[0].superadaPor?.id, "meio");
});

// ------------------------------------------------------- as sem artefato

test("conversa sem artefato nenhum é oferecida, mesmo sendo a mais nova", () => {
  // É o que limpa as dezessete "Nova conversa": nada a perder.
  const pasta = [c("vazia", 5000, [])];
  const r = candidatasDaPasta(pasta);
  assert.deepEqual(ids(r), ["vazia"]);
  assert.equal(r[0].motivo, "sem-artefato");
});

test("mas a vazia ABERTA continua fora — é onde a pessoa está", () => {
  const pasta = [c("vazia", 5000, [])];
  assert.deepEqual(ids(candidatasDaPasta(pasta, { idAberta: "vazia" })), []);
});

// ------------------------------------------------------------- agrupamento

test("disciplinas DIFERENTES não se superam", () => {
  const pasta = [
    { id: "met", title: "MET", updatedAt: 1000, kinds: ["ld"] },
    { id: "est", title: "EST", updatedAt: 2000, kinds: ["ld", "capa"] },
  ];
  assert.deepEqual(ids(candidatasDaPasta(pasta)), []);
});

test("caixa e acento não separam o grupo", () => {
  const pasta = [
    { id: "a", title: "Met", updatedAt: 1000, kinds: ["ld"] },
    { id: "b", title: "MET", updatedAt: 2000, kinds: ["ld"] },
  ];
  assert.deepEqual(ids(candidatasDaPasta(pasta)), ["a"]);
});

test("a lista vem da mais velha para a mais nova", () => {
  const pasta = [
    c("a", 1000, ["ld"]),
    c("b", 2000, ["ld"]),
    c("d", 4000, ["ld"]),
    c("c", 3000, ["ld"]),
  ];
  assert.deepEqual(
    candidatasDaPasta(pasta).map((x) => x.id),
    ["a", "b", "c"],
  );
});

test("pasta com uma conversa só não oferece nada", () => {
  assert.deepEqual(candidatasDaPasta([c("unica", 1000, ["ld", "volume"])]), []);
});

console.log(`\n${passed} teste(s) ok`);
