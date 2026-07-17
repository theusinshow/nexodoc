/**
 * Suíte de precisão/recall dos motores DETERMINÍSTICOS da auditoria.
 *
 *   node scripts/audit-precision-recall.ts
 *   (também exposto como `npm run test:audit:metrics`)
 *
 * Por que existe: "mais assertivo que o ChatGPT" precisa ser NÚMERO, não opinião.
 * Este harness roda os motores sem IA (runWithinDocumentIdentityRules,
 * runCrossDocumentRules, runDocumentCoherenceRules) contra fixtures rotuladas:
 *   - casos POSITIVOS: têm erro conhecido -> mede RECALL (achou o que devia?);
 *   - casos LIMPOS: sem erro -> qualquer achado é falso positivo -> mede PRECISÃO.
 * Sai precisão, recall e F1. Regressão de qualidade vira falha objetiva.
 *
 * Regra do harness: fixtures positivas declaram TODOS os achados esperados. Achado
 * previsto que não casa com nenhum esperado conta como falso positivo — então
 * calibre a fixture, não afrouxe o matcher.
 */
import {
  runCrossDocumentRules,
  runWithinDocumentIdentityRules,
  type CrossDocumentSource,
} from "../lib/cross-document-audit.ts";
import { runDocumentCoherenceRules } from "../lib/audit-coherence.ts";
import type { AuditFinding } from "../lib/audit-report.ts";

function makeSource(fileName: string, fileType: string, pages: string[]): CrossDocumentSource {
  const extractedPages = pages.map((text, index) => ({ page: index + 1, text }));
  return {
    fileName,
    fileType,
    extracted: {
      pages: extractedPages,
      text: extractedPages.map((p) => `--- PAGINA ${p.page} ---\n${p.text}`).join("\n\n"),
      pageCount: extractedPages.length,
      charCount: extractedPages.reduce((total, p) => total + p.text.length, 0),
    },
  };
}

