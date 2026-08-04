/**
 * Smoke-test do buildAuditGraph — deriva o modelo do grafo da auditoria visual
 * a partir do AuditReport. Puro, roda com node cru.
 *
 *   node scripts/test-nexo-audit-graph.ts   (== npm run test:nexo:audit-graph)
 */
import assert from "node:assert/strict";

import { buildAuditGraph } from "../server/nexo/audit/build-audit-graph.ts";
import type { AuditFinding, AuditReport } from "../lib/audit-report.ts";

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

function finding(over: Partial<AuditFinding>): AuditFinding {
  return {
    id: "X",
    prioridade: "Media",
    pagina: "1",
    capitulo: "",
    local: "",
    tipo: "generico",
    descricao: "",
    evidencia: "",
    conflito: "",
    sugestao_correcao: "",
    confianca: "alta",
    ...over,
  };
}

function report(findings: AuditFinding[], runtime?: AuditReport["runtime"]): AuditReport {
  return {
    tipo_auditoria: "memorial",
    tipo_documento: "memorial",
    runtime,
    obra: "Obra X",
    codigo: "000-00",
    municipio: "Chapecó",
    data_documento: "",
    status_analise: "concluida",
    status_geral: "com pontos de revisão",
    total_incongruencias: findings.length,
    arquivos_analisados: [],
    comparacoes: [],
    incongruencias: findings,
    conclusao: "",
  };
}

test("página vazia/não numérica vai para unplaced", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "não identificada" }),
      finding({ id: "B", pagina: "12" }),
    ]),
  );
  assert.equal(g.unplaced.length, 1);
  assert.equal(g.unplaced[0].id, "A");
  assert.equal(g.findingNodes.length, 1);
  assert.equal(g.findingNodes[0].id, "B");
  assert.equal(g.findingNodes[0].pageNumber, 12);
});

test("severidade mapeada do impacto (identidade -> critico)", () => {
  const g = buildAuditGraph(
    report([finding({ id: "A", pagina: "5", tipo: "Nome da obra divergente" })]),
  );
  assert.equal(g.findingNodes[0].severity, "critico");
});

test("pageNodes agrupa achados por página e ordena", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "40" }),
      finding({ id: "B", pagina: "5" }),
      finding({ id: "C", pagina: "5" }),
    ]),
  );
  assert.deepEqual(
    g.pageNodes.map((p) => p.pageNumber),
    [5, 40],
  );
  assert.deepEqual(g.pageNodes[0].findingIds.sort(), ["B", "C"]);
});

test("recorrente: mesmo tipo + mesma evidência em 3 páginas vira 1 grupo x3", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó" }),
      finding({ id: "B", pagina: "88", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó" }),
      finding({ id: "C", pagina: "140", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 1);
  assert.equal(g.recurringGroups[0].count, 3);
  assert.deepEqual(g.recurringGroups[0].pages, [12, 88, 140]);
  assert.deepEqual(g.recurringGroups[0].findingIds.sort(), ["A", "B", "C"]);
  for (const n of g.findingNodes) {
    assert.equal(n.groupId, g.recurringGroups[0].id);
  }
});

test("recorrente exige >=2 páginas DISTINTAS (mesma página não agrupa)", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "T", evidencia: "mesmo texto" }),
      finding({ id: "B", pagina: "12", tipo: "T", evidencia: "mesmo texto" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 0);
});

test("fallback de similaridade alta junta redações levemente diferentes", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "Obra divergente", evidencia: "obra UBS Central de Chapecó" }),
      finding({ id: "B", pagina: "88", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó unidade" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 1);
  assert.equal(g.recurringGroups[0].count, 2);
});

test("tipos diferentes NÃO agrupam mesmo com evidência parecida", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "Obra divergente", evidencia: "UBS Central" }),
      finding({ id: "B", pagina: "88", tipo: "Norma desatualizada", evidencia: "UBS Central" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 0);
});

test("verdict vem do getEmissionVerdict (crítico -> NÃO EMITIR)", () => {
  const g = buildAuditGraph(
    report([finding({ id: "A", pagina: "5", tipo: "Nome da obra divergente" })]),
  );
  assert.equal(g.verdict.label, "NÃO EMITIR");
});

test("0 achados -> grafo vazio, verdict LIBERADO", () => {
  const g = buildAuditGraph(report([]));
  assert.equal(g.findingNodes.length, 0);
  assert.equal(g.pageNodes.length, 0);
  assert.equal(g.recurringGroups.length, 0);
  assert.equal(g.verdict.label, "LIBERADO");
});

// A tela textual já rebaixa o veredito quando uma passada não completou; o canvas
// é OUTRA tela sobre o MESMO relatório e não pode dizer LIBERADO onde a outra diz
// "não use para emitir". Por isso o grafo repassa runtime.passadas_incompletas.
test("análise parcial rebaixa o veredito mesmo sem achado", () => {
  const g = buildAuditGraph(
    report([], { passadas_incompletas: [{ passada: "leitura global", motivo: "timeout" }] }),
  );
  assert.equal(g.verdict.emoji, "⚠️");
  assert.ok(g.verdict.label.includes("NÃO USE PARA EMITIR"));
});

// A validação rebaixa achado incerto para "sugestao" em vez de deletar (item 4).
// Sugestão aparece no canvas, mas não acende o semáforo sozinha.
test("sugestão da IA não acende o veredito, mas vira nó", () => {
  const g = buildAuditGraph(
    report([
      finding({
        id: "A",
        pagina: "5",
        tipo: "Nome da obra divergente",
        origem: "ia",
        tier: "sugestao",
      }),
    ]),
  );
  assert.equal(g.verdict.label, "LIBERADO");
  assert.equal(g.findingNodes.length, 1);
  assert.equal(g.findingNodes[0].tier, "sugestao");
});

console.log(`\n${passed} testes ok`);
