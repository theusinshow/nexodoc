// A SUGESTÃO TEM DE DIZER O QUE FAZER — e o fiscal que cobra isso.
//
//   node scripts/test-sugestao-acionavel.ts   (== npm run test:sugestao)
//
// POR QUE ESTE TESTE EXISTE
//
// A auditoria fiscaliza quase tudo: `audit-verify.ts` descarta achado cuja
// evidência não existe no texto, `audit-precision-recall.ts` mede precisão e
// recall dos motores determinísticos. Duas coisas ficavam de fora, e são
// justamente as que o engenheiro LÊ para agir: o conflito e a sugestão.
//
// O resultado disso estava no nosso próprio código. O prompt do auditor manda,
// com estas palavras: "'Conferir' sozinho só é aceitável quando a informação
// necessária não está no documento — e aí diga onde buscá-la". E os motores
// determinísticos escreviam "Conferir o município correto e padronizar todos os
// documentos" — sabendo os dois valores e as duas páginas. A regra da casa
// quebrada pela casa.
//
// O fiscal vale para achado de REGRA, onde os valores são sempre conhecidos por
// construção. Achado de IA passa por outro caminho (a trava de evidência), e o
// contrato de campos dele é assunto separado.
import assert from "node:assert/strict";

import { sugestaoEhAcionavel } from "../lib/qualidade-da-sugestao.ts";
import { filterGroundedFindings } from "../lib/audit-verify.ts";
import type { AuditFinding } from "../lib/audit-report.ts";
import {
  runCrossDocumentRules,
  runWithinDocumentIdentityRules,
  type CrossDocumentSource,
} from "../lib/cross-document-audit.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

// --- O fiscal, isolado -------------------------------------------------------

test("verbo vago sozinho não é sugestão", () => {
  assert.equal(sugestaoEhAcionavel("Conferir o município correto.").ok, false);
  assert.equal(sugestaoEhAcionavel("Confirmar se o arquivo está certo.").ok, false);
  assert.equal(sugestaoEhAcionavel("Revisar e padronizar antes da emissão.").ok, false);
});

test("e o motivo diz o que falta", () => {
  const v = sugestaoEhAcionavel("Conferir o município correto.");
  assert.match(String(v.motivo), /alvo/i);
});

/*
 * O QUE SALVA O VERBO VAGO é dizer QUAL valor. Uma sugestão que cita o trecho
 * literal deixa de ser "vá olhar" e passa a ser "olhe isto": quem edita o
 * documento sabe o que procurar sem reabrir o achado inteiro.
 */
test("verbo vago COM os valores nomeados é sugestão", () => {
  assert.equal(
    sugestaoEhAcionavel(
      'Decidir qual município vale — o memorial diz "Criciúma" (p. 3) e a planta diz "Içara" (p. 1) — e alinhar os dois.',
    ).ok,
    true,
  );
});

test("trocar X por Y é o caso ideal", () => {
  assert.equal(
    sugestaoEhAcionavel('Substituir "Escola Vila Nova" pelo nome correto da obra ("Escola Central").').ok,
    true,
  );
});

/*
 * QUANDO O DOCUMENTO NÃO TEM O VALOR, a regra do prompt admite "conferir" — desde
 * que diga ONDE buscar. O fiscal aceita a mesma exceção, e não outra.
 */
test("sem o valor no documento, vale dizer onde buscar", () => {
  assert.equal(
    sugestaoEhAcionavel(
      "O documento não traz a edição da norma. Conferir na ABNT qual edição está vigente e declarar no capítulo 3.",
    ).ok,
    true,
  );
});

test("sugestão vazia não passa", () => {
  assert.equal(sugestaoEhAcionavel("").ok, false);
  assert.equal(sugestaoEhAcionavel("   ").ok, false);
});

// --- Os motores de verdade ---------------------------------------------------

/*
 * As fixtures vêm do harness oficial (`audit-precision-recall.ts`), e de
 * propósito: elas já provaram que DISPARAM os motores. Inventar texto novo aqui
 * arriscaria testar um caminho que nunca acende — e um teste que não acende
 * passa por bom.
 */
function fontes(): CrossDocumentSource[] {
  return [
    fonte("capa.pdf", "capa", ["Prefeitura Municipal de Criciuma. Endereco: Rua Joao Pinto, 100."]),
    fonte("memorial.pdf", "memorial", [
      "Prefeitura Municipal de Chapeco.",
      "Memorial da Prefeitura Municipal de Chapeco.",
    ]),
  ];
}

