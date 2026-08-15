import type { AuditFinding, FindingPriority } from "@/lib/audit-report";
import type { ExtractedPdf } from "@/lib/pdf-text";

export type CrossDocumentSource = {
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
};

type IdentityFieldKey =
  | "municipio"
  | "orgao"
  | "endereco"
  | "bairro"
  | "obra"
  | "codigo"
  | "revisao";

type IdentityMention = {
  /** valor bruto exibível, como aparece no documento */
  display: string;
  /** valor normalizado para comparação (sem acento/caixa/ruído) */
  canonical: string;
  page: number;
  evidence: string;
};

/** valor "afirmado" por um documento para um campo (moda das menções) */
type AssertedValue = IdentityMention & {
  /** quantas menções sustentam esse valor no documento */
  support: number;
  /** quantos valores distintos o campo teve no mesmo documento */
  distinct: number;
};

export type IdentityFingerprint = {
  fileName: string;
  fileType: string;
  fields: Partial<Record<IdentityFieldKey, AssertedValue>>;
};

type FieldSpec = {
  key: IdentityFieldKey;
  label: string;
  type: string;
  priority: FindingPriority;
  patterns: RegExp[];
  /** normalização específica do campo; cai no baseCanonical se ausente */
  canonical?: (raw: string) => string;
};

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function baseCanonical(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-–]+/, "")
    .replace(/[\s:;,.\-–]+$/, "")
    .trim();
}

function canonicalMunicipio(raw: string) {
  let value = baseCanonical(raw);
  value = value
    .replace(/^prefeitura\s+municipal\s+de\s+/, "")
    .replace(/^prefeitura\s+de\s+/, "")
    .replace(/^municipio\s+(?:de\s+)?/, "");
  // remove sufixo de estado: " - sc", " / sc", " sc"
  value = value.replace(/\s*[-/]\s*[a-z]{2}\b.*$/, "");
  value = value.replace(/\s+estado\b.*$/, "");
  return value.trim();
}

function cleanDisplay(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-–]+/, "")
    .replace(/[\s:;,.\-–]+$/, "")
    .trim();
}

