import type { AuditFinding, FindingImpact, FindingPriority } from "@/lib/audit-report";
import type { ExtractedPdf } from "@/lib/pdf-text";

export type CoherenceSource = {
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
};

type Hit = { page: number; evidence: string };

function snippet(text: string, index: number, radius = 150) {
  return text
    .slice(Math.max(0, index - radius), Math.min(text.length, index + radius))
    .replace(/\s+/g, " ")
    .trim();
}

/** primeira ocorrência de um padrão no documento inteiro, com página + trecho */
function findFirst(extracted: ExtractedPdf, pattern: RegExp): Hit | null {
  for (const page of extracted.pages) {
    pattern.lastIndex = 0;
    const match = pattern.exec(page.text);

    if (match) {
      return { page: page.page, evidence: snippet(page.text, match.index) };
    }
  }

  return null;
}

/** todas as ocorrências de um conjunto de sinais, para relatar reúso de texto */
function collectSignals(
  extracted: ExtractedPdf,
  signals: Array<{ label: string; pattern: RegExp }>,
) {
  const found: Array<{ label: string; page: number; evidence: string }> = [];

  for (const page of extracted.pages) {
    for (const signal of signals) {
      signal.pattern.lastIndex = 0;
      const match = signal.pattern.exec(page.text);

      if (match && !found.some((item) => item.label === signal.label)) {
        found.push({ label: signal.label, page: page.page, evidence: snippet(page.text, match.index) });
      }
    }
  }

  return found;
}

function makeFinding(
  id: string,
  args: {
    arquivo: string;
    prioridade: FindingPriority;
    impacto: FindingImpact;
    pagina: string;
    capitulo: string;
    local: string;
    tipo: string;
    descricao: string;
    evidencia: string;
    conflito: string;
    sugestao_correcao: string;
    termo_busca?: string;
    confianca?: AuditFinding["confianca"];
  },
): AuditFinding {
  return {
    id,
    arquivo: args.arquivo,
    origem: "regra",
    confianca: args.confianca ?? "alta",
    prioridade: args.prioridade,
    impacto: args.impacto,
    pagina: args.pagina,
    capitulo: args.capitulo,
    local: args.local,
    tipo: args.tipo,
    descricao: args.descricao,
    evidencia: args.evidencia,
    termo_busca: args.termo_busca,
    conflito: args.conflito,
    sugestao_correcao: args.sugestao_correcao,
  };
}

/**
 * Contradições e reúso de texto que atravessam capítulos distantes — o ponto cego
 * da leitura por blocos do LLM. Tudo determinístico, com página + evidência.
 */
