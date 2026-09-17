/**
 * DIFERENÇA QUE CABE NO ARREDONDAMENTO NÃO BLOQUEIA A EMISSÃO.
 *
 * 17/09/2026, benchmark do 027-24: "total 2.269,34 m³ × soma 2.269,36 m³" saiu
 * crítico, acima da hierarquia contraditória e da caixa de gordura errada. Os
 * achados abaixo são os do parecer real guardado em docs/benchmarks/027-24.
 *
 *   node scripts/test-arredondamento.ts   (== npm run test:arredondamento)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { AuditFinding } from "../lib/audit-report.ts";
import { calibrarArredondamento } from "../lib/arredondamento.ts";

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

const parecer = JSON.parse(
  readFileSync("docs/benchmarks/027-24/parecer-nexodoc-2026-09-17.json", "utf8"),
) as { incongruencias: AuditFinding[] };
const achado = (id: string) => {
  const f = parecer.incongruencias.find((x) => x.id === id);
  assert.ok(f, `${id} não está no parecer guardado`);
  return f;
};

test("REGRESSÃO 027_24 INC-002: 2.269,34 × 2.269,36 desce para editorial, com motivo", () => {
  const { finding, nota } = calibrarArredondamento(achado("INC-002"));
  assert.equal(finding.impacto, "revisao_editorial");
  assert.ok(nota, "sem nota de arredondamento");
  assert.match(nota, /0,02/);
  assert.match(finding.conflito, /arredondamento/i);
});

test("INC-002 não é removido: continua no parecer com a mesma evidência", () => {
  const original = achado("INC-002");
  const { finding } = calibrarArredondamento(original);
  assert.equal(finding.id, original.id);
  assert.equal(finding.evidencia, original.evidencia);
});

for (const [id, porque] of [
  ["INC-017", "caixa de gordura N=471 × 2×75+20: inteiros, não é arredondamento"],
  ["INC-006", "reservatório 44,86 L/dia × 22,3 dias: precisões diferentes"],
  ["INC-008", "área do restaurante 860 × 830 × 861,74: três valores"],
  ["INC-005", "70 L/min × 70 l/s: unidade, não conta"],
  ["INC-007", "hierarquia contraditória: não é conta"],
] as const) {
  test(`${id} não muda (${porque})`, () => {
    const original = achado(id);
    const { finding, nota } = calibrarArredondamento(original);
    assert.equal(nota, null);
    assert.equal(finding.impacto, original.impacto);
  });
}

const base: AuditFinding = {
  id: "X",
  arquivo: "m.pdf",
  origem: "ia",
  prioridade: "Alta",
  impacto: "critico_documental",
  pagina: "40",
  capitulo: "",
  local: "",
  tipo: "Erro aritmético em total",
  descricao: "",
  evidencia: "",
  termo_busca: "",
  conflito: "",
  sugestao_correcao: "",
  confianca: "alta",
};

test("erro de soma de verdade continua crítico (4.530,98 × 4.448,91)", () => {
  const { finding, nota } = calibrarArredondamento({
    ...base,
    descricao: "Total declarado 4.530,98 m², mas a soma das parcelas confere 4.448,91 m².",
  });
  assert.equal(nota, null);
  assert.equal(finding.impacto, "critico_documental");
});

test("diferença de 0,5 em total de 200,0 (uma casa) passa da tolerância e fica", () => {
  const { nota } = calibrarArredondamento({
    ...base,
    descricao: "Total declarado 200,0 m³, soma das parcelas confere 200,6 m³.",
  });
  assert.equal(nota, null);
});

test("sem palavra de conta (declarado/soma/total/cálculo) não mexe", () => {
  const { nota } = calibrarArredondamento({
    ...base,
    tipo: "Divergência de área",
    descricao: "A área aparece como 861,74 m² e 861,76 m² em capítulos diferentes.",
  });
  assert.equal(nota, null);
});

test("achado já editorial não ganha nota", () => {
  const { nota } = calibrarArredondamento({
    ...base,
    impacto: "revisao_editorial",
    descricao: "Total declarado 2.269,34, soma confere 2.269,36.",
  });
  assert.equal(nota, null);
});

console.log(`\n${passed} teste(s) de arredondamento OK`);
