/**
 * Teste do motor determinístico de consistência entre documentos.
 *
 * Roda sem framework, direto no Node com type-stripping nativo:
 *   node scripts/test-audit-consistency.ts
 * (também exposto como `npm run test:audit`)
 *
 * Objetivo: garantir que o confronto de identidade entre documentos
 *  - PEGA divergência real de município/endereço/obra entre arquivos;
 *  - NÃO acusa quando os documentos concordam;
 *  - resiste a menções soltas (usa a moda por documento);
 *  - não trata arquivo único como conflito.
 */
import assert from "node:assert/strict";

import {
  extractIdentityFingerprint,
  runCrossDocumentRules,
  runWithinDocumentIdentityRules,
  type CrossDocumentSource,
} from "../lib/cross-document-audit.ts";
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";
import { filterGroundedFindings } from "../lib/audit-verify.ts";
import { classifyFindingImpact } from "../lib/audit-report.ts";

type PageInput = string;

function makeSource(
  fileName: string,
  fileType: string,
  pages: PageInput[],
): CrossDocumentSource {
  const extractedPages = pages.map((text, index) => ({ page: index + 1, text }));
  const text = extractedPages
    .map((page) => `--- PAGINA ${page.page} ---\n${page.text}`)
    .join("\n\n");

  return {
    fileName,
    fileType,
    extracted: {
      pages: extractedPages,
      text,
      pageCount: extractedPages.length,
      charCount: extractedPages.reduce((total, page) => total + page.text.length, 0),
    },
  };
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("motor de consistência entre documentos\n");

// --- 0. Normalização de identidade (Camada 0) ---------------------------------
check("extrai e normaliza município com acento", () => {
  const fp = extractIdentityFingerprint(
    makeSource("capa.pdf", "capa", ["Prefeitura Municipal de Criciúma."]),
  );
  assert.equal(fp.fields.municipio?.canonical, "criciuma");
  assert.equal(fp.fields.municipio?.display, "Criciúma");
});

// --- 1. Divergência real entre documentos (o erro de hoje) --------------------
check("acusa município divergente entre capa e memorial", () => {
  const sources = [
    makeSource("capa.pdf", "capa", [
      "Prefeitura Municipal de Criciúma. Endereço: Rua João Pinto, 100.",
    ]),
    makeSource("memorial.pdf", "memorial", [
      "Prefeitura Municipal de Chapecó. Endereço: Avenida Getúlio Vargas, 200.",
      "Memorial descritivo da Prefeitura Municipal de Chapecó.",
    ]),
  ];

  const { findings } = runCrossDocumentRules(sources);
  const municipio = findings.filter((f) => f.tipo.includes("Município"));

  assert.equal(municipio.length, 1, "esperava exatamente 1 divergência de município");
  assert.equal(municipio[0].origem, "regra");
  assert.equal(municipio[0].prioridade, "Alta");
  assert.equal(municipio[0].confianca, "alta");
  assert.equal(municipio[0].arquivo, "memorial.pdf");
  // baseline é a capa (maior precedência); memorial é o divergente
  assert.match(municipio[0].referencia_comparada ?? "", /capa\.pdf: Criciúma/);
  assert.ok(municipio[0].evidencia.length > 0, "achado precisa carregar evidência");
});

check("acusa endereço divergente entre documentos", () => {
  const sources = [
    makeSource("capa.pdf", "capa", ["Endereço: Rua João Pinto, 100"]),
    makeSource("memorial.pdf", "memorial", ["Endereço: Avenida Getúlio Vargas, 200"]),
  ];

  const { findings } = runCrossDocumentRules(sources);
  assert.ok(
    findings.some((f) => f.tipo.includes("Endereço")),
    "esperava divergência de endereço",
  );
});

// --- 2. Sem falso-positivo quando os documentos concordam ---------------------
check("NÃO acusa quando o município é o mesmo nos dois documentos", () => {
  const sources = [
    makeSource("capa.pdf", "capa", ["Município: São Paulo"]),
    makeSource("memorial.pdf", "memorial", ["Município: São Paulo"]),
  ];

  const { findings, comparisons } = runCrossDocumentRules(sources);
  assert.equal(
    findings.filter((f) => f.tipo.includes("Município")).length,
    0,
    "não pode acusar divergência quando os valores batem",
  );
  assert.ok(
    comparisons.some((c) => c.includes("compatível")),
    "deve registrar que o valor é compatível",
  );
});

// --- 3. Resistência a menções soltas (usa a moda por documento) ---------------
check("ignora menção solta: memorial cita Criciúma 3x e Chapecó 1x", () => {
  const sources = [
    makeSource("capa.pdf", "capa", ["Prefeitura Municipal de Criciúma."]),
    makeSource("memorial.pdf", "memorial", [
      "Prefeitura Municipal de Criciúma.",
      "Obra da Prefeitura Municipal de Criciúma. Conforme manual da Prefeitura Municipal de Chapecó.",
      "Responsabilidade da Prefeitura Municipal de Criciúma.",
    ]),
  ];

  const { findings } = runCrossDocumentRules(sources);
  assert.equal(
    findings.filter((f) => f.tipo.includes("Município")).length,
    0,
    "a moda do memorial é Criciúma; a menção solta a Chapecó não deve virar conflito cross-doc",
  );
});

// --- 4. Arquivo único não é conflito ------------------------------------------
check("arquivo único não gera achado de comparação", () => {
  const { findings, comparisons } = runCrossDocumentRules([
    makeSource("memorial.pdf", "memorial", ["Prefeitura Municipal de Criciúma."]),
  ]);
  assert.equal(findings.length, 0);
  assert.ok(comparisons[0].includes("arquivo único"));
});

// --- 5. Identidade DENTRO de um documento (caso real: memorial 017_26) --------
// Fixture com as strings REAIS do memorial "Centro Comunitário Primeira Linha"
// (Criciúma), que carrega texto reaproveitado de 3 outros projetos.
function makePrimeiraLinhaDoc(): CrossDocumentSource {
  const rodape =
    "PREFEITURA MUNICIPAL DE CRICIÚMA – 017_26 – CENTRO COMUNITÁRIO PRIMEIRA LINHA – PROJETO EXECUTIVO";
  return makeSource("017_26_md_geral.pdf", "memorial", [
    `Obra: Centro Comunitário Primeira Linha, no município de Criciúma – SC. ${rodape}`,
    `O projeto do Centro Comunitário Primeira Linha atende eventos comunitários. ${rodape}`,
    // erro 1 — vazamento de outro projeto
    `Os documentos que integram o projeto servirão de referência para a construção da Cidade do Autista. ${rodape}`,
    `Terraplenagem do Centro Comunitário Primeira Linha em Criciúma. ${rodape}`,
    `Drenagem pluvial do Centro Comunitário Primeira Linha. ${rodape}`,
    // erro 2 e 3 — Centro Dia do Idoso
    `Este memorial descreve o PPCI para a Reforma e Adequação - Centro Dia do Idoso, em Criciúma. ${rodape}`,
    `A ocupação da Reforma e Adequação - Centro Dia do Idoso é Salão de festa (F-6). ${rodape}`,
    // erro 4 — ocupação errada (UBS)
    `Por se tratar de uma unidade básica de saúde os cálculos das larguras das portas ficam assim. ${rodape}`,
    // erro 5 — Centro Comunitário Boa Vista
    `Como o imóvel Reforma Centro Comunitário Boa Vista possui recintos com pouca luz natural. ${rodape}`,
    `Projeto elétrico do Centro Comunitário Primeira Linha. ${rodape}`,
  ]);
}

check("pega os 3 nomes de obra reaproveitados no memorial real", () => {
  const findings = runWithinDocumentIdentityRules(makePrimeiraLinhaDoc());
  const nomes = findings.map((f) => f.termo_busca ?? "");

  assert.ok(
    nomes.some((n) => /Cidade do Autista/i.test(n)),
    "deveria pegar 'Cidade do Autista'",
  );
  assert.ok(
    nomes.some((n) => /Centro Dia do Idoso/i.test(n)),
    "deveria pegar 'Centro Dia do Idoso'",
  );
  assert.ok(
    nomes.some((n) => /Boa Vista/i.test(n)),
    "deveria pegar 'Centro Comunitário Boa Vista'",
  );
  // todos vêm de regra, prioridade Alta, com evidência
  for (const f of findings) {
    assert.equal(f.origem, "regra");
    assert.equal(f.prioridade, "Alta");
    assert.ok(f.evidencia.length > 0);
    assert.match(f.referencia_comparada ?? "", /Primeira Linha/);
  }
});

check("pega a ocupação errada (unidade básica de saúde) no memorial real", () => {
  const findings = runWithinDocumentIdentityRules(makePrimeiraLinhaDoc());
  assert.ok(
    findings.some((f) => /unidade b[áa]sica de sa[úu]de/i.test(f.termo_busca ?? "")),
    "deveria pegar 'unidade básica de saúde' como ocupação divergente",
  );
});

check("NÃO acusa documento coerente (só Centro Comunitário Primeira Linha)", () => {
  const limpo = makeSource("ok.pdf", "memorial", [
    "Obra: Centro Comunitário Primeira Linha, em Criciúma.",
    "O Centro Comunitário Primeira Linha terá salão de festas.",
    "Projeto do Centro Comunitário Primeira Linha, Criciúma.",
    "Estrutura do Centro Comunitário Primeira Linha.",
  ]);
  assert.equal(runWithinDocumentIdentityRules(limpo).length, 0);
});

// --- 6. Regras de coerência documental (contradições cross-capítulo) ----------
check("pega hierarquia documental contraditória", () => {
  const doc = makeSource("memorial.pdf", "memorial", [
    "Em caso de divergência entre as especificações e os projetos, sempre prevalecerão os projetos.",
    "Texto intermediário de outro capítulo qualquer.",
    "As especificações técnicas e normas de execução citadas neste memorial prevalecerão sobre todos os projetos.",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  assert.ok(
    findings.some((f) => f.tipo.includes("Hierarquia")),
    "deveria pegar a contradição de prevalência",
  );
});

check("NÃO acusa coerência quando não há contradição de prevalência", () => {
  const doc = makeSource("ok.pdf", "memorial", [
    "Em caso de divergência, sempre prevalecerão os projetos de execução.",
    "As normas da ABNT devem ser seguidas.",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  assert.equal(findings.filter((f) => f.tipo.includes("Hierarquia")).length, 0);
});

// --- 7. Trava anti-alucinação (Fase B) ----------------------------------------
function mkFinding(partial: Record<string, unknown>) {
  return {
    id: "X-001",
    prioridade: "Media",
    pagina: "1",
    capitulo: "cap",
    local: "local",
    tipo: "tipo",
    descricao: "desc",
    evidencia: "",
    conflito: "conf",
    sugestao_correcao: "corrigir",
    confianca: "media",
    ...partial,
  } as Parameters<typeof filterGroundedFindings>[0][number];
}

const gateDoc = {
  pages: [
    { page: 1, text: "O reservatório de reúso possui capacidade de 1000 litros e clorador." },
    { page: 2, text: "A cobertura será executada com telha ondulada de fibrocimento premium." },
  ],
  text: "O reservatório de reúso possui capacidade de 1000 litros e clorador.\nA cobertura será executada com telha ondulada de fibrocimento premium.",
  pageCount: 2,
  charCount: 130,
};

check("mantém achado de IA ancorado no texto", () => {
  const finding = mkFinding({
    origem: "ia",
    evidencia: "reservatório de reúso possui capacidade de 1000 litros",
    termo_busca: "1000 litros",
  });
  const { kept, dropped } = filterGroundedFindings([finding], gateDoc);
  assert.equal(kept.length, 1);
  assert.equal(dropped.length, 0);
});

check("descarta achado de IA sem evidência no texto (alucinação)", () => {
  const finding = mkFinding({
    origem: "ia",
    evidencia: "A NBR 15575 exige janela mínima de 2,50 m² no dormitório principal",
    termo_busca: "janela mínima de 2,50 m²",
  });
  const { kept, dropped } = filterGroundedFindings([finding], gateDoc);
  assert.equal(kept.length, 0, "achado inventado deve ser descartado");
  assert.equal(dropped.length, 1);
});

check("achado de regra passa sempre, mesmo sem evidência no texto", () => {
  const finding = mkFinding({ origem: "regra", evidencia: "texto que não existe no documento" });
  const { kept } = filterGroundedFindings([finding], gateDoc);
  assert.equal(kept.length, 1);
});

check("robustez a hifenização do pdfjs (serviço ↔ ser viço)", () => {
  const doc = {
    pages: [{ page: 1, text: "A torneira de ser viço fica próxima ao depósito." }],
    text: "A torneira de ser viço fica próxima ao depósito.",
    pageCount: 1,
    charCount: 48,
  };
  const finding = mkFinding({ origem: "ia", evidencia: "torneira de serviço", termo_busca: "torneira de serviço" });
  const { kept } = filterGroundedFindings([finding], doc);
  assert.equal(kept.length, 1, "deve ancorar apesar do espaço inserido pela extração");
});

// --- 8. Agrupamento de impacto (calibração) -----------------------------------
check("achado de redação com 'Calculo' na evidência é editorial, não técnico", () => {
  const finding = mkFinding({
    origem: "ia",
    tipo: "erro de redação/acentuação",
    categoria: "redação/formatação",
    local: "Sumário",
    evidencia: "10.3.3 Calculo do volume do reservatório",
    conflito: "Uso de 'Calculo' sem acento em título de seção.",
  });
  assert.equal(classifyFindingImpact(finding), "revisao_editorial");
});

check("hierarquia documental é técnico/contratual", () => {
  const finding = mkFinding({
    tipo: "Hierarquia documental contraditória",
    local: "regra de prevalência entre documentos",
    conflito: "projetos prevalecem x especificações prevalecem",
  });
  assert.equal(classifyFindingImpact(finding), "tecnico_contratual");
});

check("nome de obra divergente é crítico documental", () => {
  const finding = mkFinding({
    tipo: "Nome de obra/unidade divergente no mesmo documento",
    local: "nome da obra/unidade",
    conflito: "diverge da obra dominante",
  });
  assert.equal(classifyFindingImpact(finding), "critico_documental");
});

// --- 9. Supressão de ruído (calibração) ---------------------------------------
check("suprime artefato de extração 'ser viço'", () => {
  const doc = {
    pages: [{ page: 1, text: "A torneira de ser viço fica no depósito. Nos banheiros há torneira de serviço cromada." }],
    text: "A torneira de ser viço fica no depósito. Nos banheiros há torneira de serviço cromada.",
    pageCount: 1,
    charCount: 90,
  };
  const finding = mkFinding({
    origem: "ia",
    tipo: "Redação/formatação",
    termo_busca: "Torneira de ser viço",
    evidencia: "7.14.3.3 Torneira de ser viço",
  });
  const { kept, suppressed } = filterGroundedFindings([finding], doc);
  assert.equal(kept.length, 0);
  assert.equal(suppressed.length, 1);
});

check("NÃO suprime typo real 'Frânces'", () => {
  const doc = {
    pages: [{ page: 1, text: "4.4 Execução Drenagem Frânces conforme projeto." }],
    text: "4.4 Execução Drenagem Frânces conforme projeto.",
    pageCount: 1,
    charCount: 47,
  };
  const finding = mkFinding({
    origem: "ia",
    tipo: "Redação / grafia técnica",
    termo_busca: "Drenagem Frânces",
    evidencia: "4.4 Execução Drenagem Frânces",
  });
  const { kept, suppressed } = filterGroundedFindings([finding], doc);
  assert.equal(suppressed.length, 0);
  assert.equal(kept.length, 1);
});

check("suprime meta-achado sobre a mecânica da auditoria", () => {
  const doc = {
    pages: [{ page: 1, text: "9 PROJETO ESTRUTURAL DE CONCRETO 91" }],
    text: "9 PROJETO ESTRUTURAL DE CONCRETO 91",
    pageCount: 1,
    charCount: 35,
  };
  const finding = mkFinding({
    origem: "ia",
    tipo: "inconsistência de paginação/escopo do trecho auditado",
    conflito: "A página auditada não contém o texto técnico do capítulo informado, mas apenas sua chamada no sumário.",
    termo_busca: "9 PROJETO ESTRUTURAL DE CONCRETO",
  });
  const { kept, suppressed } = filterGroundedFindings([finding], doc);
  assert.equal(kept.length, 0);
  assert.equal(suppressed.length, 1);
});

check("achado que só menciona 'identidade' na prosa NÃO vira crítico", () => {
  const finding = mkFinding({
    origem: "ia",
    tipo: "Trecho reaproveitado / norma suspeita",
    categoria: "coerência técnica",
    local: "Título do capítulo",
    conflito: "a identidade documental indicada é de centro comunitário",
    evidencia: "Instruções de Serviço do DNIT 105/2009",
  });
  assert.notEqual(classifyFindingImpact(finding), "critico_documental");
});

check("suprime artefato de extração de 1 letra 'p eças'", () => {
  const doc = {
    pages: [{ page: 1, text: "divergências em p eças gráficas. As peças gráficas do projeto." }],
    text: "divergências em p eças gráficas. As peças gráficas do projeto.",
    pageCount: 1,
    charCount: 60,
  };
  const finding = mkFinding({
    origem: "ia",
    tipo: "redação/formatação",
    termo_busca: "p eças gráficas",
    evidencia: "em p eças gráficas",
  });
  const { kept, suppressed } = filterGroundedFindings([finding], doc);
  assert.equal(kept.length, 0);
  assert.equal(suppressed.length, 1);
});

console.log(`\n${passed} teste(s) passaram.`);
