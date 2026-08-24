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

/**
 * PALAVRAS QUE QUALIFICAM UM TIPO, MAS NÃO IDENTIFICAM UM PRÉDIO.
 *
 * Falso positivo medido numa auditoria real (24/08/2026): "ESCOLA GERAL" —
 * cabeçalho do grupo de definições técnicas comuns a todas as escolas do
 * programa — era acusado de divergir da obra declarada, como se fosse o nome de
 * outro empreendimento.
 *
 * A causa está em `isProperNameWord`, que decide nome próprio pela CAIXA da
 * primeira letra. Memorial escreve cabeçalho em CAIXA ALTA, então toda palavra
 * de um cabeçalho satisfaz o teste — e "GERAL" virava nome próprio.
 *
 * O estrago não para em um achado errado: um nome próprio falso faz `hasName`
 * verdadeiro, e `hasName` verdadeiro PULA a guarda de moldura assertiva
 * (`isOccupancyAssertion`), que existe justamente para descartar tipo solto. O
 * falso nome desarmava a defesa que já estava lá.
 *
 * O TESTE É SOBRE O NOME INTEIRO, nunca sobre a palavra aparecer: "Hospital
 * Geral de Blumenau" identifica um prédio e continua identificando, porque
 * "Blumenau" sobra. O que não identifica nada é o nome em que só resta
 * qualificador.
 */
const QUALIFICADORES_SEM_IDENTIDADE = new Set([
  "geral",
  "gerais",
  "padrao",
  "padroes",
  "tipo",
  "tipos",
  "modelo",
  "modelos",
  "comum",
  "comuns",
  "generico",
  "generica",
  "basico",
  "basica",
  "unico",
  "unica",
]);

/**
 * O recorte de `trimProperName` é mesmo um nome próprio?
 *
 * Falso quando sobra só qualificador e conector — aí não há prédio nenhum
 * sendo nomeado, e a menção volta a valer o que ela é: um tipo solto, sujeito à
 * guarda de moldura assertiva como qualquer outro.
 */
function ehNomeProprio(name: string): boolean {
  const palavras = baseCanonical(name)
    .split(" ")
    .filter((p) => p.length > 0);

  return palavras.some(
    (p) => !QUALIFICADORES_SEM_IDENTIDADE.has(p) && !NAME_CONNECTORS.has(p),
  );
}

type FacilityMention = {
  display: string;
  canonical: string;
  type: string;
  hasName: boolean;
  /** O nome próprio sozinho, canônico ("rubens de arruda ramos"). Vazio se não houver. */
  properName: string;
  page: number;
  evidence: string;
};

/*
 * QUANDO UM TIPO SOLTO É UMA AFIRMAÇÃO DE IDENTIDADE — e quando é só vocabulário.
 *
 * "ginásio", "escola", "hospital" são substantivos comuns antes de serem
 * identidade. Num memorial de reforma de escola, "a cobertura metálica do
 * ginásio deverá ser revisada" descreve uma PARTE da obra; a regra lia isso como
 * "o documento declara que esta obra é um ginásio" e emitia um achado de
 * prioridade Alta que `classifyFindingImpact` ainda promovia a crítico
 * documental (o escopo "tipo de ocupação" cai em `ocupacao`). Um substantivo
 * comum virava o achado mais grave do parecer.
 *
 * O caso legítimo tem forma gramatical própria: "POR SE TRATAR DE uma unidade
 * básica de saúde os cálculos das larguras das portas..." — aí o documento
 * AFIRMA o que a edificação é, e isso é texto reaproveitado de outro projeto (é
 * o erro 4 do memorial 017_26, coberto por teste).
 *
 * Por isso o gate é um ALLOWLIST de molduras assertivas, e não uma negativa: a
 * lista de jeitos de mencionar um ginásio de passagem é infinita; a lista de
 * jeitos de declarar a ocupação de uma edificação é curta e estável. Regra é
 * fato objetivo — sem moldura assertiva não há fato de identidade, e o que
 * depende de contexto é trabalho da IA, não da regra.
 *
 * Só vale para menção SEM nome próprio: "Creche Vovó Maria" é identidade em
 * qualquer moldura.
 */
