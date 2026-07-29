/**
 * Teste da IDENTIDADE de exibição de uma auditoria no histórico.
 *
 * O Nexo não enviava título nem projeto, e como virou o único caminho, dezenas
 * de auditorias foram gravadas anônimas — o painel listava "Auditoria sem
 * identificação" repetido, inútil para achar qualquer coisa. O envio já foi
 * corrigido; estas regras recuperam o que já está gravado, sem tocar no banco.
 *
 *   node scripts/test-audit-identity.ts   (== npm run test:audit-identity)
 */
import assert from "node:assert/strict";

import { projetoDaAuditoria, tituloDaAuditoria } from "../lib/audit-identity.ts";

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

const REPORT = {
  obra: "Centro Comunitário Primeira Linha",
  arquivos_analisados: [{ arquivo: "017_26_md_geral_c.pdf" }],
};

test("o que foi DECLARADO vence o que foi lido", () => {
  // O título enviado na chamada é escolha de quem pediu a auditoria; derivar
  // por cima disso seria o sistema achando que sabe mais que o usuário.
  const t = tituloDaAuditoria({ title: "Auditoria de recebimento", report: REPORT });
  assert.equal(t, "Auditoria de recebimento");
});

test("sem título, usa a obra do relatório", () => {
  assert.equal(tituloDaAuditoria({ report: REPORT }), "Centro Comunitário Primeira Linha");
});

test("sem obra, o nome do arquivo ainda é melhor que nada", () => {
  const t = tituloDaAuditoria({
    report: { arquivos_analisados: [{ arquivo: "040_26_md.pdf" }] },
  });
  assert.equal(t, "040_26_md.pdf");
});

test("auditoria que FALHOU se identifica pelo arquivo enviado", () => {
  /*
   * Falha acontece antes de existir relatório: não há obra para derivar. Mas os
   * arquivos enviados ficam gravados — e falha é exatamente o que o
   * administrador mais precisa achar na lista.
   */
  const t = tituloDaAuditoria({
    title: "Auditoria sem identificação",
    report: null,
    files: [{ fileName: "017_26_md_geral_c.pdf" }],
  });
  assert.equal(t, "017_26_md_geral_c.pdf");
});

test("sem nada, devolve o rótulo genérico — nunca vazio", () => {
  assert.equal(tituloDaAuditoria({}), "Auditoria sem identificação");
  assert.equal(projetoDaAuditoria({}), "Projeto não informado");
});

test("o PLACEHOLDER gravado no banco conta como ausente", () => {
  /*
   * `audit-persistence` grava "Auditoria sem identificação" quando não recebe
   * título — o marcador de ausência virou dado. Sem reconhecê-lo, a derivação
   * nunca dispara e o histórico continua uma lista de linhas iguais.
   */
  const t = tituloDaAuditoria({ title: "Auditoria sem identificação", report: REPORT });
  assert.equal(t, "Centro Comunitário Primeira Linha");
  const p = projetoDaAuditoria({ projectName: "Projeto não informado", report: REPORT });
  assert.equal(p, "Centro Comunitário Primeira Linha");
});

test("título só de espaços conta como ausente", () => {
  assert.equal(tituloDaAuditoria({ title: "   ", report: REPORT }), "Centro Comunitário Primeira Linha");
});

test("relatório corrompido não derruba a listagem", () => {
  // Um `report` com formato inesperado não pode explodir o painel inteiro —
  // é dado antigo, gravado por versões diferentes do motor.
  for (const lixo of [null, "texto", 42, [], { arquivos_analisados: "nao-array" }]) {
    assert.equal(tituloDaAuditoria({ report: lixo }), "Auditoria sem identificação");
  }
});

test("o projeto segue a mesma escada", () => {
  assert.equal(projetoDaAuditoria({ projectName: "Obra X", report: REPORT }), "Obra X");
  assert.equal(projetoDaAuditoria({ report: REPORT }), "Centro Comunitário Primeira Linha");
});

console.log(`\n${passed} teste(s) de identidade OK`);
