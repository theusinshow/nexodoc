/**
 * O QUE A VALIDAÇÃO PODE FAZER COM CADA ACHADO.
 *
 * 17/09/2026, benchmark do 027-24: a regra da hierarquia documental emite
 * crítico (decisão de 12/08/2026), a validação pediu técnico, e o achado saiu
 * técnico. Achado de regra já era protegido de REMOÇÃO; não era de REBAIXAMENTO.
 *
 *   node scripts/test-decisao-da-validacao.ts   (== npm run test:decisao-da-validacao)
 */
import assert from "node:assert/strict";

import type { AuditFinding } from "../lib/audit-report.ts";
import type { ContestacaoDeRegra } from "../lib/contestacao-de-regra.ts";
import { aplicarDecisaoDaValidacao } from "../lib/decisao-da-validacao.ts";

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

/** O INC-007 do parecer de 17/09, como a regra o emite, antes da validação. */
const HIERARQUIA: AuditFinding = {
  id: "COER-001",
  arquivo: "027_24_md_geral_a.pdf",
  origem: "regra",
  prioridade: "Alta",
  impacto: "critico_documental",
  pagina: "17 e 21",
  capitulo: "Condições gerais / hierarquia documental",
  local: "regra de prevalência entre documentos",
  tipo: "Hierarquia documental contraditória",
  descricao: "O documento estabelece regras de prevalência incompatíveis.",
  evidencia: 'Pág. 17: "sempre prevalecerão os projetos" | Pág. 21: "prevalecerão sobre todos os projetos"',
  termo_busca: "prevalecerão sobre todos os projetos",
  conflito: "Projetos prevalecem (pág. 17) × especificações prevalecem sobre os projetos (pág. 21).",
  sugestao_correcao: "Unificar uma única regra de prevalência documental.",
  confianca: "alta",
};

const DA_IA: AuditFinding = {
  ...HIERARQUIA,
  id: "IA-010",
  origem: "ia",
  tipo: "Referência a apartamento não aplicável ao programa",
  impacto: "critico_documental",
};

test("REGRESSÃO 027_24: regra rebaixada pela validação mantém a faixa", () => {
  const contestacoes: ContestacaoDeRegra[] = [];
  const out = aplicarDecisaoDaValidacao(
    HIERARQUIA,
    {
      acao: "rebaixar",
      impacto: "tecnico_contratual",
      prioridade: "Media/Alta",
      motivo: "exige conferência do responsável técnico",
    },
    contestacoes,
  );
  assert.equal(out.impacto, "critico_documental");
  assert.equal(contestacoes.length, 1);
  assert.match(contestacoes[0].motivo, /tecnico_contratual/);
  assert.match(contestacoes[0].motivo, /exige conferência/);
});

test("regra confirmada na mesma faixa não gera contestação", () => {
  const contestacoes: ContestacaoDeRegra[] = [];
  const out = aplicarDecisaoDaValidacao(
    HIERARQUIA,
    { acao: "confirmar", impacto: "critico_documental" },
    contestacoes,
  );
  assert.equal(out.impacto, "critico_documental");
  assert.equal(contestacoes.length, 0);
});

test("regra que a validação quer remover fica, e a remoção vira contestação", () => {
  const contestacoes: ContestacaoDeRegra[] = [];
  const out = aplicarDecisaoDaValidacao(HIERARQUIA, { acao: "remover", motivo: "não vi" }, contestacoes);
  assert.equal(out.impacto, "critico_documental");
  assert.equal(out.tier, undefined);
  assert.equal(contestacoes.length, 1);
});

test("guarda obrigatória também mantém a faixa", () => {
  const contestacoes: ContestacaoDeRegra[] = [];
  const out = aplicarDecisaoDaValidacao(
    { ...HIERARQUIA, id: "GUARDA-001", origem: "ia" },
    { acao: "rebaixar", impacto: "revisao_editorial" },
    contestacoes,
  );
  assert.equal(out.impacto, "critico_documental");
  assert.equal(contestacoes.length, 1);
});

test("achado de IA continua sendo reclassificado pela validação", () => {
  const out = aplicarDecisaoDaValidacao(DA_IA, { acao: "rebaixar", impacto: "tecnico_contratual" }, []);
  assert.equal(out.impacto, "tecnico_contratual");
});

test("achado de IA removido vira sugestão, não some", () => {
  const out = aplicarDecisaoDaValidacao(DA_IA, { acao: "remover", prioridade: "Baixa" }, []);
  assert.equal(out.tier, "sugestao");
  assert.equal(out.confianca, "baixa");
  assert.equal(out.impacto, "revisao_editorial");
});

test("impacto inválido na decisão não apaga o do achado", () => {
  const out = aplicarDecisaoDaValidacao(DA_IA, { acao: "confirmar", impacto: "gravissimo" }, []);
  assert.equal(out.impacto, "critico_documental");
});

console.log(`\n${passed} teste(s) de decisão da validação OK`);