const OCCUPANCY_ASSERTION_FRAMES = [
  /\b(?:por\s+se\s+)?trata(?:r|-se)?\s+de\s+(?:um|uma|o|a)?\s*$/i,
  /\bocupa[çc][ãa]o\s*(?:é|e|:|da\s+edifica[çc][ãa]o\s*(?:é|e|:))?\s*(?:um|uma|o|a)?\s*$/i,
  /\bclassificad[oa]s?\s+como\s+(?:um|uma)?\s*$/i,
  /\b(?:edifica[çc][ãa]o|edif[íi]cio|im[óo]vel|obra|empreendimento)\s+(?:é|e)\s+(?:um|uma)?\s*$/i,
  /\bdestina(?:-se|da|do)?\s+a\s+(?:um|uma)?\s*$/i,
  /\b(?:tipo\s+de\s+)?uso\s*:\s*$/i,
];

function isOccupancyAssertion(prefix: string) {
  const limpo = prefix.replace(/\s+/g, " ");
  return OCCUPANCY_ASSERTION_FRAMES.some((frame) => frame.test(limpo));
}

/**
 * A SIGLA E O NOME POR EXTENSO SÃO O MESMO EQUIPAMENTO.
 *
 * Falso positivo medido no 117_25 (18/08/2026): a regra acusou
 *
 *   "Unidade Básica de Saúde Vila Manaus Porte" diverge da obra declarada
 *   (gabarito) "UBS VILA MANAUS"
 *
 * — que é o nome CORRETO da obra escrito por extenso. A validação por IA marcou
 * este achado para remoção com o motivo certo ("não há nome de outra obra"), e
 * `route.ts` descartou o veredito dela, porque achado de regra é protegido.
 * A proteção existe porque regra não alucina; só que não alucinar não é o mesmo
 * que estar certo — uma expressão regular pode estar precisamente errada.
 *
 * Memorial de obra pública alterna as duas formas o tempo todo: a capa traz a
 * sigla, o capítulo traz o nome por extenso, e às vezes os dois na mesma frase
 * ("a UBS – Unidade Básica de Saúde Vila Manaus"). Contrair a expansão para a
 * sigla ANTES de comparar faz as duas formas caírem no mesmo canônico.
 *
 * Contrai, e não expande, de propósito: a sigla é a forma curta e estável, e
 * nomes próprios distintos continuam distintos ("emeb aurora" ≠ "emeb rubens").
 */
const SIGLAS_DE_EQUIPAMENTO: { sigla: string; extenso: RegExp }[] = [
  { sigla: "ubs", extenso: /\bunidade\s+basica\s+de\s+saude\b/g },
  { sigla: "upa", extenso: /\bunidade\s+de\s+pronto\s+atendimento\b/g },
  { sigla: "emeb", extenso: /\bescola\s+municipal\s+de\s+ensino\s+basic[oa]\b/g },
  { sigla: "emeif", extenso: /\bescola\s+municipal\s+de\s+ensino\s+fundamental\b/g },
  { sigla: "eeb", extenso: /\bescola\s+de\s+educacao\s+basica\b/g },
  { sigla: "cei", extenso: /\bcentro\s+de\s+educacao\s+infantil\b/g },
  { sigla: "cras", extenso: /\bcentro\s+de\s+referencia\s+de\s+assistencia\s+social\b/g },
  { sigla: "caps", extenso: /\bcentro\s+de\s+atencao\s+psicossocial\b/g },
  { sigla: "esf", extenso: /\bestrategia\s+saude\s+da\s+familia\b/g },
];

function facilityCanonical(value: string) {
  let canonical = baseCanonical(value).replace(/\s+/g, " ").trim();

  for (const { sigla, extenso } of SIGLAS_DE_EQUIPAMENTO) {
    extenso.lastIndex = 0;
    canonical = canonical.replace(extenso, sigla);
  }

  /*
   * "ubs ubs vila manaus" vira "ubs vila manaus": o memorial escreve
   * "a UBS – Unidade Básica de Saúde Vila Manaus", e as duas formas na mesma
   * frase produziriam a sigla duplicada.
   */
  canonical = canonical.replace(/\b(\w+)( \1\b)+/g, "$1");

  /*
   * "BAIRRO" É LIGAÇÃO, NÃO NOME.
   *
   * O 117_25 escreve "UBS Vila Manaus" na capa e "Unidade Básica de Saúde
   * Bairro Vila Manaus" no capítulo 7 — a mesma obra, com a palavra de ligação
   * no meio, e a regra acusava divergência. O benchmark externo não lista isso
   * como achado, e com razão.
   *
   * Só esta palavra, e só aqui: o que distingue duas obras é o nome próprio que
   * vem depois ("Vila Francesa" continua divergindo de "Vila Manaus"), nunca o
   * conector. Tirar mais que isso começaria a fundir obras de verdade.
   */
  canonical = canonical.replace(/\bbairro\b/g, " ");

  return canonical.replace(/\s+/g, " ").trim();
}

