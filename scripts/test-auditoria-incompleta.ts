/**
 * Teste da AUDITORIA INCOMPLETA — o parecer que não pode parecer inteiro.
 *
 * Em 14/09/2026 o 117_25 (218 páginas) saiu em produção com 10 achados: a
 * leitura do documento pela IA abortou e só as regras rodaram. A tela mostrava a
 * contagem como a de qualquer auditoria, e a pessoa leu "este memorial tem 10
 * problemas". A corrida completa do mesmo documento achou 56.
 *
 *   node scripts/test-auditoria-incompleta.ts
 */
import assert from "node:assert/strict";

import {
  detalheDoParecer,
  incompletudeDoParecer,
  rotuloDaContagem,
} from "../lib/auditoria-incompleta.ts";
import { getEmissionVerdict } from "../lib/audit-report.ts";

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

const GLOBAL_ABORTADA = [{ passada: "Leitura global do documento", motivo: "Request was aborted." }];

function parecer(over: Record<string, unknown> = {}) {
  return {
    status_analise: "concluida" as const,
    status_geral: "revisão obrigatória antes de emissão",
    total_incongruencias: 10,
    incongruencias: [],
    runtime: { passadas_incompletas: [] as { passada: string; motivo?: string }[] },
    ...over,
  };
}

test("parecer completo não carrega aviso nenhum", () => {
  const i = incompletudeDoParecer(parecer());
  assert.equal(i.incompleta, false);
  assert.equal(i.iaNaoLeu, false);
  assert.equal(rotuloDaContagem(parecer()), "10 achados");
});

test("leitura global abortada: incompleta E a IA não leu o documento", () => {
  const p = parecer({ runtime: { passadas_incompletas: GLOBAL_ABORTADA } });
  const i = incompletudeDoParecer(p);
  assert.equal(i.incompleta, true);
  assert.equal(i.iaNaoLeu, true);
  assert.match(i.titulo, /AUDITORIA INCOMPLETA/);
  assert.match(i.titulo, /IA NÃO LEU/);
  // A frase tem que desmentir a contagem com todas as letras.
  assert.match(i.explicacao, /só das regras automáticas/);
  assert.match(i.explicacao, /não é o total/i);
  assert.match(i.explicacao, /Request was aborted/);
});

test("a contagem de uma auditoria incompleta nunca aparece sozinha", () => {
  const p = parecer({ runtime: { passadas_incompletas: GLOBAL_ABORTADA } });
  assert.equal(rotuloDaContagem(p), "10 achados — contagem INCOMPLETA");
});

test("o detalhe do nó diz incompleta antes do número", () => {
  const p = parecer({ runtime: { passadas_incompletas: GLOBAL_ABORTADA } });
  assert.match(detalheDoParecer(p), /^AUDITORIA INCOMPLETA/);
  assert.equal(
    detalheDoParecer(parecer()),
    "revisão obrigatória antes de emissão · 10 achados",
  );
});

test("outra passada falhou: incompleta, mas sem dizer que a IA não leu", () => {
  const p = parecer({
    runtime: { passadas_incompletas: [{ passada: "Revisão dos achados pela IA", motivo: "x" }] },
  });
  const i = incompletudeDoParecer(p);
  assert.equal(i.incompleta, true);
  assert.equal(i.iaNaoLeu, false);
  assert.match(i.explicacao, /Revisão dos achados pela IA/);
});

test("status parcial sem passada falha (folha muda) também é incompleta", () => {
  const i = incompletudeDoParecer(parecer({ status_analise: "parcial" }));
  assert.equal(i.incompleta, true);
  assert.equal(i.iaNaoLeu, false);
});

test("parecer antigo sem runtime não quebra e não inventa aviso", () => {
  const i = incompletudeDoParecer({ total_incongruencias: 3, incongruencias: [] });
  assert.equal(i.incompleta, false);
});

test("o veredito da leitura global abortada é o de auditoria incompleta, em vermelho", () => {
  const v = getEmissionVerdict([], GLOBAL_ABORTADA);
  assert.match(v.label, /AUDITORIA INCOMPLETA/);
  assert.match(v.label, /NÃO USE PARA EMITIR/);
  assert.equal(v.emoji, "🔴");
});

console.log(`\n${passed} teste(s) passaram`);
