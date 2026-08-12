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
  isLocalityPhrase,
  runCrossDocumentRules,
  runWithinDocumentIdentityRules,
  type CrossDocumentSource,
} from "../lib/cross-document-audit.ts";
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";
import { filterGroundedFindings, isMetaAuditFinding } from "../lib/audit-verify.ts";
import {
  classifyFindingDiscipline,
  classifyFindingErrorType,
  classifyFindingImpact,
  classifyFindingTier,
  getEmissionVerdict,
  getFindingAssurance,
  makeTextReport,
  parseFindingImpact,
  withFindingImpact,
  type AuditFinding,
  type AuditReport,
} from "../lib/audit-report.ts";

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

// --- 5.1 Gabarito (item 1: obra declarada como baseline) ----------------------
check("gabarito: usa a obra declarada como baseline e ainda pega os reaproveitados", () => {
  const findings = runWithinDocumentIdentityRules(makePrimeiraLinhaDoc(), {
    gabaritoObra: "Centro Comunitário Primeira Linha",
  });
  const nomes = findings.map((f) => f.termo_busca ?? "");
  assert.ok(nomes.some((n) => /Cidade do Autista/i.test(n)));
  assert.ok(nomes.some((n) => /Centro Dia do Idoso/i.test(n)));
  // com gabarito, a referência comparada aponta o gabarito, não "dominante"
  assert.ok(
    findings.every((f) => /gabarito/i.test(f.referencia_comparada ?? "")),
    "referência deve citar o gabarito",
  );
});

check("gabarito × documento: acusa quando o arquivo é de outra obra", () => {
  const findings = runWithinDocumentIdentityRules(makePrimeiraLinhaDoc(), {
    gabaritoObra: "Escola Municipal Professor Fulano",
  });
  assert.ok(
    findings.some((f) => /diverge da obra declarada/i.test(f.tipo)),
    "deveria acusar que o documento não corresponde à obra declarada",
  );
});

