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

/** Um parecer com cobertura declarada — para os testes de folha muda. */
function comCobertura(paginas_mudas: number, paginas_transcritas: number): AuditReport {
  const r = relatorio();
  return {
    ...r,
    arquivos_analisados: [
      {
        arquivo: "084_25_md.pdf",
        tipo_documento: "Memorial Descritivo",
        resumo: "",
        cobertura: {
          caracteres_lidos: 7470,
          caracteres_totais: 7470,
          blocos_lidos: 1,
          blocos_totais: 1,
          blocos_planejados: 1,
          paginas_mudas,
          paginas_transcritas,
        },
      },
    ],
  } as unknown as AuditReport;
}

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

// --- Folha muda na base (02/09/2026) -----------------------------------------

/*
 * O BURACO QUE O TRABALHO DA PAGINA MUDA ABRIU.
 *
 * O portao so recusava quando alguma passada FALHOU (`passadas_incompletas`).
 * Uma auditoria que leu 6 de 31 paginas porque as outras 25 estao desenhadas na
 * folha em vez de escritas nao falhou em nada -- a global rodou, os blocos
 * rodaram -- e passava. Herdar dela congela o buraco, que e exatamente o que o
 * cabecalho deste modulo diz sobre amplificar a base.
 */
test("base com folha muda NAO lida nao serve - mesmo sem passada falhada", () => {
  const r = avaliarBase({
    base: base(comCobertura(25, 0)),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  assert.equal((r as { motivo: string }).motivo, "paginas-nao-lidas");
});

test("base cujas folhas mudas FORAM transcritas serve normalmente", () => {
  const r = avaliarBase({
    base: base(comCobertura(25, 25)),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, true);
});

test("parecer antigo, sem os campos de folha muda, nao muda de comportamento", () => {
  // Nada gravado antes de 02/09/2026 declara `paginas_mudas`; deduzir buraco
  // para eles recusaria o acervo inteiro.
  const r = avaliarBase({ base: base(relatorio()), arquivo: "084_25_md.pdf", versaoAtual: VERSAO });
  assert.equal(r.serve, true);
});

test("a frase da recusa por folha muda diz o que houve", () => {
  assert.match(fraseDaRecusa("paginas-nao-lidas"), /desenhad|transcri/i);
});

// --- A revisao muda o nome do arquivo (02/09/2026) ---------------------------

/*
 * MEDIDO nos nomes reais do acervo: a letra de revisao esta NO NOME por
 * convencao do escritorio (`_a` -> `_b`), e cada rodada de assinatura ainda
 * ACRESCENTA quem assinou:
 *
 *   040_26_md_geral_a.pdf
 *   040_26_md_geral_a_clau_chris_assinado.pdf
 *   040_26_md_geral_a_clau_chris_Rama_Rafa_assinado.pdf
 *
 * Casando so por nome exato, o reuso recusava justamente o caso da revisao --
 * para o qual ele foi construido.
 */
test("a revisao seguinte do mesmo memorial reusa a base", () => {
  const r = avaliarBase({
    base: base(relatorio({ impressao: [{ arquivo: "040_26_md_geral_a.pdf", capitulos: CAPITULOS }] })),
    arquivo: "040_26_md_geral_b.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, true, "_a -> _b e a mesma peca, uma revisao depois");
});

test("a via assinada do mesmo memorial reusa a base", () => {
  const r = avaliarBase({
    base: base(relatorio({ impressao: [{ arquivo: "040_26_md_geral_a.pdf", capitulos: CAPITULOS }] })),
    arquivo: "040_26_md_geral_a_clau_chris_Rama_Rafa_assinado.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, true);
});

test("OUTRO memorial do MESMO projeto nao reusa", () => {
  // `116_25_md_geral` e `116_25_md_ter_pav` convivem no mesmo projeto e sao
  // pecas diferentes. Emparelha-las herdaria achado de outro documento.
  const r = avaliarBase({
    base: base(relatorio({ impressao: [{ arquivo: "116_25_md_geral_b.pdf", capitulos: CAPITULOS }] })),
    arquivo: "116_25_md_ter_pav.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  assert.equal((r as { motivo: string }).motivo, "outro-arquivo");
});

test("chave ambigua na base NAO casa - o nome exato continua mandando", () => {
  /*
   * As 6 folhas de `113_22_gme_a-R00 - NN - ...` normalizam todas para
   * `113_22_gme`. Com mais de uma candidata, escolher seria escolher no escuro:
   * recusa, que e o comportamento de antes.
   */
  const impressao = [
    { arquivo: "113_22_gme_a-R00 - 01 - PLANTA BAIXA.pdf", capitulos: CAPITULOS },
    { arquivo: "113_22_gme_a-R00 - 02 - ISOMETRICO.pdf", capitulos: CAPITULOS },
  ];
  const r = avaliarBase({
    base: base(relatorio({ impressao })),
    arquivo: "113_22_gme_b-R01 - 09 - OUTRA.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  assert.equal((r as { motivo: string }).motivo, "outro-arquivo");
});

test("nome exato tem precedencia sobre a chave normalizada", () => {
  const impressao = [
    { arquivo: "040_26_md_geral_a.pdf", capitulos: [{ ...CAPITULOS[0], hash: "errado" }] },
    { arquivo: "040_26_md_geral_b.pdf", capitulos: [{ ...CAPITULOS[0], hash: "certo" }] },
  ];
  const r = avaliarBase({
    base: base(relatorio({ impressao })),
    arquivo: "040_26_md_geral_b.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, true);
  assert.equal((r as { impressao: { hash: string }[] }).impressao[0].hash, "certo");
});

test("revisao renomeada nao escapa do portao da folha muda", () => {
  /*
   * O defeito do primeiro corte deste conserto: a impressao casava pela chave
   * (para `_a` -> `_b` reusar) e a cobertura casava por nome EXATO. Numa
   * revisao renomeada o arquivo da cobertura nao era encontrado, o portao achava
   * que nao havia medicao e passava -- deixando entrar a base furada que ele
   * acabara de ser escrito para barrar.
   */
  const r = relatorio({ impressao: [{ arquivo: "040_26_md_geral_a.pdf", capitulos: CAPITULOS }] });
  const comFuro = {
    ...r,
    arquivos_analisados: [
      {
        arquivo: "040_26_md_geral_a.pdf",
        tipo_documento: "Memorial Descritivo",
        resumo: "",
        cobertura: {
          caracteres_lidos: 7470,
          caracteres_totais: 7470,
          blocos_lidos: 1,
          blocos_totais: 1,
          blocos_planejados: 1,
          paginas_mudas: 25,
          paginas_transcritas: 0,
        },
      },
    ],
  } as unknown as AuditReport;

  const res = avaliarBase({
    base: base(comFuro),
    arquivo: "040_26_md_geral_b.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(res.serve, false);
  assert.equal((res as { motivo: string }).motivo, "paginas-nao-lidas");
});

console.log(`\n${passed} teste(s) de elegibilidade OK`);