export function runDocumentCoherenceRules(source: CoherenceSource): AuditFinding[] {
  const { extracted, fileName } = source;
  const findings: AuditFinding[] = [];
  let count = 1;
  const nextId = () => `COER-${String(count++).padStart(3, "0")}`;

  // 1) Hierarquia documental contraditória:
  //    "prevalecerão os projetos" (projetos > especificações) vs
  //    "especificações técnicas ... prevalecerão sobre todos os projetos" (especificações > projetos)
  const projetosPrevalecem = findFirst(
    extracted,
    /(?:sempre\s+)?prevalecer[ãa]o\s+(?:sempre\s+)?os\s+projetos/i,
  );
  const especificacoesPrevalecem = findFirst(
    extracted,
    /especifica[cç][õo]es\s+t[ée]cnicas[\s\S]{0,140}?prevalecer[ãa]o\s+sobre\s+(?:todos\s+)?os\s+projetos/i,
  );

  if (projetosPrevalecem && especificacoesPrevalecem) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media/Alta",
        impacto: "tecnico_contratual",
        pagina: `${projetosPrevalecem.page} e ${especificacoesPrevalecem.page}`,
        capitulo: "Condições gerais / hierarquia documental",
        local: "regra de prevalência entre documentos",
        tipo: "Hierarquia documental contraditória",
        descricao:
          "O documento estabelece regras de prevalência incompatíveis: em um trecho os projetos prevalecem sobre as especificações; em outro, as especificações técnicas prevalecem sobre todos os projetos.",
        evidencia: `Pág. ${projetosPrevalecem.page}: "${projetosPrevalecem.evidence}" | Pág. ${especificacoesPrevalecem.page}: "${especificacoesPrevalecem.evidence}"`,
        termo_busca: "prevalecerão sobre todos os projetos",
        conflito: `Projetos prevalecem (pág. ${projetosPrevalecem.page}) × especificações prevalecem sobre os projetos (pág. ${especificacoesPrevalecem.page}).`,
        sugestao_correcao:
          "Unificar uma única regra de prevalência documental (ex.: definir explicitamente a ordem projeto executivo → especificações → normas) e remover a redação conflitante.",
      }),
    );
  }

  // 2) Responsabilidade da terraplenagem/movimento de terra: Prefeitura × contratada
  const terraPrefeitura = findFirst(
    extracted,
    /terraplenagem[\s\S]{0,320}?responsabilidade\s+da\s+Prefeitura/i,
  );
  const terraContratada = findFirst(
    extracted,
    /contratada\/?(?:construtora)?\s+dever[áa]\s+executar\s+(?:todo\s+)?(?:o\s+)?movimento\s+de\s+terra/i,
  );

  if (terraPrefeitura && terraContratada) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media/Alta",
        impacto: "tecnico_contratual",
        pagina: `${terraPrefeitura.page} e ${terraContratada.page}`,
        capitulo: "Escopo / responsabilidades",
        local: "responsabilidade pela terraplenagem",
        tipo: "Responsabilidade de terraplenagem divergente",
        descricao:
          "Há atribuição conflitante da terraplenagem: um trecho diz que é responsabilidade da Prefeitura; outro determina que a contratada executará todo o movimento de terra.",
        evidencia: `Pág. ${terraPrefeitura.page}: "${terraPrefeitura.evidence}" | Pág. ${terraContratada.page}: "${terraContratada.evidence}"`,
        termo_busca: "responsabilidade da Prefeitura",
        conflito: `Terraplenagem = Prefeitura (pág. ${terraPrefeitura.page}) × contratada executa movimento de terra (pág. ${terraContratada.page}).`,
        sugestao_correcao:
          "Separar claramente o escopo: o que cabe à Prefeitura, à contratada da edificação e a eventual contrato específico de terraplenagem.",
      }),
    );
  }

  // 3) Linguagem de projeto rodoviário reaproveitada numa obra de edificação
  const roadSignals = collectSignals(extracted, [
    { label: "eixo da rodovia", pattern: /eixo\s+da\s+rodovia/i },
    { label: "rodovias existentes", pattern: /rodovias?\s+existentes/i },
    { label: "superelevação das pistas", pattern: /supereleva[cç][ãa]o\s+das\s+pistas/i },
    { label: "segmento quilométrico (Km 0+000)", pattern: /Km\s*\d+\s*\+\s*\d+/i },
    { label: "velocidade de rodovia", pattern: /velocidades?\s+de\s+at[ée]\s+\d+\s*km\/h/i },
  ]);

  if (roadSignals.length >= 2) {
    const first = roadSignals[0];
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media",
        impacto: "tecnico_contratual",
        pagina: String(first.page),
        capitulo: "Terraplenagem / drenagem / pavimentação",
        local: "linguagem de projeto rodoviário",
        tipo: "Linguagem de projeto rodoviário não adaptada",
        descricao: `O documento usa termos de obra viária/rodoviária (${roadSignals
          .map((item) => item.label)
          .join(", ")}) num projeto de edificação (estacionamento/acessos) — indício de especificação genérica reaproveitada sem adaptação.`,
        evidencia: `Pág. ${first.page}: "${first.evidence}"`,
        termo_busca: first.label,
        conflito: `${roadSignals.length} termos de projeto rodoviário num centro comunitário.`,
        sugestao_correcao:
          "Revisar os capítulos de terraplenagem/drenagem/pavimentação e adaptar a linguagem viária ao escopo real (estacionamento e acessos da edificação).",
        confianca: "media",
      }),
    );
  }

  // 4) Obra declarada como construção nova, mas com indícios de reforma/intervenção existente
  const construcaoNova = findFirst(extracted, /ser[áa]\s+constru[íi]d[oa]\s+o?\s*[A-ZÁÉÍÓÚ]/i);
  const reformaSignals = collectSignals(extracted, [
    { label: "revitalização", pattern: /revitaliza[cç][ãa]o/i },
    { label: "pavimento a ser substituído", pattern: /pavimento\s+a\s+ser\s+substitu[íi]do/i },
    { label: "alvenaria existente", pattern: /alvenaria\s+existente/i },
  ]);

  if (construcaoNova && reformaSignals.length >= 1) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media",
        impacto: "tecnico_contratual",
        pagina: String(reformaSignals[0].page),
        capitulo: "Escopo da obra",
        local: "construção nova × intervenção em existente",
        tipo: "Escopo ambíguo: construção nova × reforma",
        descricao: `O projeto é declarado como construção nova, mas há trechos com linguagem de reforma/ampliação (${reformaSignals
          .map((item) => item.label)
          .join(", ")}) — possível texto reaproveitado de obra de intervenção em edificação existente.`,
        evidencia: `Pág. ${reformaSignals[0].page}: "${reformaSignals[0].evidence}"`,
        termo_busca: reformaSignals[0].label,
        conflito: "Construção nova declarada, mas com referências a estrutura/pavimento existente.",
        sugestao_correcao:
          "Confirmar se a obra é construção nova ou intervenção em edificação existente e remover a linguagem incompatível com o escopo correto.",
        confianca: "media",
      }),
    );
  }

  // 5) Área construída TOTAL declarada com valores divergentes no mesmo documento.
  //    Genérico (não amarrado a um projeto): só a área total conta — áreas por
  //    ambiente/pavimento não disparam, para não confundir detalhamento com conflito.
  for (const areaFinding of runDeclaredTotalAreaRule(extracted, fileName, nextId)) {
    findings.push(areaFinding);
  }

  // 6) Concessionária de energia citada fora da sua microrregião de atendimento.
  //    Só dispara para cooperativas de área pequena e bem delimitada — grandes
  //    distribuidoras estaduais (CELESC, ENEL, CPFL...) cobrem municípios demais
  //    para inferir reaproveitamento. Ponto de checagem territorial, confiança baixa.
  for (const utilityFinding of runElectricUtilityTerritoryRule(extracted, fileName, nextId)) {
    findings.push(utilityFinding);
  }

  // 7) Memória de cálculo da carga de incêndio que não fecha.
  for (const loadFinding of runFireLoadArithmeticRule(extracted, fileName, nextId)) {
    findings.push(loadFinding);
  }

  return findings;
}