check("gabarito: documento coerente com a obra declarada não gera achado", () => {
  const limpo = makeSource("ok.pdf", "memorial", [
    "Obra: Centro Comunitário Primeira Linha, em Criciúma.",
    "O Centro Comunitário Primeira Linha terá salão de festas.",
    "Projeto do Centro Comunitário Primeira Linha.",
  ]);
  assert.equal(
    runWithinDocumentIdentityRules(limpo, { gabaritoObra: "Centro Comunitário Primeira Linha" }).length,
    0,
  );
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

// --- 6.1 Área total construída divergente (item 6) ----------------------------
check("acusa área total construída divergente no mesmo documento", () => {
  const doc = makeSource("memorial.pdf", "memorial", [
    "A área total construída da edificação é de 1.250,00 m².",
    "Conforme quadro, a área total construída totaliza 1.480,00 m².",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  const area = findings.filter((f) => f.tipo.includes("Área total construída divergente"));
  assert.equal(area.length, 1, "esperava 1 achado de área divergente");
  assert.equal(area[0].impacto, "critico_documental");
  assert.equal(area[0].origem, "regra");
});

check("NÃO acusa quando a área total repete o mesmo valor", () => {
  const doc = makeSource("ok.pdf", "memorial", [
    "A área total construída é de 850,00 m².",
    "Reforçando: a área total construída é de 850,00 m².",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  assert.equal(findings.filter((f) => f.tipo.includes("Área total")).length, 0);
});

check("NÃO confunde área por ambiente com área total", () => {
  const doc = makeSource("ok.pdf", "memorial", [
    "Sala 1 possui área de 25,00 m² e a Sala 2 possui área de 40,00 m².",
    "A área total construída é de 850,00 m².",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  assert.equal(
    findings.filter((f) => f.tipo.includes("Área total")).length,
    0,
    "áreas por ambiente não podem disparar o achado de área total",
  );
});

check("NÃO confunde limite normativo de incêndio com área da obra (caso 017-26)", () => {
  // pdfjs entrega a página inteira como uma "linha" só; a página do PPCI cita a
  // área real (256,41 m²) E o limite da norma ("superior a 1.000 m²"). Só a área
  // real deve contar — o 1.000 é threshold, não área da obra.
  const doc = makeSource("017.pdf", "memorial", [
    "A edificação possui área total construída de 256,41 m², compreendendo a edificação principal e as estruturas de apoio.",
    "ocupação subsidiária depósito com área total superior a 1.000 m² (mil metros quadrados); a área total da edificação foi considerada para os cálculos.",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  assert.equal(
    findings.filter((f) => f.tipo.includes("Área total")).length,
    0,
    "o limite normativo de 1.000 m² não pode virar falso positivo de área divergente",
  );
});

// --- 6.2 Concessionária fora da microrregião (item 7) -------------------------
check("acusa concessionária (COOPERA) fora da microrregião do município", () => {
  const doc = makeSource("eletrico.pdf", "memorial", [
    "Prefeitura Municipal de Criciúma. Memorial do projeto elétrico.",
    "O padrão de entrada seguirá as normas da concessionária COOPERA.",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  const util = findings.filter((f) => f.tipo.includes("Concessionária de energia fora"));
  assert.equal(util.length, 1, "esperava 1 ponto de checagem de concessionária");
  assert.equal(util[0].confianca, "baixa", "é ponto de checagem, não erro certo");
});

check("NÃO acusa concessionária correta para o município", () => {
  const doc = makeSource("eletrico.pdf", "memorial", [
    "Prefeitura Municipal de Forquilhinha. Memorial elétrico.",
    "O padrão de entrada seguirá as normas da concessionária COOPERA.",
  ]);
  const findings = runDocumentCoherenceRules(doc);
  assert.equal(findings.filter((f) => f.tipo.includes("Concessionária")).length, 0);
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

check("suprime meta-achado que reclama de auditar a partir do sumário (caso real)", () => {
  const finding = mkFinding({
    origem: "ia",
    tipo: "inconsistência de recorte/hierarquia documental",
    conflito:
      "Não é possível auditar coerência técnica, normas, cálculos ou redação do capítulo 11 com base apenas no sumário da página 7.",
    sugestao_correcao:
      "Disponibilizar ou revisar o recorte correspondente ao conteúdo real do capítulo 11.",
    termo_busca: "11 PROJETO PREVENTIVO CONTRA INCÊNDIO",
  });
  assert.equal(isMetaAuditFinding(finding), true, "meta-achado de recorte/sumário deve ser suprimido");
});

check("NÃO suprime achado técnico real que menciona a palavra sumário", () => {
  const finding = mkFinding({
    origem: "ia",
    tipo: "cálculo incoerente",
    conflito: "A soma das áreas do quadro difere do total apresentado no sumário de áreas.",
    sugestao_correcao: "Revisar o quadro de áreas e o total.",
    termo_busca: "quadro de áreas",
  });
  assert.equal(isMetaAuditFinding(finding), false, "achado técnico legítimo não pode ser confundido com meta");
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

// --- 10. Veredito de emissão e selo de confiança (itens 12 e 4) ---------------
function mkReportFinding(partial: Partial<AuditFinding>): AuditFinding {
  return {
    id: "T-001",
    prioridade: "Media",
    pagina: "1",
    capitulo: "cap",
    local: "local",
    tipo: "tipo",
    descricao: "desc",
    evidencia: "ev",
    conflito: "conf",
    sugestao_correcao: "corrigir",
    confianca: "media",
    ...partial,
  };
}

check("veredito 🔴 NÃO EMITIR quando há achado crítico documental", () => {
  const verdict = getEmissionVerdict([
    mkReportFinding({ impacto: "critico_documental", tipo: "Nome de obra divergente" }),
  ]);
  assert.equal(verdict.emoji, "🔴");
  assert.match(verdict.label, /NÃO EMITIR/);
});

check("veredito 🟡 REVISAR quando só há ponto técnico/contratual", () => {
  const verdict = getEmissionVerdict([
    mkReportFinding({ impacto: "tecnico_contratual", tipo: "Hierarquia documental" }),
  ]);
  assert.equal(verdict.emoji, "🟡");
});

check("veredito 🟢 LIBERADO quando não há achado", () => {
  const verdict = getEmissionVerdict([]);
  assert.equal(verdict.emoji, "🟢");
  assert.match(verdict.label, /LIBERADO/);
});

check("selo de confiança distingue regra (verificado) de IA (sugerido)", () => {
  assert.match(getFindingAssurance(mkReportFinding({ origem: "regra" })), /Verificado/);
  assert.match(getFindingAssurance(mkReportFinding({ origem: "ia" })), /Sugerido/);
});

check("camada: regra é principal, IA baixa/rebaixada é sugestão", () => {
  assert.equal(classifyFindingTier(mkReportFinding({ origem: "regra", confianca: "baixa" })), "principal");
  assert.equal(classifyFindingTier(mkReportFinding({ origem: "ia", confianca: "alta" })), "principal");
  assert.equal(classifyFindingTier(mkReportFinding({ origem: "ia", confianca: "baixa" })), "sugestao");
  assert.equal(classifyFindingTier(mkReportFinding({ origem: "ia", tier: "sugestao", confianca: "alta" })), "sugestao");
});

check("veredito ignora sugestões da IA (não acende o semáforo sozinho)", () => {
  const onlySuggestion = [
    mkReportFinding({ origem: "ia", tier: "sugestao", impacto: "critico_documental", confianca: "baixa" }),
  ];
  const principal = onlySuggestion.filter((f) => classifyFindingTier(f) === "principal");
  assert.equal(getEmissionVerdict(principal).emoji, "🟢", "só sugestão não pode virar 🔴");
});

check("makeTextReport monta veredito, selo e seção diferencial", () => {
  const report: AuditReport = {
    tipo_auditoria: "memorial",
    tipo_documento: "memorial",
    obra: "Centro Comunitário Primeira Linha",
    codigo: "017_26",
    municipio: "Criciúma",
    data_documento: "2026",
    status_analise: "concluida",
    status_geral: "com inconsistências críticas",
    total_incongruencias: 1,
    arquivos_analisados: [{ arquivo: "memorial.pdf", tipo_documento: "memorial", resumo: "ok" }],
    comparacoes: [],
    incongruencias: [
      mkReportFinding({
        id: "IDENT-001",
        origem: "regra",
        impacto: "critico_documental",
        tipo: "Nome de obra/unidade divergente no mesmo documento",
      }),
    ],
    conclusao: "revisar",
  };
  const text = makeTextReport(report);
  assert.match(text, /0\. Veredito de emissão/);
  assert.match(text, /🔴 NÃO EMITIR/);
  assert.match(text, /5\.1 O que só o Nexodoc encontra/);
  assert.match(text, /Verificação: ✔ Verificado/);
});

// --- 11. Classificação por disciplina e tipo de erro (filtros) ---------------
check("disciplina: PPCI, hidro, elétrico, paisagismo, geral", () => {
  assert.equal(classifyFindingDiscipline(mkReportFinding({ tipo: "Contradição de exigências de segurança contra incêndio", categoria: "PPCI" })), "ppci");
  assert.equal(classifyFindingDiscipline(mkReportFinding({ tipo: "Erro de reservatório", categoria: "hidrossanitário" })), "hidrossanitario");
  assert.equal(classifyFindingDiscipline(mkReportFinding({ tipo: "Quadro geral de proteção QGP", categoria: "projeto elétrico" })), "eletrico");
  assert.equal(classifyFindingDiscipline(mkReportFinding({ tipo: "Inconsistência de nomenclatura botânica", categoria: "Paisagismo" })), "paisagismo");
  assert.equal(classifyFindingDiscipline(mkReportFinding({ tipo: "Hierarquia documental contraditória", categoria: "Condições gerais" })), "geral");
});

check("tipo de erro: identidade, norma, quantitativo, escopo, especificação", () => {
  assert.equal(classifyFindingErrorType(mkReportFinding({ tipo: "Nome de obra/unidade divergente no mesmo documento", categoria: "nome da obra/unidade" })), "identidade");
  assert.equal(classifyFindingErrorType(mkReportFinding({ tipo: "Referência normativa desatualizada", categoria: "Normas técnicas" })), "norma");
  assert.equal(classifyFindingErrorType(mkReportFinding({ tipo: "Área total construída divergente", categoria: "Quantitativos e áreas" })), "quantitativo");
  assert.equal(classifyFindingErrorType(mkReportFinding({ tipo: "Responsabilidade de terraplenagem divergente", categoria: "Escopo / responsabilidades" })), "escopo");
  assert.equal(classifyFindingErrorType(mkReportFinding({ tipo: "Contradição de material", categoria: "Especificação de materiais" })), "especificacao");
});

// --- 12. Revisão de 12/08/2026: parar de esconder achado -----------------------
// Cada teste abaixo trava uma perda medida na comparação com auditoria externa
// do 063_26_md_geral_a.pdf. Ver lib/auditor-prompt.ts para o contexto completo.

check("localidade em frase técnica NÃO é nome de obra (falso positivo nº 1 do 063-26)", () => {
  assert.equal(isLocalityPhrase("cidade de Criciúma"), true);
  assert.equal(isLocalityPhrase("Município de Içara"), true);
  assert.equal(isLocalityPhrase("distrito do Rio Maina"), true);
  // "Cidade" é ambíguo e a CAIXA decide: existe a obra real "Cidade do Autista".
  assert.equal(isLocalityPhrase("Cidade do Autista"), false);
  assert.equal(isLocalityPhrase("Cidade Alta"), false);
  assert.equal(isLocalityPhrase("Centro Comunitário Primeira Linha"), false);
  assert.equal(isLocalityPhrase("Reforma da Cancha de Bocha"), false);
});

check("gabarito x documento: localidade não gera achado, obra estranha gera (063-26 real)", () => {
  // Trechos literais do 063_26_md_geral_a.pdf. Antes do conserto a regra
  // devolvia 2 achados: a página 56 (real) e a página 38 (falso positivo).
  const source = makeSource("063_26_md_geral_a.pdf", "memorial", [
    "REFORMA DA CANCHA DE BOCHA DO PARQUE DOS IMIGRANTES - CRICIUMA/SC",
    "localizado na edificação Cancha de Bocha, na cidade de Criciúma/SC . O objetivo deste documento é discriminar especificações, detalhamentos e serviços para a Estrutura em Concreto",
    "Da Classificação quanto a Ocupação O imóvel Centro Comunitário Primeira Linha , localizado no município de Criciúma – Santa Catarina, foi classificada quanto a sua ocupação",
  ]);

  const findings = runWithinDocumentIdentityRules(source, {
    gabaritoObra: "Reforma da Cancha de Bocha do Parque dos Imigrantes",
  });

  assert.equal(
    findings.some((finding) => /cidade de Criciúma/i.test(finding.termo_busca ?? "")),
    false,
    "localidade em frase corrente não pode virar achado de identidade",
  );
  assert.equal(
    findings.some((finding) => /Centro Comunitário Primeira Linha/i.test(finding.termo_busca ?? "")),
    true,
    "resíduo real de outro projeto tem de continuar sendo pego",
  );
});

check("impacto declarado pelo modelo tem precedência sobre a heurística", () => {
  // tipo/categoria puxariam para editorial; o modelo leu o achado inteiro e disse crítico
  const finding = mkReportFinding({
    tipo: "Duplicação de parágrafo",
    categoria: "redação",
    impacto: "critico_documental",
  });
  assert.equal(classifyFindingImpact(finding), "critico_documental");
});

check("impacto inválido cai na heurística em vez de quebrar", () => {
  const finding = mkReportFinding({
    tipo: "Referência normativa desatualizada",
    categoria: "Normas técnicas",
    impacto: "urgentissimo" as never,
  });
  assert.equal(classifyFindingImpact(finding), "tecnico_contratual");
  assert.equal(parseFindingImpact("urgentissimo"), undefined);
  assert.equal(parseFindingImpact("Critico Documental"), "critico_documental");
});

check("campo não preenchido (XXXX) é crítico, não editorial", () => {
  // Antes caía no fallback e virava revisao_editorial: foi assim que os seis
  // XXXX da página 6 do 063-26 sumiram do topo do relatório.
  const finding = mkReportFinding({
    tipo: "Documento não finalizado",
    categoria: "completude documental",
    evidencia: "“área total do terreno é de XXXX m²”; “área construída de XXXX m²”",
  });
  assert.equal(classifyFindingImpact(finding), "critico_documental");
});

check("marcador de template vence a faixa declarada pelo modelo", () => {
  // Medido no 063-26: o modelo achou os seis XXXX e os chamou de técnico.
  const finding = mkReportFinding({
    tipo: "Campos de template não preenchidos",
    categoria: "completude documental",
    evidencia: "“A área total do terreno é de XXXX m²”; “uma área construída de XXXX m²”",
    impacto: "tecnico_contratual",
  });
  assert.equal(classifyFindingImpact(finding), "critico_documental");
  // e a sobreposição precisa CHEGAR ao agrupamento, não morrer na função
  assert.equal(withFindingImpact(finding).impacto, "critico_documental");
});

check("achado que só FALA de preenchimento não sobe de faixa", () => {
  // sem marcador literal na evidência, a declaração do modelo continua valendo
  const finding = mkReportFinding({
    tipo: "Campo a confirmar",
    categoria: "completude documental",
    evidencia: "O responsável deve preencher a matrícula do imóvel antes da emissão.",
    impacto: "tecnico_contratual",
  });
  assert.equal(classifyFindingImpact(finding), "tecnico_contratual");
});

check("aritmética da carga de incêndio: pega linha errada e total que não fecha", () => {
  // Números literais da página 58 do 063-26.
  const doc = {
    pages: [
      {
        page: 58,
        text:
          "Material Massa mi [kg] Potencial calorífico específico Hi [MJ/kg] Potencial calorífico por material mi x Hi [MJ] " +
          "Carpete da cancha de bocha (poliéster) 99,27 27 2862 Madeira (Cabos de vassouras) 2 19 19 " +
          "Algodão (Panos de limpeza) 1 18 18 Papel (Estoque de papel toalha) 3 17 17 " +
          "Polipropileno/Plástico (Baldes) 5 43 43 Álcool Etílico (Desinfetantes) 5 25 125 " +
          "Valor total do potencial calorífico [MJ]: 3.309 Área considerada para cálculo [m²]: 846,90 " +
          "Carga de incêndio específica [MJ/m²]: 3,91",
      },
    ],
    text: "",
    pageCount: 1,
    charCount: 600,
  };
  doc.text = doc.pages[0].text;

  const findings = runDocumentCoherenceRules({
    fileName: "063_26_md_geral_a.pdf",
    fileType: "memorial",
    extracted: doc,
  }).filter((finding) => /carga de inc/i.test(finding.tipo));

  assert.equal(findings.length, 1, "a tabela que não fecha tem de virar achado");
  assert.equal(findings[0].impacto, "critico_documental");
  // as quatro linhas erradas e os dois totais têm de estar no conflito
  assert.match(findings[0].conflito, /4 linha\(s\)/);
  assert.match(findings[0].conflito, /3\.084/);
  assert.match(findings[0].conflito, /3\.309/);
  assert.match(findings[0].conflito, /3\.127,29/);
  assert.match(findings[0].conflito, /3,69 MJ\/m²/);
});

check("aritmética: tabela que FECHA não gera achado", () => {
  const doc = {
    pages: [
      {
        page: 10,
        text:
          "Material Massa mi [kg] Potencial calorífico específico Hi [MJ/kg] Potencial calorífico mi x Hi [MJ] " +
          "Madeira 2 19 38 Papel 3 17 51 " +
          "Valor total do potencial calorífico [MJ]: 89 Área considerada para cálculo [m²]: 100,00",
      },
    ],
    text: "",
    pageCount: 1,
    charCount: 200,
  };
  doc.text = doc.pages[0].text;

  const findings = runDocumentCoherenceRules({
    fileName: "ok.pdf",
    fileType: "memorial",
    extracted: doc,
  }).filter((finding) => /carga de inc/i.test(finding.tipo));

  assert.equal(findings.length, 0, "tabela correta não pode gerar falso positivo");
});

check("norma desatualizada continua técnica, não crítica", () => {
  // O pedido é classificar melhor o excesso, não promover tudo a bloqueador.
  const finding = mkReportFinding({
    tipo: "Edições normativas divergentes",
    categoria: "compatibilização normativa",
    evidencia: "“ABNT NBR 7199:2016” e “ABNT NBR 7199:2025”",
  });
  assert.equal(classifyFindingImpact(finding), "tecnico_contratual");
});

check("sumário incompatível com o corpo NÃO é suprimido como meta-achado", () => {
  const finding = mkFinding({
    origem: "ia",
    tipo: "Sumário incompatível com o corpo do documento",
    conflito:
      "O sumário lista o capítulo 1 como Projeto Elétrico, mas o capítulo 1 do corpo é Apresentação; as páginas indicadas estão deslocadas.",
    sugestao_correcao: "Regerar o sumário a partir dos capítulos reais do documento.",
    termo_busca: "1 PROJETO ELÉTRICO",
  });
  assert.equal(isMetaAuditFinding(finding), false);
});

console.log(`\n${passed} teste(s) passaram.`);