/** Um memorial com identidade de outra obra reaproveitada. */
function fonteComIdentidadeTrocada(): CrossDocumentSource {
  return fonte("017_26.pdf", "memorial", [
    "Obra: Centro Comunitario Primeira Linha, no municipio de Criciuma.",
    "O projeto do Centro Comunitario Primeira Linha atende eventos.",
    "Os documentos servirao de referencia para a construcao da Cidade do Autista.",
    "Terraplenagem do Centro Comunitario Primeira Linha.",
    "Projeto eletrico do Centro Comunitario Primeira Linha.",
  ]);
}

/** Mesma forma que `audit-precision-recall.ts` monta — o harness oficial. */
function fonte(fileName: string, fileType: string, paginas: string[]): CrossDocumentSource {
  const pages = paginas.map((text, i) => ({ page: i + 1, text }));
  return {
    fileName,
    fileType,
    extracted: {
      pages,
      text: pages.map((p) => `--- PAGINA ${p.page} ---\n${p.text}`).join("\n\n"),
      pageCount: pages.length,
      charCount: pages.reduce((t, p) => t + p.text.length, 0),
    },
  };
}

/*
 * A ASSERÇÃO QUE IMPORTA: todo achado de REGRA sai com sugestão acionável. Não é
 * amostra — é toda a saída dos motores sobre a fixture. Se alguém acrescentar um
 * motor novo com "conferir" dentro, este teste reprova antes de chegar na tela.
 */
test("todo achado dos motores determinísticos traz sugestão acionável", () => {
  const achados = [
    ...runCrossDocumentRules(fontes()).findings,
    ...runWithinDocumentIdentityRules(fonteComIdentidadeTrocada()),
  ];
  assert.ok(achados.length > 0, "a fixture não produziu achado nenhum — calibre a fixture");

  const ruins = achados
    .map((a) => ({ id: a.id, sugestao: a.sugestao_correcao, v: sugestaoEhAcionavel(a.sugestao_correcao ?? "") }))
    .filter((x) => !x.v.ok);

  assert.deepEqual(
    ruins.map((r) => `${r.id}: ${r.v.motivo} :: ${r.sugestao}`),
    [],
  );
});

// --- A medida no portão de evidência ----------------------------------------

/*
 * O QUE ESTA PARTE PROVA, e é o ponto todo do desenho: a sugestão fraca é
 * CONTADA e não punida. Achado com frase ruim continua na lista — descartá-lo
 * perderia defeito real, que é o oposto do "peque pelo excesso" que o prompt
 * manda —, e a `confianca` fica intocada, porque acreditar no achado e a frase
 * ajudar quem corrige são duas perguntas independentes.
 */
function achadoDeIa(sugestao: string, id: string): AuditFinding {
  return {
    id,
    arquivo: "memorial.pdf",
    origem: "ia",
    prioridade: "Media",
    pagina: "1",
    capitulo: "",
    local: "",
    tipo: "Redação / editorial",
    descricao: "Achado semeado.",
    // A evidência tem de existir no texto, senão o achado morre na trava e nunca
    // chega a ser contado.
    evidencia: "Prefeitura Municipal de Chapeco",
    termo_busca: "Prefeitura Municipal de Chapeco",
    conflito: "Diverge do declarado.",
    sugestao_correcao: sugestao,
    confianca: "alta",
  } as AuditFinding;
}

test("o portão CONTA a sugestão fraca — e não descarta o achado", () => {
  const doc = fonte("memorial.pdf", "memorial", [
    "Prefeitura Municipal de Chapeco.",
    "Memorial da Prefeitura Municipal de Chapeco.",
  ]);
  const portao = filterGroundedFindings(
    [
      achadoDeIa("Conferir o município correto.", "IA-001"),
      achadoDeIa('Substituir "Chapeco" por "Criciuma" no cabeçalho.', "IA-002"),
    ],
    doc.extracted,
  );

  assert.equal(portao.kept.length, 2, "nenhum achado pode ser descartado por causa da frase");
  assert.equal(portao.sugestoesFracas, 1);
  // A confiança do achado de frase ruim continua onde estava.
  assert.equal(portao.kept.find((f) => f.id === "IA-001")?.confianca, "alta");
});

test("achado de regra não entra na conta — ele já é fiscalizado antes", () => {
  const doc = fonte("memorial.pdf", "memorial", ["Prefeitura Municipal de Chapeco."]);
  const deRegra = { ...achadoDeIa("Conferir.", "REGRA-001"), origem: "regra" } as AuditFinding;
  const portao = filterGroundedFindings([deRegra], doc.extracted);
  assert.equal(portao.sugestoesFracas, 0);
});

console.log(`\n${passed} teste(s) passaram.`);
