/**
 * A BASE DA REAUDITORIA FORA DA CONVERSA.
 *
 * Corrigir os erros do memorial e voltar numa conversa nova — que é o que se faz
 * depois de mexer no documento — relia 100% dele: a base era sempre a última
 * auditoria DA CONVERSA ATUAL, e o motor de reuso ficava parado.
 *
 *   node scripts/test-base-anterior.ts   (== npm run test:base-anterior)
 */
import assert from "node:assert/strict";

import { MAX_CANDIDATAS, candidatasParaBase } from "../lib/base-anterior.ts";

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

const c = (auditId: string, quando: string, ...arquivos: string[]) => ({
  auditId,
  arquivos,
  quando,
});

test("acha o mesmo memorial na revisão seguinte", () => {
  const r = candidatasParaBase(
    [c("a1", "2026-08-28T14:32:00Z", "040_26_md_geral_a.pdf")],
    "040_26_md_geral_b.pdf",
  );
  assert.deepEqual(r.map((x) => x.auditId), ["a1"]);
});

test("acha a via assinada, com os nomes de quem assinou colados", () => {
  const r = candidatasParaBase(
    [c("a1", "2026-08-28T14:32:00Z", "040_26_md_geral_a.pdf")],
    "040_26_md_geral_a_clau_chris_Rama_Rafa_assinado.pdf",
  );
  assert.deepEqual(r.map((x) => x.auditId), ["a1"]);
});

test("a MAIS RECENTE vem primeiro, e a ordem não vem do banco", () => {
  // De propósito fora de ordem na entrada: uma ordenação que só existisse na
  // cláusula SQL não seria exercitada por teste nenhum.
  const r = candidatasParaBase(
    [
      c("velha", "2026-08-01T10:00:00Z", "040_26_md_geral_a.pdf"),
      c("nova", "2026-08-28T14:32:00Z", "040_26_md_geral_b.pdf"),
      c("meio", "2026-08-15T09:00:00Z", "040_26_md_geral_a.pdf"),
    ],
    "040_26_md_geral_c.pdf",
  );
  assert.deepEqual(r.map((x) => x.auditId), ["nova", "meio", "velha"]);
});

test("OUTRO memorial do mesmo projeto não entra", () => {
  // `116_25_md_geral` e `116_25_md_ter_pav` convivem no mesmo projeto e são
  // peças diferentes: herdar de uma para a outra contaminaria a fila.
  const r = candidatasParaBase(
    [c("a1", "2026-08-28T14:32:00Z", "116_25_md_geral_b.pdf")],
    "116_25_md_ter_pav.pdf",
  );
  assert.deepEqual(r, []);
});

test("auditoria de VÁRIOS arquivos entra se UM deles for o documento", () => {
  const r = candidatasParaBase(
    [c("a1", "2026-08-28T14:32:00Z", "116_25_md_ter_pav.pdf", "040_26_md_geral_a.pdf")],
    "040_26_md_geral_b.pdf",
  );
  assert.deepEqual(r.map((x) => x.auditId), ["a1"]);
});

test("nenhuma candidata quando não há histórico do documento", () => {
  assert.deepEqual(candidatasParaBase([], "040_26_md_geral_a.pdf"), []);
  assert.deepEqual(
    candidatasParaBase([c("a1", "2026-08-28T14:32:00Z", "outro_projeto_md_a.pdf")], "040_26_md_geral_a.pdf"),
    [],
  );
});

test("nome sem chave nenhuma não casa com tudo", () => {
  // Um nome que normaliza para "" casaria com qualquer coisa se a guarda
  // sumisse — e a base errada é pior que base nenhuma.
  assert.deepEqual(candidatasParaBase([c("a1", "2026-08-28T14:32:00Z", "a.pdf")], "b.pdf"), []);
});

test("o teto de candidatas segura o custo da busca", () => {
  // Cada candidata devolvida custa carregar um `report` para o portão testar.
  const muitas = Array.from({ length: 12 }, (_, i) =>
    c(`a${i}`, `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00Z`, "040_26_md_geral_a.pdf"),
  );
  const r = candidatasParaBase(muitas, "040_26_md_geral_b.pdf");
  assert.equal(r.length, MAX_CANDIDATAS);
  // E são as MAIS RECENTES que sobraram, não as primeiras da lista.
  assert.equal(r[0].auditId, "a11");
});

console.log(`\n${passed} teste(s) de base anterior OK`);
