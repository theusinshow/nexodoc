/**
 * Teste da META DE QUALIDADE e da SÉRIE SEMANAL (A.8).
 *
 * O que está travado aqui são as três recusas do desenho: não inventar meta,
 * não medir a taxa contra o que ninguém julgou, e não desenhar semana vazia
 * como se fosse queda.
 *
 *   node scripts/test-meta-qualidade.ts   (== npm run test:meta-qualidade)
 */
import assert from "node:assert/strict";

import {
  METAS_NAO_DECLARADAS,
  normalizarMetas,
  segundaDaSemana,
  serieSemanal,
  situacaoDaCobertura,
  situacaoDoFalsoPositivo,
  tendenciaDoFalsoPositivo,
  validarMetas,
} from "../lib/meta-de-qualidade.ts";

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

const METAS = normalizarMetas({ falsoPositivoMax: "10", coberturaMin: 40 });

test("a vírgula é aceita e o teto é 100", () => {
  assert.equal(normalizarMetas({ falsoPositivoMax: "12,5" }).falsoPositivoMax, 12.5);
  assert.equal(normalizarMetas({ falsoPositivoMax: 250 }).falsoPositivoMax, 100);
  assert.deepEqual(validarMetas(METAS), []);
});

test("SEM META NÃO HÁ APROVAÇÃO — nem reprovação", () => {
  assert.equal(situacaoDoFalsoPositivo(3, METAS_NAO_DECLARADAS), "sem-meta");
  assert.equal(situacaoDoFalsoPositivo(99, METAS_NAO_DECLARADAS), "sem-meta");
  assert.equal(situacaoDaCobertura(1, METAS_NAO_DECLARADAS), "sem-meta");
});

test("com meta, dentro e fora são distinguíveis de sem dado", () => {
  assert.equal(situacaoDoFalsoPositivo(8, METAS), "dentro");
  assert.equal(situacaoDoFalsoPositivo(10, METAS), "dentro", "a meta é um teto inclusivo");
  assert.equal(situacaoDoFalsoPositivo(11, METAS), "fora");
  assert.equal(situacaoDoFalsoPositivo(null, METAS), "sem-dado");
  assert.equal(situacaoDaCobertura(40, METAS), "dentro");
  assert.equal(situacaoDaCobertura(39, METAS), "fora");
});

test("a semana começa na segunda, inclusive no domingo", () => {
  // 2026-08-13 é uma quinta; 2026-08-16, o domingo seguinte.
  assert.equal(segundaDaSemana("2026-08-13T10:00:00Z"), "2026-08-10");
  assert.equal(segundaDaSemana("2026-08-16T23:00:00Z"), "2026-08-10");
  assert.equal(segundaDaSemana("2026-08-17T01:00:00Z"), "2026-08-17");
  assert.equal(segundaDaSemana("nao-e-data"), "");
});

const AUDITORIAS = [
  {
    createdAt: "2026-08-03T10:00:00Z",
    totalFindings: 10,
    veredictos: ["CONFIRMED", "CONFIRMED", "FALSE_POSITIVE"] as const,
  },
  { createdAt: "2026-08-04T10:00:00Z", totalFindings: 5, veredictos: [] as const },
  {
    createdAt: "2026-08-10T10:00:00Z",
    totalFindings: 8,
    veredictos: ["CONFIRMED", "CONFIRMED", "CONFIRMED", "CONFIRMED"] as const,
  },
];

test("a série agrupa por semana e conta cobertura", () => {
  const serie = serieSemanal(AUDITORIAS);
  assert.equal(serie.length, 2);
  assert.equal(serie[0].semana, "2026-08-03");
  assert.equal(serie[0].auditorias, 2);
  assert.equal(serie[0].auditoriasRevisadas, 1);
  assert.equal(serie[0].cobertura, 50);
  assert.equal(serie[1].semana, "2026-08-10");
});

test("a taxa divide pelo que foi JULGADO, não pelo que foi gerado", () => {
  const serie = serieSemanal(AUDITORIAS);
  // 1 falso positivo em 3 julgados = 33,3% — e não 1 em 15 achados.
  assert.equal(serie[0].taxaFalsoPositivo, 33.3);
  assert.equal(serie[1].taxaFalsoPositivo, 0);
});

test("semana sem julgamento nenhum fica null, não zero", () => {
  const serie = serieSemanal([
    { createdAt: "2026-08-03T10:00:00Z", totalFindings: 4, veredictos: [] },
  ]);
  assert.equal(serie[0].taxaFalsoPositivo, null);
  assert.equal(serie[0].cobertura, 0);
});

test("semana sem auditoria NÃO vira linha — férias não é queda", () => {
  const serie = serieSemanal([
    { createdAt: "2026-06-01T10:00:00Z", totalFindings: 1, veredictos: ["CONFIRMED"] },
    { createdAt: "2026-08-10T10:00:00Z", totalFindings: 1, veredictos: ["CONFIRMED"] },
  ]);
  assert.equal(serie.length, 2, "as semanas do meio não existem");
});

test("a série respeita o limite pelas semanas mais recentes", () => {
  const muitas = Array.from({ length: 12 }, (_, i) => ({
    createdAt: `2026-0${i < 4 ? "5" : "6"}-${String((i % 4) * 7 + 1).padStart(2, "0")}T10:00:00Z`,
    totalFindings: 1,
    veredictos: ["CONFIRMED"] as const,
  }));
  const serie = serieSemanal(muitas, 3);
  assert.ok(serie.length <= 3);
  assert.deepEqual([...serie].sort((a, b) => a.semana.localeCompare(b.semana)), serie);
});

test("a tendência exige duas semanas com julgamento", () => {
  assert.equal(tendenciaDoFalsoPositivo(serieSemanal(AUDITORIAS)), -33.3);
  assert.equal(
    tendenciaDoFalsoPositivo(
      serieSemanal([{ createdAt: "2026-08-10T10:00:00Z", totalFindings: 1, veredictos: [] }]),
    ),
    null,
  );
});

console.log(`\n${passed} teste(s) passaram.`);