/**
 * Palavras que não identificam obra nenhuma: conector e qualificador de esfera.
 *
 * "Hospital Municipal Nossa Senhora" e "Hospital Nossa Senhora" são o mesmo
 * hospital; "de Navegantes" e "dos Navegantes" são o mesmo lugar. O que
 * identifica é o nome próprio, e ele nunca está nesta lista.
 */
const TOKENS_SEM_IDENTIDADE = new Set([
  "de", "do", "da", "dos", "das", "e", "no", "na", "em",
  "municipal", "estadual", "federal", "publico", "publica", "novo", "nova",
]);

function tokensDeObra(canonical: string): Set<string> {
  return new Set(
    canonical.split(" ").filter((t) => t.length > 0 && !TOKENS_SEM_IDENTIDADE.has(t)),
  );
}

/**
 * Um nome é o outro escrito de outro jeito?
 *
 * Verdadeiro quando um conjunto de palavras contém o outro. Exige duas palavras
 * significativas no menor dos dois: com uma só, "Hospital" casaria com qualquer
 * hospital, e a regra pararia de acusar troca de obra — que é a coisa que ela
 * existe para achar.
 */
function mesmaObraPorTokens(a: string, b: string): boolean {
  const ta = tokensDeObra(a);
  const tb = tokensDeObra(b);
  const menor = ta.size <= tb.size ? ta : tb;
  const maior = menor === ta ? tb : ta;

  if (menor.size < 2) return false;

  for (const token of menor) {
    if (!maior.has(token)) return false;
  }
  return true;
}

function collectFacilityMentions(source: CrossDocumentSource): FacilityMention[] {
  const mentions: FacilityMention[] = [];

  for (const page of source.extracted.pages) {
    FACILITY_PATTERN.lastIndex = 0;

    for (const match of page.text.matchAll(FACILITY_PATTERN)) {
      const typeRaw = match[1] ?? "";
      const name = trimProperName(match[2] ?? "");
      const type = baseCanonical(typeRaw);
      // `ehNomeProprio` e não `length > 0`: "ESCOLA GERAL" tem recorte, e o
      // recorte não nomeia obra nenhuma. Ver QUALIFICADORES_SEM_IDENTIDADE.
      const hasName = ehNomeProprio(name);
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

      /*
       * Tipo solto fora de moldura assertiva não é menção de identidade — é a
       * palavra "ginásio" no meio de uma frase sobre a cobertura dele. Descartado
       * AQUI, na coleta, e não só na emissão: contado como menção ele ainda
       * disputaria a dominância do documento e poderia virar a "obra
       * predominante" de um memorial que só cita o próprio pátio.
       */
      if (!hasName && !isOccupancyAssertion(page.text.slice(0, match.index ?? 0).slice(-80))) {
        continue;
      }

      mentions.push({
        display,
        canonical,
        type,
        hasName,
        properName: hasName ? facilityCanonical(name) : "",
        page: page.page,
        evidence: extractEvidence(page.text, match.index ?? 0),
      });
    }
  }

  return mentions;
}

/**
 * Extrai tipo+canônico do nome de obra declarado no gabarito (item 1).
 *
 * `fullCanonical` é o gabarito INTEIRO normalizado, e existe porque o recorte
 * por tipo é frágil justamente nos nomes reais. O gabarito "Reforma e Adequação
 * da Emeb (escola Municipal de Ensino Básico) Rubens de Arruda Ramos" tem a
 * primeira âncora de tipo dentro do PARÊNTESE, e o `[^...()...]` da
 * FACILITY_PATTERN faz a captura parar no fecha-parêntese: o baseline virava
 * "escola municipal de ensino basico" e o nome próprio da obra — "Rubens de
 * Arruda Ramos", a única parte que identifica o prédio — era descartado. Daí a
 * página que citava "Escola Rubens de Arruda Ramos" ser acusada de falar de
 * OUTRA obra. Ver o teste "gabarito com aposto entre parênteses".
 *
 * Consertar o recorte não bastaria: "Emeb" não está (nem deve estar) na lista de
 * tipos, e todo gabarito real traz prefixo de serviço ("Reforma e Adequação
 * da..."). O que sempre vale é a CONTENÇÃO — se o nome próprio citado na página
 * está escrito dentro do gabarito, é a mesma obra, qualquer que seja o tipo
 * usado para nomeá-la.
 */