// --- Regra 7: aritmética da carga de incêndio --------------------------------

/*
 * Por que isto é REGRA e não instrução de prompt.
 *
 * O prompt do auditor passou a exigir conferência aritmética em 12/08/2026. No
 * 063-26 o modelo recebeu a tabela extraída LIMPA — massa, potencial e produto,
 * todos legíveis — e mesmo assim não conferiu: zero achados sobre a tabela cujo
 * total declarado (3.309) não bate nem com a soma das linhas escritas (3.084)
 * nem com o cálculo correto (3.127,29 → 3,69 MJ/m², e não os 3,91 declarados).
 * Antes disso, com o prompt antigo, o motor chegou a responder que "a extração
 * não permite validar a estrutura da tabela".
 *
 * Multiplicar duas colunas e somar é fato objetivo. Fato objetivo é regra; a IA
 * fica com o contexto. Uma multiplicação nunca "quase acerta", então a confiança
 * é alta e o achado é bloqueador: memorial de incêndio com memória de cálculo
 * errada não pode ser emitido, mesmo que a classificação final não mude.
 */

/** "3.309" -> 3309 ; "99,27" -> 99.27 ; "2.680,29" -> 2680.29 */
function parseNumeroBr(raw: string): number | null {
  const canonical = raw
    .trim()
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const value = Number(canonical);
  return Number.isFinite(value) ? value : null;
}