function norm(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** roda TODOS os motores determinísticos sobre um conjunto de documentos */
function runDeterministic(sources: CrossDocumentSource[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const source of sources) {
    findings.push(...runWithinDocumentIdentityRules(source));
    findings.push(...runDocumentCoherenceRules({ fileName: source.fileName, fileType: source.fileType, extracted: source.extracted }));
  }
  findings.push(...runCrossDocumentRules(sources).findings);
  return findings;
}

type Expected = { label: string; needle: string };
type Case = {
  name: string;
  sources: CrossDocumentSource[];
  expected: Expected[];
};

const rodape = "PREFEITURA MUNICIPAL DE CRICIUMA - 017_26 - CENTRO COMUNITARIO PRIMEIRA LINHA - PROJETO EXECUTIVO";

const CASES: Case[] = [
  // --- POSITIVOS ---------------------------------------------------------------
  {
    name: "memorial real: 4 identidades reaproveitadas",
    sources: [
      makeSource("017_26.pdf", "memorial", [
        `Obra: Centro Comunitario Primeira Linha, no municipio de Criciuma. ${rodape}`,
        `O projeto do Centro Comunitario Primeira Linha atende eventos. ${rodape}`,
        `Os documentos servirao de referencia para a construcao da Cidade do Autista. ${rodape}`,
        `Terraplenagem do Centro Comunitario Primeira Linha. ${rodape}`,
        `Este memorial descreve o PPCI para a Reforma e Adequacao - Centro Dia do Idoso. ${rodape}`,
        `A ocupacao da Reforma e Adequacao - Centro Dia do Idoso e Salao de festa. ${rodape}`,
        `Por se tratar de uma unidade basica de saude os calculos das portas ficam assim. ${rodape}`,
        `Como o imovel Reforma Centro Comunitario Boa Vista possui pouca luz. ${rodape}`,
        `Projeto eletrico do Centro Comunitario Primeira Linha. ${rodape}`,
      ]),
    ],
    expected: [
      { label: "Cidade do Autista", needle: "cidade do autista" },
      { label: "Centro Dia do Idoso", needle: "centro dia do idoso" },
      { label: "unidade basica de saude", needle: "unidade basica de saude" },
      { label: "Centro Comunitario Boa Vista", needle: "boa vista" },
    ],
  },
  {
    name: "cross-doc: municipio divergente capa x memorial",
    sources: [
      makeSource("capa.pdf", "capa", ["Prefeitura Municipal de Criciuma. Endereco: Rua Joao Pinto, 100."]),
      makeSource("memorial.pdf", "memorial", ["Prefeitura Municipal de Chapeco.", "Memorial da Prefeitura Municipal de Chapeco."]),
    ],
    expected: [{ label: "municipio divergente", needle: "chapeco" }],
  },
  {
    name: "coerencia: hierarquia documental contraditoria",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "Em caso de divergencia entre as especificacoes e os projetos, sempre prevalecerao os projetos.",
        "Texto intermediario qualquer.",
        "As especificacoes tecnicas e normas de execucao citadas neste memorial prevalecerao sobre todos os projetos.",
      ]),
    ],
    expected: [{ label: "hierarquia contraditoria", needle: "prevalecerao sobre todos os projetos" }],
  },
  {
    name: "numerico: area total construida divergente",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "A area total construida da edificacao e de 1.250,00 m².",
        "Conforme quadro, a area total construida totaliza 1.480,00 m².",
      ]),
    ],
    expected: [{ label: "area total divergente", needle: "1.250,00 m²" }],
  },
  {
    name: "concessionaria: COOPERA fora da microrregiao (Criciuma)",
    sources: [
      makeSource("eletrico.pdf", "memorial", [
        "Prefeitura Municipal de Criciuma. Memorial do projeto eletrico.",
        "O padrao de entrada seguira as normas da concessionaria COOPERA.",
      ]),
    ],
    expected: [{ label: "concessionaria fora de area", needle: "coopera" }],
  },

  // --- LIMPOS (sem erro; qualquer achado = falso positivo) ---------------------
  {
    name: "LIMPO: memorial coerente (so Primeira Linha)",
    sources: [
      makeSource("ok.pdf", "memorial", [
        "Obra: Centro Comunitario Primeira Linha, em Criciuma.",
        "O Centro Comunitario Primeira Linha tera salao de festas.",
        "Projeto do Centro Comunitario Primeira Linha, Criciuma.",
        "Estrutura do Centro Comunitario Primeira Linha.",
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: dois documentos que concordam no municipio",
    sources: [
      makeSource("capa.pdf", "capa", ["Municipio: Sao Paulo"]),
      makeSource("memorial.pdf", "memorial", ["Municipio: Sao Paulo"]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: area total repetida com mesmo valor",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "A area total construida e de 850,00 m².",
        "Reforcando: a area total construida e de 850,00 m².",
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: concessionaria correta para o municipio",
    sources: [
      makeSource("eletrico.pdf", "memorial", [
        "Prefeitura Municipal de Forquilhinha. Memorial eletrico.",
        "O padrao de entrada seguira as normas da concessionaria COOPERA.",
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: limite normativo de incendio nao e area da obra (regressao 017-26)",
    sources: [
      makeSource("017.pdf", "memorial", [
        "A edificacao possui area total construida de 256,41 m², compreendendo a edificacao principal.",
        "ocupacao subsidiaria deposito com area total superior a 1.000 m² (mil metros quadrados); a area total da edificacao foi considerada.",
      ]),
    ],
    expected: [],
  },
];

// --- avaliação ----------------------------------------------------------------
function findingMatches(finding: AuditFinding, needle: string) {
  const haystack = norm(
    [finding.termo_busca, finding.descricao, finding.conflito, finding.evidencia, finding.tipo].join(" "),
  );
  return haystack.includes(norm(needle));
}

let truePositives = 0;
let falseNegatives = 0;
let falsePositives = 0;
const failures: string[] = [];

console.log("suite de precisao/recall — motores deterministicos\n");

for (const testCase of CASES) {
  const findings = runDeterministic(testCase.sources);
  const matchedFindingIds = new Set<string>();

  // recall: cada esperado precisa ter ao menos 1 achado correspondente
  for (const exp of testCase.expected) {
    const hit = findings.find((f) => findingMatches(f, exp.needle));
    if (hit) {
      truePositives += 1;
      matchedFindingIds.add(hit.id);
    } else {
      falseNegatives += 1;
      failures.push(`  FN  ${testCase.name} :: nao achou "${exp.label}"`);
    }
  }

  // precisao: achado que nao casa com nenhum esperado é falso positivo
  for (const f of findings) {
    const explained =
      matchedFindingIds.has(f.id) || testCase.expected.some((exp) => findingMatches(f, exp.needle));
    if (!explained) {
      falsePositives += 1;
      failures.push(`  FP  ${testCase.name} :: achado inesperado [${f.id}] ${f.tipo} — "${f.termo_busca ?? f.descricao}"`);
    }
  }

  const status = testCase.expected.length === 0 ? "LIMPO" : `${testCase.expected.length} esperado(s)`;
  console.log(`  ${testCase.name}  (${status}) -> ${findings.length} achado(s)`);
}

const precision = truePositives + falsePositives === 0 ? 1 : truePositives / (truePositives + falsePositives);
const recall = truePositives + falseNegatives === 0 ? 1 : truePositives / (truePositives + falseNegatives);
const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

console.log("\n--- resultado ---");
if (failures.length > 0) {
  console.log(failures.join("\n"));
}
console.log(
  `\nTP=${truePositives}  FP=${falsePositives}  FN=${falseNegatives}` +
    `\nPrecisao: ${(precision * 100).toFixed(1)}%` +
    `\nRecall:   ${(recall * 100).toFixed(1)}%` +
    `\nF1:       ${(f1 * 100).toFixed(1)}%`,
);

// limiar de regressão: motor determinístico deve ficar alto nos dois eixos
const MIN_PRECISION = 0.9;
const MIN_RECALL = 0.9;

if (precision < MIN_PRECISION || recall < MIN_RECALL) {
  console.error(
    `\nFALHA: precisao/recall abaixo do limiar (min ${MIN_PRECISION * 100}% / ${MIN_RECALL * 100}%).`,
  );
  process.exit(1);
}

console.log("\nOK — dentro do limiar de qualidade.");