function parseDeclaredObra(
  declared: string,
): { canonical: string; type: string; display: string; fullCanonical: string } | null {
  const trimmed = declared.trim();

  if (trimmed.length < 3) {
    return null;
  }

  const fullCanonical = facilityCanonical(trimmed);

  FACILITY_PATTERN.lastIndex = 0;
  const match = FACILITY_PATTERN.exec(trimmed);

  if (match) {
    const typeRaw = match[1] ?? "";
    const name = trimProperName(match[2] ?? "");
    const type = baseCanonical(typeRaw);
    const hasName = name.length > 0;
    const canonical = facilityCanonical(hasName ? `${type} ${name}` : type);

    if (canonical.length >= 3) {
      return { canonical, type, display: trimmed, fullCanonical };
    }
  }

  return fullCanonical.length >= 3
    ? { canonical: fullCanonical, type: "", display: trimmed, fullCanonical }
    : null;
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

    /*
     * OMITIR OU ACRESCENTAR PALAVRA É A MESMA OBRA. TROCAR NOME PRÓPRIO NÃO É.
     *
     * A contenção por substring acima não alcança a variação real, porque a
     * palavra a mais entra NO MEIO. Medido no acervo (18/08/2026), memorial do
     * Hospital Nossa Senhora dos Navegantes, com quatro acusações e as quatro
     * falsas:
     *
     *   "Hospital Municipal Nossa Senhora dos Navegantes"  (+ "Municipal")
     *   "HOSPITAL MUNICIPAL NOSSA SENHORA"                 (captura truncada)
     *   "Hospital Nossa Senhora de Navegantes"             ("de" por "dos")
     *   "Hospital de Navegantes"                           (forma curta)
     *
     * Todas são o mesmo hospital. Nenhuma é substring da outra.
     *
     * Comparar CONJUNTO DE PALAVRAS, sem conectores nem qualificador genérico,
     * separa as duas coisas que importam: um nome que só omite ou só acrescenta
     * palavras é o mesmo nome escrito de outro jeito; um nome que TROCA o nome
     * próprio é outra obra. É por isso que "UBS Vila Francesa" e "UBS Paraíso"
     * continuam divergindo de "UBS Vila Manaus" — nenhum é subconjunto do outro,
     * porque cada um traz um próprio que o outro não tem.
     */
    if (mesmaObraPorTokens(candidate.canonical, baselineCanonical)) {
      continue;
    }

    /*
     * O NOME PRÓPRIO CITADO ESTÁ ESCRITO NO GABARITO → é a mesma obra.
     *
     * Este é o teste que sobrevive ao gabarito real, onde o recorte por tipo
     * falha: "Escola Rubens de Arruda Ramos" na página 124 contra o gabarito
     * "Reforma e Adequação da Emeb (escola Municipal de Ensino Básico) Rubens de
     * Arruda Ramos". Os canônicos de TIPO+NOME não se contêm (um diz "escola
     * municipal de ensino basico", o outro "escola rubens de arruda ramos"), mas
     * "rubens de arruda ramos" está literalmente dentro do gabarito.
     *
     * Compara-se contra o gabarito INTEIRO, e não contra o baseline recortado,
     * porque é justamente o recorte que erra. E só vale com nome próprio: sem
     * ele não há o que conter, e o tipo solto já foi resolvido na coleta.
     *
     * Não afrouxa a detecção real: um memorial da "UBS Santo Antônio" que cite
     * "Creche Vovó Maria" continua sendo acusado — "vovo maria" não está no
     * gabarito.
     */
    if (
      declared &&
      candidate.properName.length >= 3 &&
      declared.fullCanonical.includes(candidate.properName)
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
