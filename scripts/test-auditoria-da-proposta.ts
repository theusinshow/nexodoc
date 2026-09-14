/**
 * Teste da AUDITORIA DA PROPOSTA — cada rodada com o próprio resultado.
 *
 * Em 14/09/2026 o 117_25 foi auditado de novo na mesma conversa e o fluxo
 * desmoronou. O resultado da auditoria tinha id fixo por documento
 * (`auditoria:117-25`), então:
 * - o cartão novo achava o parecer antigo e escondia o formulário;
 * - a detecção das folhas mudas e a comparação ficavam desligadas;
 * - o parecer novo sobrescrevia o anterior.
 *
 *   node scripts/test-auditoria-da-proposta.ts
 */
import assert from "node:assert/strict";

import {
  idDaAuditoriaDaProposta,
  migrarAuditoriasLegadas,
  pedeNovaAuditoria,
} from "../modules/nexo/lib/auditoria-da-proposta.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const proposta = (id: string) => ({ id, role: "assistant", proposals: [{ kind: "auditoria" }] });
const fala = (id: string) => ({ id, role: "user" });
const parecer = (artifactId: string, auditId: string, generatedAt: number) => ({
  artifactId,
  kind: "auditoria",
  generatedAt,
  payload: { auditId },
});

test("duas propostas do mesmo documento têm ids diferentes", () => {
  assert.notEqual(idDaAuditoriaDaProposta("117-25", "m1"), idDaAuditoriaDaProposta("117-25", "m2"));
  assert.equal(idDaAuditoriaDaProposta("117-25", "m1"), "auditoria:117-25:m1");
  assert.equal(idDaAuditoriaDaProposta(null, "m1"), "auditoria:x:m1");
});

test("o parecer antigo vai para a ÚLTIMA proposta de auditoria", () => {
  // A conversa real: duas propostas, um resultado só (o segundo sobrescreveu).
  const r = migrarAuditoriasLegadas({
    messages: [fala("u1"), proposta("p1"), fala("u2"), proposta("p2")],
    results: [parecer("auditoria:117-25", "e893", 2)],
    auditorias: [
      { auditId: "c353", artifactId: "auditoria:117-25" },
      { auditId: "e893", artifactId: "auditoria:117-25" },
    ],
  });
  assert.equal(r.migrou, true);
  assert.equal(r.results[0].artifactId, "auditoria:117-25:p2");
  assert.deepEqual(
    r.auditorias?.find((a) => a.auditId === "e893"),
    { auditId: "e893", artifactId: "auditoria:117-25:p2" },
  );
});

test("a rodada sobrescrita volta para a proposta anterior, e pode ser recuperada", () => {
  const r = migrarAuditoriasLegadas({
    messages: [proposta("p1"), proposta("p2")],
    results: [parecer("auditoria:117-25", "e893", 2)],
    auditorias: [
      { auditId: "c353", artifactId: "auditoria:117-25" },
      { auditId: "e893", artifactId: "auditoria:117-25" },
    ],
  });
  // c353 não tem resultado: fica com a proposta p1, e a recuperação pelo
  // servidor (`parecerARecuperar`) passa a enxergar que falta o artefato dela.
  assert.deepEqual(
    r.auditorias?.find((a) => a.auditId === "c353"),
    { auditId: "c353", artifactId: "auditoria:117-25:p1" },
  );
});

test("documentos diferentes na mesma conversa casam de trás para frente", () => {
  const r = migrarAuditoriasLegadas({
    messages: [proposta("p114"), proposta("p117")],
    results: [parecer("auditoria:114-19", "a1", 1), parecer("auditoria:117-25", "a2", 2)],
    auditorias: [],
  });
  assert.deepEqual(
    r.results.map((x) => x.artifactId),
    ["auditoria:114-19:p114", "auditoria:117-25:p117"],
  );
});

test("parecer aberto por link (id = auditId) não é tocado", () => {
  const r = migrarAuditoriasLegadas({
    messages: [proposta("p1")],
    results: [parecer("auditoria:abc-123-uuid", "abc-123-uuid", 1)],
    auditorias: [],
  });
  assert.equal(r.migrou, false);
  assert.equal(r.results[0].artifactId, "auditoria:abc-123-uuid");
});

test("conversa já migrada fica como está", () => {
  const r = migrarAuditoriasLegadas({
    messages: [proposta("p1")],
    results: [parecer("auditoria:117-25:p1", "a1", 1)],
    auditorias: [{ auditId: "a1", artifactId: "auditoria:117-25:p1" }],
  });
  assert.equal(r.migrou, false);
});

test("sem proposta na conversa não há a quem entregar: nada muda", () => {
  const r = migrarAuditoriasLegadas({
    messages: [fala("u1")],
    results: [parecer("auditoria:117-25", "a1", 1)],
    auditorias: [],
  });
  assert.equal(r.migrou, false);
});

test("bilhete de auditoria em voo segue o parecer da mesma proposta", () => {
  const r = migrarAuditoriasLegadas({
    messages: [proposta("p1")],
    results: [],
    auditorias: [{ auditId: "a9", artifactId: "auditoria:117-25" }],
    auditoriaPendente: { auditId: "a9", artifactId: "auditoria:117-25" },
  });
  assert.equal(r.auditoriaPendente?.artifactId, "auditoria:117-25:p1");
  assert.equal(r.auditorias?.[0].artifactId, "auditoria:117-25:p1");
});

test("parecer apagado de propósito segue apagado com o id novo", () => {
  const r = migrarAuditoriasLegadas({
    messages: [proposta("p1")],
    results: [],
    auditorias: [{ auditId: "a1", artifactId: "auditoria:117-25" }],
    artefatosApagados: ["auditoria:117-25"],
  });
  assert.ok(r.artefatosApagados?.includes("auditoria:117-25:p1"));
});

test("pedido de auditar vai ao Nexo; pergunta sobre o parecer não", () => {
  for (const t of [
    "audita o memorial",
    "Auditar o memorial",
    "audite de novo",
    "reauditar",
    "roda a auditoria de novo",
    "rode a auditoria novamente",
    "faz uma nova auditoria",
    "transcrever e auditar",
    "quero auditar esse memorial de novo",
    "Audite o memorial, por favor",
    "faça uma nova auditoria",
  ]) {
    assert.equal(pedeNovaAuditoria(t), true, t);
  }
  for (const t of [
    "por que a auditoria deu só 10 achados?",
    "o que a auditoria achou na página 12?",
    "explica o INC-003",
    "essa auditoria está certa?",
  ]) {
    assert.equal(pedeNovaAuditoria(t), false, t);
  }
});

console.log(`\n${passed} teste(s) passaram`);