const FIELD_SPECS: FieldSpec[] = [
  {
    key: "municipio",
    label: "município/proprietário",
    type: "Município/proprietário divergente entre documentos",
    priority: "Alta",
    canonical: canonicalMunicipio,
    patterns: [
      /prefeitura\s+municipal\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç.\s]{2,45}?)(?=[,;.\n/]|\s{2}|$)/gi,
      /\bmunic[ií]pio\s*(?:de\s+|:\s*)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç.\s]{2,45}?)(?=[,;.\n/]|\s{2}|$)/gi,
    ],
  },
  {
    key: "orgao",
    label: "órgão/secretaria",
    type: "Órgão/secretaria divergente entre documentos",
    priority: "Media/Alta",
    patterns: [
      /\b(secretaria\s+(?:municipal\s+|estadual\s+)?(?:de|da|do)\s+[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{3,60}?)(?=[,;.\n]|\s{2}|$)/gi,
    ],
  },
  {
    key: "endereco",
    label: "endereço",
    type: "Endereço divergente entre documentos",
    priority: "Alta",
    patterns: [
      /(?:endere[cç]o|logradouro)\s*:?\s*([^\n;]{6,100}?)(?=[;\n]|$)/gi,
    ],
  },
  {
    key: "bairro",
    label: "bairro",
    type: "Bairro divergente entre documentos",
    priority: "Alta",
    patterns: [
      /\bbairro\s*:?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40}?)(?=[,;.\n]|\s{2}|$)/gi,
    ],
  },
  {
    key: "obra",
    label: "nome da obra/unidade",
    type: "Nome da obra/unidade divergente entre documentos",
    priority: "Alta",
    patterns: [
      /(?:obra|unidade|edifica[cç][aã]o)\s*:\s*([^\n;]{4,80}?)(?=[;\n]|$)/gi,
    ],
  },
  {
    key: "codigo",
    label: "código do projeto",
    type: "Código do projeto divergente entre documentos",
    priority: "Alta",
    patterns: [
      /(?:c[oó]digo(?:\s+do\s+projeto)?|projeto)\s*(?:n[ºo°.]*)?\s*[:#-]\s*([A-Z0-9][A-Z0-9./_-]{2,30})/gi,
    ],
  },
  {
    key: "revisao",
    label: "revisão",
    type: "Revisão divergente entre documentos",
    priority: "Media/Alta",
    patterns: [/(?:revis[aã]o|rev\.)\s*[:#-]?\s*(R?\d{1,3}|[A-Z]\d{0,2})\b/gi],
  },
];

function extractEvidence(text: string, index: number) {
  return text
    .slice(Math.max(0, index - 45), Math.min(text.length, index + 135))
    .replace(/\s+/g, " ")
    .trim();
}

function collectMentions(source: CrossDocumentSource, spec: FieldSpec): IdentityMention[] {
  const canonicalize = spec.canonical ?? baseCanonical;
  const mentions: IdentityMention[] = [];

  for (const page of source.extracted.pages) {
    for (const pattern of spec.patterns) {
      pattern.lastIndex = 0;

      for (const match of page.text.matchAll(pattern)) {
        const raw = match[1]?.trim();

        if (!raw) {
          continue;
        }

        const display = cleanDisplay(raw);
        const canonical = canonicalize(raw);

        if (!canonical || canonical.length < 2) {
          continue;
        }

        mentions.push({
          display,
          canonical,
          page: page.page,
          evidence: extractEvidence(page.text, match.index ?? 0),
        });
      }
    }
  }

  return mentions;
}

/** valor afirmado por um documento = a moda das menções (evita que uma linha solta vire "o valor") */
function resolveAssertedValue(mentions: IdentityMention[]): AssertedValue | null {
  if (mentions.length === 0) {
    return null;
  }

  const groups = new Map<string, { mention: IdentityMention; support: number; order: number }>();

  mentions.forEach((mention, index) => {
    const current = groups.get(mention.canonical);

    if (current) {
      current.support += 1;
      return;
    }

    groups.set(mention.canonical, { mention, support: 1, order: index });
  });

  const ranked = [...groups.values()].sort((a, b) => {
    if (b.support !== a.support) {
      return b.support - a.support;
    }

    return a.order - b.order;
  });

  const winner = ranked[0];

  return {
    ...winner.mention,
    support: winner.support,
    distinct: groups.size,
  };
}

/*
 * "cidade de Criciúma", "município de Içara" — localidade dentro de frase técnica
 * corrente, NÃO nome de obra.
 *
 * A palavra "cidade" está na lista de entidades nomeadas do auditor (existem
 * obras "Cidade Alta"), e por isso o trecho "localizado na edificação Cancha de
 * Bocha, na cidade de Criciúma/SC" virava candidato a identidade e era acusado
 * de divergir do gabarito. Foi o falso positivo nº 1 do 063-26 (12/08/2026), e
 * a ação recomendada mandava trocar a localidade pelo nome da obra — teria
 * estragado o documento.
 *
 * O nome de uma obra nunca COMEÇA com "cidade de"; "Cidade Alta" começa com
 * "cidade" mas não vem seguido de preposição, então continua passando.
 */
export function isLocalityPhrase(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  const stripped = trimmed.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // "município/bairro/distrito de X" nunca nomeia equipamento: barra em qualquer caixa.
  if (/^(municipio|localidade|bairro|distrito|comarca)\s+d[eoa]s?\s+\S/i.test(stripped)) {
    return true;
  }

  /*
   * "cidade" é ambíguo e a caixa é que decide. Existe a obra real "Cidade do
   * Autista" (coberta por teste próprio), e por isso "Cidade" está no
   * FACILITY_PATTERN. Já "na cidade de Criciúma/SC" vem em minúscula no meio da
   * frase — é localidade, não equipamento.
   */
  return /^cidade\s+d[eoa]s?\s+\S/.test(stripped);
}

export function extractIdentityFingerprint(source: CrossDocumentSource): IdentityFingerprint {
  const fields: Partial<Record<IdentityFieldKey, AssertedValue>> = {};

  for (const spec of FIELD_SPECS) {
    const asserted = resolveAssertedValue(collectMentions(source, spec));

    if (asserted) {
      fields[spec.key] = asserted;
    }
  }

  return {
    fileName: source.fileName,
    fileType: source.fileType,
    fields,
  };
}

function sourceRank(fileType: string) {
  const ranks: Record<string, number> = {
    capa: 0,
    memorial: 1,
    ld: 2,
    separatriz: 3,
    pranchas: 4,
    outro: 5,
  };

  return ranks[fileType.toLowerCase()] ?? 6;
}

/**
 * Confronto determinístico de identidade entre documentos.
 * Sem IA: um campo só vira achado quando dois documentos AFIRMAM valores
 * diferentes para o mesmo campo. Ausência em um documento nunca é conflito.
 */
export function runCrossDocumentRules(sources: CrossDocumentSource[]) {
  if (sources.length < 2) {
    return {
      findings: [] as AuditFinding[],
      comparisons: [
        "Auditoria realizada em arquivo único; não há documentos distintos para confronto de identidade.",
      ],
    };
  }

  const fingerprints = sources
    .map((source) => ({ source, fingerprint: extractIdentityFingerprint(source) }))
    .sort((a, b) => sourceRank(a.source.fileType) - sourceRank(b.source.fileType));

  const findings: AuditFinding[] = [];
  const comparisons: string[] = [];

  for (const spec of FIELD_SPECS) {
    const represented = fingerprints
      .map((item) => ({
        fileName: item.fingerprint.fileName,
        fileType: item.fingerprint.fileType,
        value: item.fingerprint.fields[spec.key],
      }))
      .filter((item): item is { fileName: string; fileType: string; value: AssertedValue } =>
        Boolean(item.value),
      );

    if (represented.length < 2) {
      continue;
    }

    const distinctCanonicals = new Set(represented.map((item) => item.value.canonical));

    if (distinctCanonicals.size === 1) {
      comparisons.push(
        `${spec.label}: valor compatível ("${represented[0].value.display}") entre ${represented
          .map((item) => item.fileName)
          .join(" e ")}.`,
      );
      continue;
    }

    // baseline = documento de maior precedência (capa > memorial > ld > ...)
    const baseline = represented[0];
    const conflicting = represented.filter(
      (item) => item.value.canonical !== baseline.value.canonical,
    );

    comparisons.push(
      `${spec.label}: divergência entre ${represented
        .map((item) => `${item.fileName} ("${item.value.display}")`)
        .join(" x ")}.`,
    );

    for (const item of conflicting) {
      findings.push({
        id: `CROSS-${String(findings.length + 1).padStart(3, "0")}`,
        arquivo: item.fileName,
        origem: "regra",
        prioridade: spec.priority,
        pagina: String(item.value.page),
        capitulo: "Comparação entre documentos",
        categoria: spec.label,
        referencia_comparada: `${baseline.fileName}: ${baseline.value.display}`,
        local: spec.label,
        tipo: spec.type,
        descricao: `${item.fileName} informa "${item.value.display}", enquanto ${baseline.fileName} informa "${baseline.value.display}" para ${spec.label}.`,
        evidencia: item.value.evidence,
        termo_busca: item.value.display.slice(0, 160),
        conflito: `${item.fileName}: ${item.value.display} x ${baseline.fileName}: ${baseline.value.display}.`,
        /*
         * A SUGESTÃO DIZ OS DOIS VALORES E ONDE CADA UM ESTÁ.
         *
         * Era "Conferir o ${spec.label} correto e padronizar todos os
         * documentos" — a frase que o nosso próprio `auditor-prompt.ts` proíbe a
         * IA de escrever, vinda de um motor que conhece os dois valores e as
         * duas páginas. Quem lia tinha de reabrir os dois arquivos para
         * descobrir o que a auditoria já sabia.
         *
         * E ELA NÃO ESCOLHE O VENCEDOR, de propósito: o baseline é o documento
         * majoritário, não o comprovadamente certo. Mandar "trocar X por Y" aqui
         * seria afirmar uma coisa que este motor não apurou. O que ele apurou é
         * a divergência — então o que se pede é a DECISÃO, com os candidatos na
         * mão.
         */
        sugestao_correcao:
          `Decidir qual ${spec.label} vale: "${item.value.display}" (${item.fileName}, p. ${item.value.page}) ` +
          `ou "${baseline.value.display}" (${baseline.fileName}, p. ${baseline.value.page}) — ` +
          `e alinhar os dois documentos antes da emissão.`,
        confianca: "alta",
      });
    }
  }

  if (comparisons.length === 0) {
    comparisons.push(
      `Documentos confrontados: ${fingerprints
        .map((item) => `${item.source.fileType} (${item.source.fileName})`)
        .join(" x ")}; não foram extraídos campos de identidade comuns suficientes para confronto automático.`,
    );
  }

  return { findings, comparisons };
}

// ---------------------------------------------------------------------------
// Consistência de identidade DENTRO de um único documento.
//
// Pega o caso clássico de "texto reaproveitado": um memorial da obra X que
// carrega, em capítulos internos, o nome de outra obra/unidade (Y, Z). É
// determinístico: identifica a obra dominante (a que mais aparece) e sinaliza
// toda menção nomeada divergente. Complementa runCrossDocumentRules, que só
// atua quando há 2+ arquivos.
// ---------------------------------------------------------------------------

/** tipos de equipamento/obra reconhecidos (para nome próprio e para tipo de ocupação) */
const FACILITY_TYPES = [
  "centro comunitario",
  "centro dia",
  "centro de saude",
  "cidade",
  "unidade basica de saude",
  "ubs",
  "creche",
  "escola",
  "ginasio",
  "posto de saude",
  "hospital",
  "cras",
  "creas",
];

// Captura "TIPO" seguido do texto imediato (até a próxima pontuação). O nome
// próprio da obra é recortado depois, em trimProperName, mantendo só a sequência
// de palavras com inicial maiúscula (e conectores de/do/da entre elas) — o que
// evita sobre-capturar o texto seguinte. Case-insensitive para casar tanto o
// corpo em Title Case quanto o rodapé em CAIXA ALTA.
const FACILITY_PATTERN =
  /\b(Centro Comunit[áa]rio|Centro Dia|Centro de Sa[úu]de|Cidade|Unidade B[áa]sica de Sa[úu]de|UBS|Creche|Escola|Gin[áa]sio|Posto de Sa[úu]de|Hospital|CRAS|CREAS)\b([^.,;:\n()/–-]{0,60})/gi;

const NAME_CONNECTORS = new Set(["de", "do", "da", "dos", "das", "di", "des", "dis"]);

function isProperNameWord(word: string) {
  const first = word[0] ?? "";
  return first !== first.toLowerCase() && first === first.toUpperCase();
}

/** recorta o nome próprio: sequência inicial de palavras Maiúsculas + conectores */
function trimProperName(raw: string) {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (const word of words) {
    if (isProperNameWord(word) || NAME_CONNECTORS.has(baseCanonical(word))) {
      kept.push(word);
      continue;
    }

    break;
  }

  while (kept.length && NAME_CONNECTORS.has(baseCanonical(kept[kept.length - 1]))) {
    kept.pop();
  }

  return kept.join(" ");
}

type FacilityMention = {
  display: string;
  canonical: string;
  type: string;
  hasName: boolean;
  page: number;
  evidence: string;
};

function facilityCanonical(value: string) {
  return baseCanonical(value).replace(/\s+/g, " ").trim();
}

function collectFacilityMentions(source: CrossDocumentSource): FacilityMention[] {
  const mentions: FacilityMention[] = [];

  for (const page of source.extracted.pages) {
    FACILITY_PATTERN.lastIndex = 0;

    for (const match of page.text.matchAll(FACILITY_PATTERN)) {
      const typeRaw = match[1] ?? "";
      const name = trimProperName(match[2] ?? "");
      const type = baseCanonical(typeRaw);
      const hasName = name.length > 0;
      const display = cleanDisplay(hasName ? `${typeRaw} ${name}` : typeRaw);
      const canonical = facilityCanonical(hasName ? `${type} ${name}` : type);

      if (!canonical || canonical.length < 3) {
        continue;
      }

      // "Cidade" está no FACILITY_PATTERN ao lado de UBS/Creche/Hospital, então
      // "na cidade de Criciúma/SC" era colhido como menção a equipamento e ia
      // brigar com o gabarito. Um nome próprio como "Cidade Alta" não vem
      // seguido de preposição e continua passando.
      if (isLocalityPhrase(display)) {
        continue;
      }

      mentions.push({
        display,
        canonical,
        type,
        hasName,
        page: page.page,
        evidence: extractEvidence(page.text, match.index ?? 0),
      });
    }
  }

  return mentions;
}

/** extrai tipo+canônico do nome de obra declarado no gabarito (item 1) */
function parseDeclaredObra(
  declared: string,
): { canonical: string; type: string; display: string } | null {
  const trimmed = declared.trim();

  if (trimmed.length < 3) {
    return null;
  }

  FACILITY_PATTERN.lastIndex = 0;
  const match = FACILITY_PATTERN.exec(trimmed);

  if (match) {
    const typeRaw = match[1] ?? "";
    const name = trimProperName(match[2] ?? "");
    const type = baseCanonical(typeRaw);
    const hasName = name.length > 0;
    const canonical = facilityCanonical(hasName ? `${type} ${name}` : type);

    if (canonical.length >= 3) {
      return { canonical, type, display: trimmed };
    }
  }

  const canonical = facilityCanonical(trimmed);
  return canonical.length >= 3 ? { canonical, type: "", display: trimmed } : null;
}

/**
 * Consistência de identidade dentro de um documento.
 * Com `gabaritoObra` (item 1) o baseline deixa de ser inferido e passa a ser a
 * obra DECLARADA na capa — mais confiável que "a mais frequente". Além de
 * sinalizar menções divergentes, emite um achado crítico quando o documento
 * afirma predominantemente OUTRA obra que a declarada (gabarito × documento).
 */
export function runWithinDocumentIdentityRules(
  source: CrossDocumentSource,
  options: { gabaritoObra?: string } = {},
): AuditFinding[] {
  const mentions = collectFacilityMentions(source);

  if (mentions.length === 0) {
    return [];
  }

  // agrupa por identidade canônica, contando frequência e guardando 1ª evidência
  const groups = new Map<
    string,
    { mention: FacilityMention; count: number; order: number }
  >();

  mentions.forEach((mention, index) => {
    const current = groups.get(mention.canonical);

    if (current) {
      current.count += 1;
      return;
    }

    groups.set(mention.canonical, { mention, count: 1, order: index });
  });

  const ranked = [...groups.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return a.order - b.order;
  });

  const inferredDominant = ranked[0];
  const declared = parseDeclaredObra(options.gabaritoObra ?? "");

  // Sem gabarito e sem dominância clara não há baseline confiável; evita ruído em
  // documentos que apenas citam vários equipamentos. Com gabarito, a obra
  // declarada é o baseline mesmo que apareça pouco no texto.
  if (!declared && inferredDominant.count < 3) {
    return [];
  }

  const baselineCanonical = declared ? declared.canonical : inferredDominant.mention.canonical;
  const baselineType = declared ? declared.type : inferredDominant.mention.type;
  const baselineDisplay = declared ? declared.display : inferredDominant.mention.display;
  const baselineLabel = declared ? "obra declarada (gabarito)" : "obra dominante";

  const findings: AuditFinding[] = [];

  // Gabarito × documento: o documento afirma fortemente outra obra que a declarada.
  if (declared && inferredDominant.count >= 3) {
    const domCanon = inferredDominant.mention.canonical;
    const divergesFromDeclared =
      domCanon !== baselineCanonical &&
      !domCanon.includes(baselineCanonical) &&
      !baselineCanonical.includes(domCanon);

    if (divergesFromDeclared) {
      findings.push({
        id: `IDENT-${String(findings.length + 1).padStart(3, "0")}`,
        arquivo: source.fileName,
        origem: "regra",
        prioridade: "Alta",
        pagina: String(inferredDominant.mention.page),
        capitulo: "Identidade da obra no documento",
        categoria: "nome da obra/unidade",
        referencia_comparada: `Obra declarada (gabarito): ${baselineDisplay}`,
        local: "gabarito × documento",
        tipo: "Documento diverge da obra declarada no gabarito",
        descricao: `O gabarito informa a obra "${baselineDisplay}", mas o documento identifica predominantemente "${inferredDominant.mention.display}".`,
        evidencia: inferredDominant.mention.evidence,
        termo_busca: inferredDominant.mention.display.slice(0, 160),
        conflito: `Gabarito: "${baselineDisplay}" × documento: "${inferredDominant.mention.display}".`,
        /*
         * A BIFURCAÇÃO CONTINUA — ela é honesta, porque daqui não dá para saber
         * se o arquivo é o errado ou se a identidade dentro dele é que está. O
         * que faltava era NOMEAR os dois lados: "confirmar se o arquivo
         * corresponde à obra declarada" manda a pessoa procurar o que a
         * auditoria já tem na mão.
         */
        sugestao_correcao:
          `O gabarito declara "${baselineDisplay}" e o documento identifica "${inferredDominant.mention.display}" ` +
          `(p. ${inferredDominant.mention.page}). Se este é o arquivo certo, substituir ` +
          `"${inferredDominant.mention.display}" por "${baselineDisplay}" no documento; ` +
          `se não, auditar o arquivo da obra "${baselineDisplay}".`,
        confianca: "alta",
      });
    }
  }

  // Com gabarito, checa todos os grupos contra a obra declarada; sem gabarito,
  // mantém o comportamento antigo (todos menos o dominante).
  const groupsToCheck = declared ? ranked : ranked.slice(1);

  for (const group of groupsToCheck) {
    const candidate = group.mention;

    if (candidate.canonical === baselineCanonical) {
      continue;
    }

    // ignora o tipo "nu" que é apenas um prefixo do baseline
    // (ex.: "Centro Comunitário" sozinho não conflita com "Centro Comunitário Primeira Linha")
    if (
      !candidate.hasName &&
      (baselineCanonical.startsWith(candidate.canonical) ||
        (baselineType.length > 0 && candidate.canonical.startsWith(baselineType)))
    ) {
      continue;
    }

    // ignora quando um é claramente subconjunto textual do outro (mesma obra, grafia parcial)
    if (
      baselineCanonical.includes(candidate.canonical) ||
      candidate.canonical.includes(baselineCanonical)
    ) {
      continue;
    }

    const isOccupancyMismatch = !candidate.hasName && candidate.type !== baselineType;

    findings.push({
      id: `IDENT-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: source.fileName,
      origem: "regra",
      prioridade: "Alta",
      pagina: String(candidate.page),
      capitulo: "Identidade da obra no documento",
      categoria: "nome da obra/unidade",
      referencia_comparada: `${declared ? "Obra declarada (gabarito)" : "Obra dominante"}: ${baselineDisplay}`,
      local: isOccupancyMismatch ? "tipo de ocupação" : "nome da obra/unidade",
      tipo: isOccupancyMismatch
        ? "Tipo de ocupação divergente no mesmo documento"
        : "Nome de obra/unidade divergente no mesmo documento",
      descricao: isOccupancyMismatch
        ? `A ${baselineLabel} é "${baselineDisplay}", mas a página ${candidate.page} menciona "${candidate.display}" — possível trecho reaproveitado de outro projeto.`
        : `A ${baselineLabel} é "${baselineDisplay}", mas a página ${candidate.page} cita "${candidate.display}" — indício de texto reaproveitado de outro projeto.`,
      evidencia: candidate.evidence,
      termo_busca: candidate.display.slice(0, 160),
      conflito: `"${candidate.display}" diverge da ${baselineLabel} "${baselineDisplay}".`,
      sugestao_correcao: `Substituir "${candidate.display}" pelo nome correto da obra (${baselineDisplay}) e revisar o capítulo em busca de outros dados reaproveitados.`,
      confianca: "alta",
    });
  }

  return findings;
}
