/**
 * A auditoria em curso reduzida a UMA LINHA, para a barra do topo.
 *
 * O painel do palco mostra a lista inteira de etapas; a barra tem uma linha e
 * precisa escolher. Escolhe a primeira não concluída — a que está acontecendo.
 * Antes do primeiro marco não há etapa nenhuma, e a barra diz que está enviando
 * em vez de inventar uma etapa que o motor não anunciou.
 *
 * Os rótulos NÃO são escritos aqui: vêm de `NOME_DA_PASSADA`, o mesmo que o
 * painel usa. Barra e painel discordarem sobre o nome da etapa em curso seria
 * duas verdades sobre o mesmo trabalho.
 *
 *   node scripts/test-nexo-resumo-da-auditoria.ts   (== npm run test:nexo:resumo-auditoria)
 */
import assert from "node:assert/strict";

import { NOME_DA_PASSADA } from "../lib/audit-progress.ts";
import { resumoDaAuditoria } from "../modules/nexo/lib/resumo-da-auditoria.ts";
import type { MarcoRecebido } from "../modules/nexo/lib/etapas-da-auditoria.ts";

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

/** O motor só relata "inicio" e "fim" — não existe marco de "progresso". */
function marco(
  passada: MarcoRecebido["passada"],
  estado: MarcoRecebido["estado"],
  extra: Partial<MarcoRecebido> = {},
): MarcoRecebido {
  return { passada, estado, emMs: 1_000, ...extra };
}

test("sem marco nenhum, a barra diz que está enviando", () => {
  assert.deepEqual(resumoDaAuditoria([]), { rotulo: "Enviando o documento…" });
});

test("a etapa corrente é a primeira não concluída", () => {
  const r = resumoDaAuditoria([
    marco("extracao", "inicio"),
    marco("extracao", "fim"),
    marco("regras", "inicio"),
  ]);
  assert.equal(r.rotulo, NOME_DA_PASSADA.regras);
});

test("o rótulo é o mesmo que o painel do palco mostra", () => {
  const r = resumoDaAuditoria([marco("global", "inicio")]);
  assert.equal(r.rotulo, "Lendo o documento");
});

test("todas concluídas: a última vale como a corrente", () => {
  const r = resumoDaAuditoria([
    marco("extracao", "inicio"),
    marco("extracao", "fim"),
    marco("parecer", "inicio"),
    marco("parecer", "fim"),
  ]);
  assert.equal(r.rotulo, NOME_DA_PASSADA.parecer);
});

test("etapa contada mostra a contagem", () => {
  const r = resumoDaAuditoria([marco("blocos", "inicio", { indice: 3, total: 8 })]);
  assert.equal(r.contagem, "3 de 8");
});

test("etapa concluída não mostra contagem — ela acabou", () => {
  const r = resumoDaAuditoria([
    marco("blocos", "inicio", { indice: 8, total: 8 }),
    marco("blocos", "fim", { indice: 8, total: 8 }),
  ]);
  assert.equal(r.contagem, undefined);
});

test("etapa sem unidade contável não inventa contagem", () => {
  const r = resumoDaAuditoria([marco("global", "inicio")]);
  assert.equal(r.contagem, undefined);
});

console.log(`\n${passed} teste(s) passaram.`);
