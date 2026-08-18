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

/**
 * Uma página do fixture: só texto, ou texto com as tabelas já reconstruídas.
 *
 * A grade em si é provada em `test:tabela-do-pdf` e `prova:tabela-do-pdf`. Aqui
 * ela entra pronta, porque o que este harness mede é a REGRA — não a geometria.
 */
type PaginaDeTeste =
  | string
  | { texto: string; tabelas?: { pagina: number; linhas: string[][] }[] };

function makeSource(
  fileName: string,
  fileType: string,
  pages: PaginaDeTeste[],
): CrossDocumentSource {
  const extractedPages = pages.map((entrada, index) => {
    const page = index + 1;
    if (typeof entrada === "string") return { page, text: entrada };
    return {
      page,
      text: entrada.texto,
      ...(entrada.tabelas ? { tabelas: entrada.tabelas } : {}),
    };
  });
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
    /*
     * O caso real do 117_25 (p.101 x p.104), com os numeros como estao no
     * memorial. O modelo perdeu este achado nas TRES corridas Deep; a regra o
     * pega sempre. Agua: 1.230 L/dia. Efluente: 59 x 50 = 2.950 L/dia — 2,4x.
     */
    name: "numerico: contribuicao de esgoto acima do consumo de agua",
    sources: [
      makeSource("hidro.pdf", "memorial", [
        "TABELA DE CONSUMO DIARIO DE AGUA POTAVEL. Total Consumo 1230. " +
          "Para a tabela acima chegamos ao valor de um consumo diario de 1.230 Litros.",
        "Dimensionamento Filtro anaerobio. Dados: lv = 1,60; N = 59 pessoas; " +
          "q = 50 L/un/dia; T = 0,92 dias.",
      ]),
    ],
    expected: [{ label: "esgoto acima da agua", needle: "2.950 L/dia" }],
  },
  {
    /*
     * LIMPO: as duas bases conversam. 59 x 20 = 1.180 L/dia contra 1.230 L/dia
     * de consumo — o efluente e MENOR que a agua, que e o esperado. Sem este
     * caso a regra poderia disparar em todo memorial que dimensiona efluente.
     */
    name: "LIMPO: esgoto compativel com o consumo de agua",
    sources: [
      makeSource("hidro-ok.pdf", "memorial", [
        "Para a tabela acima chegamos ao valor de um consumo diario de 1.230 Litros.",
        "Dados: N = 59 pessoas; q = 20 L/un/dia; T = 0,92 dias.",
      ]),
    ],
    expected: [],
  },
  {
    /* O caso real do 117_25 (cap. 14): oxido nitroso nos postos, sem central. */
    name: "escopo: gas medicinal com posto e sem central dimensionada",
    sources: [
      makeSource("gases.pdf", "memorial", [
        "14.4.3 Postos de utilizacao. Cada posto de utilizacao de oxigenio, oxido nitroso, " +
          "ar ou vacuo, deve ser equipado com uma valvula autovedante.",
        "14.4.5 Dimensionamento das centrais. 14.4.5.1 Oxigenio: serao utilizados 2 cilindros. " +
          "14.4.5.2 Vacuo: a central de vacuo medicinal sera composta por uma bomba. " +
          "14.4.5.3 Ar Comprimido: a central de ar comprimido medicinal tera um compressor.",
      ]),
    ],
    expected: [{ label: "oxido nitroso sem central", needle: "oxido nitroso" }],
  },
  {
    /*
     * LIMPO, e este caso e o que impede a regra de acusar todo memorial de
     * gases: a tabela de cores da NBR 12188 lista os SEIS gases da norma,
     * inclusive nitrogenio e gas carbonico, que o projeto nao usa. Ancorar nela
     * em vez de nos postos geraria falso positivo em todo projeto de saude.
     */
    name: "LIMPO: tabela de cores da NBR 12188 nao declara escopo",
    sources: [
      makeSource("gases-ok.pdf", "memorial", [
        "As redes deverao ser identificadas conforme a planilha abaixo (NBR 12188). " +
          "Gas Cor: Ar Comprimido Amarelo; Oxigenio Verde; Vacuo Cinza; " +
          "Oxido Nitroso Azul Marinho; Gas Carbonico Branco; Nitrogenio Preta.",
        "Cada posto de utilizacao de oxigenio ou vacuo deve ser equipado com valvula.",
        "14.4.5 Dimensionamento das centrais. 14.4.5.1 Oxigenio: 2 cilindros. " +
          "14.4.5.2 Vacuo: central de vacuo medicinal com bomba.",
      ]),
    ],
    expected: [],
  },
  {
    /*
     * LIMPO — o falso positivo que a validacao por IA denunciou no 117_25 e a
     * rota descartou por proteger achado de regra. Memorial de obra publica
     * alterna sigla e nome por extenso o tempo todo, e as tres formas abaixo sao
     * a MESMA obra. A regra acusava divergencia em duas delas.
     */
    name: "LIMPO: sigla, nome por extenso e 'Bairro' sao a mesma obra",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "Memorial descritivo da UBS Vila Manaus, Criciuma/SC.",
        "O projeto da Unidade Basica de Saude Vila Manaus tem como objetivo o atendimento em saude.",
        "A Unidade Basica de Saude Bairro Vila Manaus e composta por uma edificacao terrea.",
        "Sistema de gases medicinais para a UBS - Unidade Basica de Saude Vila Manaus Porte 1.",
      ]),
    ],
    expected: [],
  },
  {
    /*
     * O contraponto: a sigla normalizada NAO pode fundir obras diferentes. O
     * nome proprio depois dela e o que distingue, e "Vila Francesa" continua
     * divergindo de "Vila Manaus" — e AUD-001 do benchmark do 117_25.
     */
    name: "identidade: nome proprio diferente ainda diverge, apesar da sigla igual",
    sources: [
      // Cinco mencoes dominantes, e nao duas: a regra so acusa depois de
      // estabelecer baseline claro — guarda deliberada contra ruido em documento
      // que apenas cita varios equipamentos.
      makeSource("memorial.pdf", "memorial", [
        "Memorial descritivo da UBS Vila Manaus, Criciuma/SC.",
        "O projeto da UBS Vila Manaus preve reforma completa da unidade.",
        "A UBS Vila Manaus sera executada conforme projeto aprovado.",
        "As instalacoes da UBS Vila Manaus seguem as normas vigentes.",
        "Servirao de referencia para a construcao da Unidade Basica de Saude Bairro Vila Francesa.",
      ]),
    ],
    expected: [{ label: "Vila Francesa diverge de Vila Manaus", needle: "Vila Francesa" }],
  },
  {
    /*
     * LIMPO — "Suvinil similar", sem o "ou". Dois memoriais do acervo escrevem
     * assim, e os dois eram acusados de fechar a marca. A ressalva esta la.
     */
    name: "LIMPO: ressalva colada na marca, sem o 'ou'",
    sources: [
      makeSource("pintura.pdf", "memorial", [
        "Pintura acrilica, tipo comercial: Branco / Suvinil similar. A superficie devera estar limpa.",
        "Esquadrias em aluminio, tipo comercial: Alcoa ou similar.",
      ]),
    ],
    expected: [],
  },
  {
    /*
     * O contraponto: "cor similar a cor cinza" NAO e ressalva de marca, e uma
     * comparacao. Se ela passasse por ressalva, a regra calaria marca fechada —
     * e marca fechada em obra publica e achado que IMPEDE emitir. Calar e pior
     * que acusar demais.
     */
    name: "marca: comparacao 'similar a' nao vale como ressalva",
    sources: [
      makeSource("pintura2.pdf", "memorial", [
        "Revestimento, tipo comercial: Portobello Linha Bold Cod. 4432. " +
          "Devera ser escolhida uma cor similar a cor cinza indicada em projeto.",
        "Louças, tipo comercial: Deca ou similar.",
      ]),
    ],
    expected: [{ label: "marca fechada", needle: "Portobello" }],
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

  {
    /*
     * AUD-004 do benchmark do 084_25 (Bloco H, p. 188): o memorial declara, em
     * tabela, que a saida de emergencia NAO atende. E o achado de maior
     * prioridade do documento inteiro — nao e inferencia nem julgamento, e a
     * confissao do proprio documento —, e o Nexodoc nao via.
     *
     * A quebra de linha nas celulas so passou a sobreviver em 17/08/2026; antes
     * disso a pagina inteira era achatada numa linha e regra de tabela nenhuma
     * podia funcionar.
     */
    name: "coerencia: nao conformidade DECLARADA pelo proprio documento",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "Texto qualquer de abertura do memorial.",
        [
          "BLOCO H - SAIDA DE EMERGENCIA",
          "Largura minima exigida: 1,20 m",
          "Largura executada: 0,90 m",
          "Atende? Nao",
        ].join("\n"),
      ]),
    ],
    expected: [{ label: "nao conformidade declarada", needle: "atende" }],
  },
  {
    /*
     * O `-se` REFLEXIVO nao pode ser lido como condicional. "Constatou-se" e
     * "verifica-se" sao a forma normal de escrever quadro de verificacao em
     * portugues; uma guarda ingenua com \bse\b mataria a regra em silencio
     * justamente nas linhas onde ela mais serve.
     */
    name: "coerencia: declaracao com verbo REFLEXIVO ainda e achado",
    sources: [
      makeSource("reflexivo.pdf", "memorial", [
        [
          "BLOCO J - VERIFICACAO",
          "Constatou-se que a rampa atende? Nao",
        ].join("\n"),
      ]),
    ],
    expected: [{ label: "declarada com reflexivo", needle: "atende" }],
  },

  {
    /*
     * AUD-018 do benchmark do 084_25: dois subitens IRMAOS com o titulo
     * identico. E assinatura de copia-e-cola — alguem duplicou o bloco para
     * escrever o proximo material e esqueceu de trocar o nome. Quem le o indice
     * ve dois itens e nao sabe qual descreve o que.
     */
    name: "estrutura: titulos identicos em subitens IRMAOS",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        `3.4.7 PINTURA ACRILICA
Aplicacao em duas demaos sobre massa corrida.
3.4.8 PINTURA ACRILICA
Aplicacao sobre superficie metalica.`,
      ]),
    ],
    expected: [{ label: "titulos irmaos duplicados", needle: "pintura acrilica" }],
  },

  {
    /*
     * AUD-009/010/011 do benchmark do 084_25: 4.448,91 no texto contra
     * 4.530,98 na tabela. A regra existia e nao pegava, porque exige a FRASE
     * "area total construida" a ate 25 caracteres do numero — e numa celula nao
     * ha frase nenhuma antes do numero.
     */
    name: "numerico: area declarada em prosa diverge do TOTAL da tabela",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "A area total construida da edificacao e de 4.448,91 m².",
        {
          texto: "Quadro de areas por ambiente.",
          tabelas: [
            {
              pagina: 2,
              linhas: [
                ["AMBIENTE", "AREA (m²)"],
                ["Bloco A", "2.100,00"],
                ["Bloco B", "2.430,98"],
                ["TOTAL", "4.530,98"],
              ],
            },
          ],
        },
      ]),
    ],
    expected: [{ label: "area prosa x tabela", needle: "4.448,91" }],
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
    /*
     * O FALSO POSITIVO QUE DECIDE A QUALIDADE DESTA REGRA.
     *
     * "caso nao atenda", "se nao atender", "sempre que nao atender" sao
     * instrucao normal de memorial — hipotese, nao confissao. Uma regra que
     * confunda as duas acusaria praticamente todo memorial do escritorio, e
     * regra que grita em todo documento e regra que se aprende a ignorar.
     */
    name: "LIMPO: 'nao atende' em contexto CONDICIONAL nao e confissao",
    sources: [
      makeSource("condicional.pdf", "memorial", [
        "Caso o material nao atenda as especificacoes, devera ser substituido.",
        "Se a peca nao atender a norma, o fornecedor arcara com a troca.",
        "Sempre que nao atender ao previsto, o responsavel tecnico sera acionado.",
        "O contratado devera refazer o servico que nao atender ao memorial.",
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: tabela de conformidade em que TUDO atende",
    sources: [
      makeSource("conforme.pdf", "memorial", [
        [
          "BLOCO A - CIRCULACAO",
          "Largura minima exigida: 1,20 m",
          "Largura executada: 1,50 m",
          "Atende? Sim",
        ].join("\n"),
      ]),
    ],
    expected: [],
  },
  {
    /*
     * O FALSO POSITIVO QUE MATARIA ESTA REGRA.
     *
     * "GENERALIDADES", "OBJETIVO", "MATERIAIS" repetidos sob capitulos
     * DIFERENTES sao a estrutura normal de um memorial — todo capitulo abre
     * assim. Uma regra que comparasse titulos soltos acusaria isso em todo
     * documento do escritorio. Por isso ela so olha IRMAOS: mesmo pai, numero
     * final diferente.
     */
    name: "LIMPO: titulo repetido sob capitulos DIFERENTES e estrutura normal",
    sources: [
      makeSource("estrutura.pdf", "memorial", [
        `3.1 GENERALIDADES
Texto do capitulo 3.
4.1 GENERALIDADES
Texto do capitulo 4.
5.1 GENERALIDADES
Texto do capitulo 5.`,
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: subitens irmaos com titulos DIFERENTES",
    sources: [
      makeSource("irmaos-ok.pdf", "memorial", [
        `3.4.7 PINTURA ACRILICA
Aplicacao em duas demaos.
3.4.8 PINTURA EPOXI
Aplicacao sobre superficie metalica.`,
      ]),
    ],
    expected: [],
  },
  {
    /*
     * O GUARDA DO QUALIFICADOR. Tabela de area de PINTURA tambem fecha com
     * TOTAL em m², e compara-la com a area construida seria o "Escola Geral"
     * outra vez: um numero certo lido como se fosse outra coisa. E a licao que
     * a analise de arquitetura ja tinha tirado do Ledger, aplicada antes de o
     * Ledger existir — estruturar sem qualificar e fabrica de falso positivo.
     */
    name: "LIMPO: TOTAL de tabela que NAO e quadro de areas nao entra",
    sources: [
      makeSource("pintura.pdf", "memorial", [
        "A area total construida da edificacao e de 4.448,91 m².",
        {
          texto: "Quantitativo de pintura.",
          tabelas: [
            {
              pagina: 2,
              linhas: [
                ["SERVICO", "QUANTIDADE (m²)"],
                ["Pintura acrilica", "8.200,00"],
                ["TOTAL", "8.200,00"],
              ],
            },
          ],
        },
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: TOTAL do quadro de areas BATE com a prosa",
    sources: [
      makeSource("bate.pdf", "memorial", [
        "A area total construida da edificacao e de 4.530,98 m².",
        {
          texto: "Quadro de areas.",
          tabelas: [
            {
              pagina: 2,
              linhas: [
                ["AMBIENTE", "AREA (m²)"],
                ["Bloco A", "2.100,00"],
                ["TOTAL", "4.530,98"],
              ],
            },
          ],
        },
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
