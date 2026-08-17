/**
 * QUANDO O PARECER ANTERIOR NÃO SERVE DE BASE.
 *
 * O portão que só apareceu no fim do brainstorm, e que a corrida de 17/08/2026
 * tornou concreto: aquela auditoria do 084_25 truncou 20 dos 25 blocos. Herdar
 * dela congelaria o buraco — cada reauditoria confirmaria o vazio da anterior, e
 * a cobertura nunca voltaria.
 *
 *   node scripts/test-elegibilidade-da-base.ts   (== npm run test:elegibilidade)
 */
import assert from "node:assert/strict";

import { avaliarBase, fraseDaRecusa } from "../lib/elegibilidade-da-base.ts";
import type { AuditReport } from "../lib/audit-report.ts";

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

const VERSAO = "abc123def456";
const CAPITULOS = [
  { titulo: "1 - APRESENTACAO", startPage: 1, endPage: 4, chars: 900, hash: "h1" },
];

function relatorio(over: Record<string, unknown> = {}): AuditReport {
  return {
    tipo_auditoria: "memorial",
    tipo_documento: "Memorial Descritivo",
    runtime: {
      versao_auditor: VERSAO,
      passadas_incompletas: [],
      impressao: [{ arquivo: "084_25_md.pdf", capitulos: CAPITULOS }],
      ...over,
    },
    obra: "x",
    codigo: "084_25",
    municipio: "Criciúma",
    data_documento: "",
    status_analise: "concluida",
    status_geral: "sem achados críticos",
    total_incongruencias: 0,
    arquivos_analisados: [],
    comparacoes: [],
    incongruencias: [],
    conclusao: "",
  } as unknown as AuditReport;
}

const base = (report: AuditReport | null, status = "COMPLETED") => ({
  auditId: "a1",
  status,
  report,
});

test("base boa serve, e devolve a impressão do arquivo", () => {
  const r = avaliarBase({
    base: base(relatorio()),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, true);
  if (r.serve) assert.deepEqual(r.impressao, CAPITULOS);
});

test("sem base não serve", () => {
  const r = avaliarBase({ base: null, arquivo: "x.pdf", versaoAtual: VERSAO });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "sem-base");
});

test("PARECER PARCIAL NÃO SERVE — o caso do 084_25", () => {
  /*
   * 20 blocos truncados naquela corrida. Herdar dela transformaria um acidente
   * numa lacuna permanente: os capítulos que nunca foram lidos ficariam
   * marcados como já auditados para sempre.
   */
  const r = avaliarBase({
    base: base(
      relatorio({
        passadas_incompletas: [
          { passada: "Bloco de páginas 47-58", motivo: "incomplete_max_output_tokens" },
        ],
      }),
    ),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "analise-parcial");
});

test("auditoria que não completou não serve", () => {
  const r = avaliarBase({
    base: base(relatorio(), "FAILED"),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "nao-completou");
});

test("versão de auditor diferente não serve", () => {
  const r = avaliarBase({
    base: base(relatorio()),
    arquivo: "084_25_md.pdf",
    versaoAtual: "outra-versao",
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "versao-diferente");
});

test("parecer antigo com versão NUMÉRICA não serve", () => {
  // Todo parecer anterior a esta mudança gravou `versao_auditor: 1`. Um número
  // nunca casa com um hash — e não casar é o desfecho correto.
  const r = avaliarBase({
    base: base(relatorio({ versao_auditor: 1 })),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "versao-diferente");
});

test("sem impressão digital não serve", () => {
  const r = avaliarBase({
    base: base(relatorio({ impressao: undefined })),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "sem-impressao");
});

test("impressão de OUTRO arquivo não serve", () => {
  const r = avaliarBase({
    base: base(relatorio()),
    arquivo: "063_26_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "outro-arquivo");
});

test("toda recusa tem frase, e nenhuma diz 'erro'", () => {
  const motivos = [
    "sem-base",
    "nao-completou",
    "analise-parcial",
    "sem-impressao",
    "versao-diferente",
    "outro-arquivo",
  ] as const;
  for (const m of motivos) {
    const frase = fraseDaRecusa(m);
    assert.ok(frase.length > 10, `${m} sem frase`);
    assert.doesNotMatch(frase, /erro/i, `${m}: não houve erro, houve ausência de base`);
  }
});

console.log(`\n${passed} teste(s) de elegibilidade OK`);