function formatNumeroBr(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

type LinhaDaCarga = { massa: number; potencial: number; produtoEscrito: number };

/*
 * Linha da tabela: "<descrição> <massa> <potencial> <produto>".
 * O pdfjs entrega a página como uma linha só, então o casamento é pelos TRÊS
 * números consecutivos no fim do item, não por quebra de linha. Exige potencial
 * inteiro de 2-3 dígitos (MJ/kg tabelado) para não pescar trio de números solto.
 */
const LINHA_CARGA = /([\d.]+,\d+|\d+)\s+(\d{1,3})\s+([\d.]+,\d+|\d+)(?=\s|$)/g;

function runFireLoadArithmeticRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const page of extracted.pages) {
    if (!/potencial\s+calor[íi]fico/i.test(page.text)) {
      continue;
    }

    const totalMatch = /Valor\s+total\s+do\s+potencial\s+calor[íi]fico[^\d]{0,30}([\d.]+,\d+|[\d.]+)/i.exec(
      page.text,
    );

    if (!totalMatch) {
      continue;
    }

    const totalDeclarado = parseNumeroBr(totalMatch[1]);

    if (totalDeclarado === null) {
      continue;
    }

    // Só o trecho da tabela: entre o cabeçalho e o "Valor total".
    const inicio = page.text.search(/Potencial\s+calor[íi]fico/i);
    const corpo = page.text.slice(inicio, totalMatch.index);
    const linhas: LinhaDaCarga[] = [];

    LINHA_CARGA.lastIndex = 0;
    for (const match of corpo.matchAll(LINHA_CARGA)) {
      const massa = parseNumeroBr(match[1]);
      const potencial = parseNumeroBr(match[2]);
      const produtoEscrito = parseNumeroBr(match[3]);

      if (massa === null || potencial === null || produtoEscrito === null) {
        continue;
      }

      linhas.push({ massa, potencial, produtoEscrito });
    }

    if (linhas.length < 2) {
      continue;
    }

    const errosDeLinha = linhas.filter(
      (linha) => Math.abs(linha.massa * linha.potencial - linha.produtoEscrito) > 0.5,
    );
    const somaEscrita = linhas.reduce((total, linha) => total + linha.produtoEscrito, 0);
    const somaCorreta = linhas.reduce((total, linha) => total + linha.massa * linha.potencial, 0);
    const somaNaoFecha = Math.abs(somaEscrita - totalDeclarado) > 1;

    if (errosDeLinha.length === 0 && !somaNaoFecha) {
      continue;
    }

    const detalheLinhas = errosDeLinha
      .map(
        (linha) =>
          `${formatNumeroBr(linha.massa)} × ${formatNumeroBr(linha.potencial)} = ${formatNumeroBr(
            linha.massa * linha.potencial,
          )}, e não ${formatNumeroBr(linha.produtoEscrito)}`,
      )
      .join("; ");

    const areaMatch = /[ÁA]rea\s+considerada[^\d]{0,40}([\d.]+,\d+|[\d.]+)/i.exec(page.text);
    const area = areaMatch ? parseNumeroBr(areaMatch[1]) : null;
    const especificaMatch = /Carga\s+de\s+inc[êe]ndio\s+espec[íi]fica[^\d]{0,30}([\d.]+,\d+|[\d.]+)/i.exec(
      page.text,
    );
    const especificaDeclarada = especificaMatch ? parseNumeroBr(especificaMatch[1]) : null;

    const partesConflito = [
      errosDeLinha.length > 0 ? `${errosDeLinha.length} linha(s) com produto errado: ${detalheLinhas}` : null,
      somaNaoFecha
        ? `a soma das linhas escritas é ${formatNumeroBr(somaEscrita)}, mas o total declarado é ${formatNumeroBr(totalDeclarado)}`
        : null,
      `refazendo as contas a partir das massas e potenciais da própria tabela, o total é ${formatNumeroBr(somaCorreta)}`,
      area && especificaDeclarada
        ? `o que dá ${formatNumeroBr(somaCorreta / area)} MJ/m², e não os ${formatNumeroBr(especificaDeclarada)} MJ/m² declarados`
        : null,
    ].filter(Boolean);

    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Alta",
        impacto: "critico_documental",
        pagina: String(page.page),
        capitulo: "Projeto preventivo contra incêndio",
        local: "Memória de cálculo da carga de incêndio",
        tipo: "Memória de cálculo da carga de incêndio não fecha",
        descricao: `A tabela de carga de incêndio da página ${page.page} não fecha: ${
          errosDeLinha.length > 0 ? "há produto de linha incorreto" : "o total não corresponde às linhas"
        } e o total declarado não corresponde ao cálculo.`,
        evidencia: snippet(page.text, totalMatch.index, 220),
        termo_busca: "Valor total do potencial calorífico",
        conflito: `${partesConflito.join("; ")}.`,
        sugestao_correcao:
          "Refazer a memória de cálculo com os produtos e o somatório corretos e atualizar a carga específica resultante. Ainda que a classificação final não mude, a memória apresentada precisa ser aritmeticamente correta.",
      }),
    );
  }

  return findings;
}

