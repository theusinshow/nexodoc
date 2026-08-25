/**
 * QUAL PARECER ESTÁ NA TELA — e, portanto, sobre qual o chat responde.
 *
 * O caso que motiva: reauditar um memorial corrigido grava um artefato NOVO sem
 * apagar o anterior. Pegar o primeiro da lista devolvia o parecer velho, e o
 * chat responderia sobre uma revisão que não é a que o engenheiro está vendo —
 * duas telas afirmando coisas diferentes sobre o mesmo trabalho.
 *
 *   node scripts/test-chat-roteamento.ts  (== npm run test:chat:roteamento)
 */
import assert from "node:assert/strict";

import { auditoriaMaisRecente } from "../modules/nexo/lib/audit.ts";

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

const auditoria = (artifactId: string, auditId: string, generatedAt: number) => ({
  artifactId,
  kind: "auditoria",
  generatedAt,
  payload: { auditId, texto: "", report: { incongruencias: [], total_incongruencias: 0 } },
});

test("sem auditoria na conversa, devolve null", () => {
  assert.equal(auditoriaMaisRecente([]), null);
  assert.equal(auditoriaMaisRecente([{ artifactId: "a", kind: "ld", generatedAt: 1 }]), null);
});

test("com duas auditorias, vence a MAIS RECENTE, nao a primeira da lista", () => {
  const r = auditoriaMaisRecente([
    auditoria("art-velho", "aud-velho", 1000),
    auditoria("art-novo", "aud-novo", 2000),
  ]);
  assert.equal(r?.salvo.auditId, "aud-novo");
});

test("a ordem do vetor nao decide: quem decide e generatedAt", () => {
  const r = auditoriaMaisRecente([
    auditoria("art-novo", "aud-novo", 2000),
    auditoria("art-velho", "aud-velho", 1000),
  ]);
  assert.equal(r?.salvo.auditId, "aud-novo");
});

test("artefato sem generatedAt nao derruba a escolha", () => {
  const semData = { ...auditoria("art-x", "aud-x", 0), generatedAt: undefined };
  const r = auditoriaMaisRecente([semData, auditoria("art-y", "aud-y", 5)]);
  assert.equal(r?.salvo.auditId, "aud-y");
});

test("auditoria sem auditId ainda e devolvida (parecer local, sem banco)", () => {
  const semId = auditoria("art-l", "", 10);
  const r = auditoriaMaisRecente([semId]);
  assert.ok(r, "parecer local sumiu");
  assert.equal(r?.artifactId, "art-l");
});

console.log(`\n${passed} teste(s) de roteamento do chat OK`);