// --- Regra 5: área total construída divergente -------------------------------

function parseAreaValue(raw: string) {
  // "1.234,56 m²" -> 1234.56 ; "987,00 m2" -> 987
  const numberPart = (raw.match(/[\d.,]+/) ?? [""])[0];
  const canonical = numberPart.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const value = Number(canonical);
  return Number.isFinite(value) ? value : null;
}

function runDeclaredTotalAreaRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  // O valor tem que vir LOGO APÓS a frase "área total construída ... N m²".
  // Ancorar assim evita o falso positivo clássico: no pdfjs a página inteira vira
  // uma "linha" só, e a versão antiga pescava qualquer valor da página — inclusive
  // o limite normativo "depósito com área total superior a 1.000 m²", que não é a
  // área da obra. Aqui, "1.000" não vem depois de "construída de", então não casa.
  const DECLARED_TOTAL_AREA =
    /[áa]rea\s+(?:total\s+constru[íi]da|constru[íi]da\s+total|total\s+edificada|total\s+da\s+edifica[cç][ãa]o)[^\d\n]{0,25}?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*m(?:²|2)/gi;

  const found: Array<{ page: number; value: number; display: string; evidence: string }> = [];

  for (const page of extracted.pages) {
    DECLARED_TOTAL_AREA.lastIndex = 0;
    for (const match of page.text.matchAll(DECLARED_TOTAL_AREA)) {
      const value = parseAreaValue(match[1]);

      // ignora valores implausíveis para área total de edificação (< 10 m²)
      if (value === null || value < 10) {
        continue;
      }

      found.push({
        page: page.page,
        value,
        display: `${match[1].trim()} m²`,
        // evidência = trecho curto ao redor da menção, não a página inteira
        evidence: snippet(page.text, match.index ?? 0, 120),
      });
    }
  }

  // agrupa por valor arredondado (0,5 m² de tolerância) para não acusar
  // arredondamento como divergência
  const distinct = new Map<number, { page: number; display: string; evidence: string }>();
  for (const item of found) {
    const key = Math.round(item.value * 2) / 2;
    if (!distinct.has(key)) {
      distinct.set(key, { page: item.page, display: item.display, evidence: item.evidence });
    }
  }

  if (distinct.size < 2) {
    return [];
  }

  const entries = [...distinct.values()];
  return [
    makeFinding(nextId(), {
      arquivo: fileName,
      prioridade: "Alta",
      impacto: "critico_documental",
      pagina: [...new Set(entries.map((item) => item.page))].join(", "),
      capitulo: "Área da obra / quantitativos",
      local: "área total construída",
      tipo: "Área total construída divergente no mesmo documento",
      descricao: `O documento declara áreas totais construídas diferentes: ${entries
        .map((item) => item.display)
        .join(" × ")}.`,
      evidencia: entries.map((item) => `Pág. ${item.page}: "${item.evidence}"`).join(" | "),
      termo_busca: entries[0].display,
      conflito: `Valores de área total incompatíveis (${entries
        .map((item) => item.display)
        .join(" × ")}) — não fica claro qual é a área oficial da obra.`,
      sugestao_correcao:
        "Padronizar a área total construída oficial em todo o documento ou declarar explicitamente a diferença (área total × área computável × área por disciplina).",
    }),
  ];
}

// --- Regra 6: concessionária de energia fora da microrregião ------------------

/** cooperativas/permissionárias de área delimitada, com seus municípios de atendimento */
const SMALL_ELECTRIC_UTILITIES: Array<{
  nome: string;
  sigla: RegExp;
  municipios: string[];
}> = [
  { nome: "COOPERA", sigla: /\bcoopera\b/i, municipios: ["forquilhinha"] },
  { nome: "CERMOFUL", sigla: /\bcermoful\b/i, municipios: ["morro da fumaca"] },
  { nome: "CERGAL", sigla: /\bcergal\b/i, municipios: ["garopaba", "paulo lopes"] },
  { nome: "CERPALO", sigla: /\bcerpalo\b/i, municipios: ["sao ludgero"] },
  { nome: "CERGRAL", sigla: /\bcergral\b/i, municipios: ["gravatal"] },
  { nome: "COOPERALIANÇA", sigla: /\bcooperalian[cç]a\b/i, municipios: ["icara", "cocal do sul", "nova veneza", "urussanga"] },
  { nome: "CEJAMA", sigla: /\bcejama\b/i, municipios: ["jacinto machado"] },
  { nome: "CERSAD", sigla: /\bcersad\b/i, municipios: ["treze de maio"] },
];

function stripAccentsLower(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** município dominante do documento (moda das menções em "prefeitura municipal de X" / "município de X") */
function findDominantMunicipio(extracted: ExtractedPdf) {
  const MUNICIPIO = /(?:prefeitura\s+municipal\s+de|munic[ií]pio\s+de)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40}?)(?=[,;.\n/]|\s{2}|\s+[-–]\s+|$)/gi;
  const counts = new Map<string, number>();

  for (const page of extracted.pages) {
    MUNICIPIO.lastIndex = 0;
    for (const match of page.text.matchAll(MUNICIPIO)) {
      const canonical = stripAccentsLower(match[1].trim()).replace(/\s+/g, " ");
      if (canonical.length < 3) {
        continue;
      }
      counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

function runElectricUtilityTerritoryRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  const municipio = findDominantMunicipio(extracted);

  if (!municipio) {
    return [];
  }

  const findings: AuditFinding[] = [];

  for (const utility of SMALL_ELECTRIC_UTILITIES) {
    const hit = findFirst(extracted, utility.sigla);

    if (!hit) {
      continue;
    }

    const servesThisCity = utility.municipios.some(
      (city) => municipio.includes(city) || city.includes(municipio),
    );

    if (servesThisCity) {
      continue;
    }

    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media",
        impacto: "tecnico_contratual",
        pagina: String(hit.page),
        capitulo: "Projeto elétrico / concessionária",
        local: "concessionária de energia",
        tipo: "Concessionária de energia fora da microrregião de atendimento",
        descricao: `O documento cita a concessionária ${utility.nome} para uma obra em "${municipio}", mas ${utility.nome} atende tipicamente ${utility.municipios.join(", ")}.`,
        evidencia: `Pág. ${hit.page}: "${hit.evidence}"`,
        termo_busca: utility.nome,
        conflito: `${utility.nome} × município da obra (${municipio}) — possível memorial elétrico reaproveitado de outra cidade.`,
        sugestao_correcao:
          "Confirmar a concessionária responsável pelo endereço da obra e ajustar normas de padrão de entrada, medição e aterramento se necessário.",
        confianca: "baixa",
      }),
    );
  }

  return findings;
}
