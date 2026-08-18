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
        prioridade: "Alta",
        /*
         * Bloqueador, não "ponto de conferência" (mudou em 12/08/2026).
         *
         * A faixa técnica é para o que exige DECISÃO de um responsável técnico
         * antes de executar — falta uma informação, alguém decide. Aqui não
         * falta informação: o documento diz duas coisas que se anulam, e quem
         * ler não consegue aplicar nenhuma das duas. Um contrato que se
         * contradiz sobre qual peça prevalece não é conferível, é defeituoso.
         *
         * Chamada de negócio, e reversível: se a preferência for que só
         * incompletude segure a emissão, basta voltar para tecnico_contratual
         * aqui e no teste correspondente.
         */
        impacto: "critico_documental",
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

  /*
   * 8) Material das ferragens declarado de duas formas incompatíveis.
   *
   * "do mesmo material das esquadrias" (que o próprio documento define como
   * alumínio anodizado) × "todas as ferragens em Inox". Uma coisa ou outra.
   *
   * Por que virou regra: no 063-26 o modelo passou batido nas duas passadas,
   * e o motivo é visível na extração — a página 29 tem NOVE frases contendo
   * "ferragens", e a contradição está enterrada num bloco denso de boilerplate.
   * Não é falha de leitura, é atenção em região densa; e é exatamente o ponto
   * cego que as regras existem para cobrir (mesmo formato da regra 1, que casa
   * duas frases opostas).
   */
  const ferragensComoEsquadria = findFirst(
    extracted,
    /ferragens[\s\S]{0,120}?do\s+mesmo\s+material\s+das\s+esquadrias/i,
  );
  const ferragensInox = findFirst(
    extracted,
    /ferragens\s+em\s+[ai]nox|todas\s+as\s+ferragens\s+em\s+[ai]nox/i,
  );

  if (ferragensComoEsquadria && ferragensInox) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media/Alta",
        impacto: "tecnico_contratual",
        pagina: `${ferragensComoEsquadria.page} e ${ferragensInox.page}`,
        capitulo: "Esquadrias e ferragens",
        local: "material das ferragens",
        tipo: "Material das ferragens contraditório",
        descricao:
          "O memorial especifica o material das ferragens de duas formas incompatíveis: em um trecho elas acompanham o material das esquadrias, em outro devem ser todas em inox.",
        evidencia: `Pág. ${ferragensComoEsquadria.page}: "${ferragensComoEsquadria.evidence.trim()}" | Pág. ${ferragensInox.page}: "${ferragensInox.evidence.trim()}"`,
        termo_busca: "do mesmo material das esquadrias",
        conflito:
          "Ferragens no material das esquadrias (alumínio) e ferragens em inox são especificações excludentes para a mesma peça.",
        sugestao_correcao:
          "Definir um único material para as ferragens das portas de alumínio e uniformizar as duas seções, conferindo com o detalhamento das esquadrias.",
      }),
    );
  }

  // 9) Marca especificada sem "ou similar" — obra pública não admite marca fechada.
  for (const marcaFinding of runBrandWithoutSimilarRule(extracted, fileName, nextId)) {
    findings.push(marcaFinding);
  }

  // 10) Referência a item que não existe no documento.
  for (const refFinding of runBrokenCrossReferenceRule(extracted, fileName, nextId)) {
    findings.push(refFinding);
  }

  // 11) Parágrafo repetido literalmente.
  for (const dupFinding of runDuplicateParagraphRule(extracted, fileName, nextId)) {
    findings.push(dupFinding);
  }

  // 12) O documento declarando que ele mesmo NÃO atende.
  for (const naoConforme of runDeclaredNonComplianceRule(extracted, fileName, nextId)) {
    findings.push(naoConforme);
  }

  // 13) Subitens irmãos com o mesmo título.
  for (const tituloDup of runSiblingDuplicateTitleRule(extracted, fileName, nextId)) {
    findings.push(tituloDup);
  }

  return findings;
}

// --- Regra 13: subitens irmãos com o mesmo título ----------------------------

/*
 * "3.4.7 PINTURA ACRÍLICA" e "3.4.8 PINTURA ACRÍLICA".
 *
 * É a assinatura do copia-e-cola: alguém duplicou o bloco para escrever o
 * próximo material e esqueceu de trocar o nome. Quem lê o índice vê dois itens e
 * não sabe qual descreve o quê — e quem executa não sabe qual seguir.
 *
 * SÓ IRMÃOS, e é isto que torna a regra utilizável. "GENERALIDADES",
 * "OBJETIVO" e "MATERIAIS" repetidos sob capítulos DIFERENTES são a estrutura
 * normal de um memorial: todo capítulo abre assim. Uma regra que comparasse
 * títulos soltos acusaria isso em todo documento do escritório, e o parecer
 * viraria ruído. Dois itens com o MESMO PAI e o mesmo título, não — aí não há
 * leitura inocente.
 *
 * Não colide com `runDuplicateParagraphRule`: aquela exige 180 caracteres, e
 * título não chega perto disso.
 */

/** "3.4.7 PINTURA ACRÍLICA" — número hierárquico, espaço, título até o fim da linha. */
const TITULO_NUMERADO = /^(\d+(?:\.\d+)+)\s+(\S.{2,118})$/;

function runSiblingDuplicateTitleRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  /** chave: `pai|titulo normalizado` → os itens que a usam. */
  const grupos = new Map<string, { numero: string; pagina: number; bruto: string }[]>();

  for (const page of extracted.pages) {
    for (const linha of page.text.split(/\r?\n/)) {
      const m = TITULO_NUMERADO.exec(linha.trim());
      if (!m) continue;

      const [, numero, tituloBruto] = m;
      const titulo = tituloBruto.trim();

      /*
       * Título não termina em ponto final. É o que separa um cabeçalho de uma
       * frase numerada do corpo ("3.4.7 Aplicar duas demãos sobre a massa.").
       */
      if (titulo.endsWith(".")) continue;
      if (!/[a-zà-ú]/i.test(titulo)) continue;

      const pai = numero.slice(0, numero.lastIndexOf("."));
      const chave = `${pai}|${normalizarParagrafo(titulo)}`;
      const atual = grupos.get(chave);

      if (atual) {
        // Mesmo item citado duas vezes (sumário + corpo) não é duplicata.
        if (atual.some((i) => i.numero === numero)) continue;
        atual.push({ numero, pagina: page.page, bruto: titulo });
        continue;
      }

      grupos.set(chave, [{ numero, pagina: page.page, bruto: titulo }]);
    }
  }

  const findings: AuditFinding[] = [];

  for (const itens of grupos.values()) {
    if (itens.length < 2) continue;

    const numeros = itens.map((i) => i.numero).join(" e ");
    const paginas = [...new Set(itens.map((i) => i.pagina))].join(" e ");

    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media",
        /*
         * Conferência técnica, não bloqueio. Ao contrário da não conformidade
         * declarada, aqui o documento não afirma nada errado sobre a obra — ele
         * está mal escrito. Alguém precisa decidir qual dos dois itens fica com
         * qual nome, e é uma decisão de quem redigiu, não uma emissão indevida.
         */
        impacto: "tecnico_contratual",
        pagina: String(paginas),
        capitulo: `Itens ${numeros}`,
        local: "títulos de subitens irmãos",
        tipo: "Títulos duplicados em subitens irmãos",
        descricao: `Os subitens ${numeros} têm o mesmo título ("${itens[0].bruto}"). Sendo do mesmo item pai, é assinatura de bloco duplicado sem o nome ter sido trocado.`,
        evidencia: itens.map((i) => `${i.numero} ${i.bruto} (p. ${i.pagina})`).join(" | "),
        termo_busca: itens[0].bruto.slice(0, 60),
        conflito:
          "Dois itens irmãos com o mesmo nome deixam o índice ambíguo: quem executa não sabe qual dos dois seguir, e a remissão a um deles aponta para os dois.",
        sugestao_correcao:
          "Renomear um dos itens para descrever o que ele de fato especifica, ou fundi-los num item só se descreverem a mesma coisa.",
      }),
    );
  }

  return findings;
}

// --- Regra 12: não conformidade declarada pelo próprio documento -------------

/*
 * "Atende? Não" — o memorial se acusando.
 *
 * É a classe de achado mais barata e mais grave que existe: não há inferência,
 * julgamento nem contexto a interpretar. O documento afirma, por escrito, que
 * alguma exigência não é atendida, e mesmo assim segue para emissão. No 084_25
 * (Bloco H, p. 188) era uma saída de emergência, e o parecer não viu.
 *
 * POR QUE SÓ AGORA. Estas declarações moram em TABELA de verificação, e até
 * 17/08/2026 a extração achatava a página numa linha só — a resposta "Não"
 * ficava colada no texto vizinho e não havia como saber que era uma célula. Com
 * a quebra de linha preservada, a posição volta a significar alguma coisa.
 *
 * O QUE DECIDE A QUALIDADE DA REGRA é o falso positivo por CONDICIONAL. "Caso o
 * material não atenda, deverá ser substituído" é instrução normal de memorial —
 * hipótese, não confissão. Uma regra que confunda as duas acusa praticamente
 * todo memorial do escritório, e regra que grita em todo documento é regra que
 * se aprende a ignorar. Daí as duas exigências abaixo, ambas conservadoras:
 *
 *   1. a declaração tem de estar em POSIÇÃO DE RESPOSTA — sozinha na linha, ou
 *      fechando a linha depois de um rótulo com "?" ou ":";
 *   2. a linha não pode ser regida por conjunção condicional.
 *
 * Conservador de propósito: perder uma declaração real custa um achado; inundar
 * o parecer de hipóteses custa a confiança no parecer inteiro.
 */

/** "Atende? Não", "Atende: Nao", "Conforme? Não" — rótulo, pontuação, resposta. */
const RESPOSTA_NAO =
  /^(.{0,60}?(?:atende|atendido|conforme|conformidade|aprovado)[^\n]{0,20}?[?:])\s*(n[ãa]o)\s*$/i;

/** A linha inteira é só a negativa: "NÃO ATENDE", "NÃO CONFORME". */
const NEGATIVA_ISOLADA =
  /^\s*(n[ãa]o\s+(?:atende|atendido|conforme|est[áa]\s+conforme))\b[^\n]{0,40}$/i;

/**
 * Conjunção condicional que transforma a frase em HIPÓTESE.
 *
 * O `se` exige lookbehind de hífen: em português, `-se` REFLEXIVO
 * ("constatou-se", "verifica-se") casaria com `\bse\b` e mataria em silêncio
 * toda declaração numa linha com verbo reflexivo — que é como quadros de
 * verificação costumam ser escritos.
 *
 * É a guarda que separa "o documento declara que não atende" de "se não
 * atender, faça X". Sem ela a regra seria inútil por excesso.
 */
const CONDICIONAL =
  /\b(caso|quando|sempre\s+que|na\s+hip[óo]tese|eventualmente)\b|(?<![-\w])\bse\b/i;

function runDeclaredNonComplianceRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const vistos = new Set<string>();

  for (const page of extracted.pages) {
    for (const linha of page.text.split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa) continue;

      /*
       * A condicional vale para a LINHA inteira, e não só para o trecho casado:
       * "Caso a largura não atenda ao exigido: Não se aplica" tem a hipótese
       * longe da resposta, e olhar só o entorno imediato a perderia.
       */
      if (CONDICIONAL.test(limpa)) continue;

      const resposta = RESPOSTA_NAO.exec(limpa);
      const isolada = resposta ? null : NEGATIVA_ISOLADA.exec(limpa);
      if (!resposta && !isolada) continue;

      const chave = `${page.page}:${limpa.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      findings.push(
        makeFinding(nextId(), {
          arquivo: fileName,
          prioridade: "Alta",
          /*
           * Bloqueia a emissão, e sem hesitação. As outras regras acusam
           * CONTRADIÇÃO — duas partes do documento que não fecham, e alguém
           * precisa decidir qual vale. Aqui não há o que decidir: o documento
           * concorda consigo mesmo em dizer que a exigência não é cumprida.
           * Emitir assim é emitir uma não conformidade conhecida.
           */
          impacto: "critico_documental",
          pagina: String(page.page),
          capitulo: "Verificação de conformidade",
          local: "quadro de verificação",
          tipo: "Não conformidade declarada no documento",
          descricao:
            "O próprio documento declara que uma exigência NÃO é atendida. Não é divergência entre trechos: é uma não conformidade assumida por escrito, que segue para emissão.",
          evidencia: limpa.slice(0, 200),
          termo_busca: limpa.slice(0, 60),
          conflito:
            "Um documento que declara não atender a um requisito e mesmo assim é emitido transfere ao executor uma não conformidade conhecida.",
          sugestao_correcao:
            "Corrigir o projeto para atender à exigência, ou registrar formalmente a justificativa técnica e a aprovação do responsável antes de emitir.",
        }),
      );
    }
  }

  return findings;
}

// --- Regra 10: referência cruzada quebrada -----------------------------------

/*
 * "conforme item 3.6.3" quando 3.6.3 não existe em lugar nenhum do documento.
 *
 * A verificação NÃO tenta reconstruir a árvore de capítulos — parsear título a
 * partir do texto do pdfjs é frágil, e regra frágil vira falso positivo. Basta
 * perguntar se o número referenciado aparece em ALGUM outro lugar: se "3.6.3" só
 * existe dentro da própria remissão, a remissão aponta para o vazio. É
 * conservador de propósito (um item que existe, mesmo mal formatado, não acusa).
 */
const REMISSAO = /\b(?:conforme|ver|vide|previsto\s+no|descrito\s+no|indicado\s+no)\s+(?:o\s+)?(?:item|subitem|se[çc][ãa]o|cap[íi]tulo)\s+(\d+(?:\.\d+){1,4})/gi;

function runBrokenCrossReferenceRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  const quebradas: { page: number; alvo: string; trecho: string }[] = [];
  const vistos = new Set<string>();

  for (const page of extracted.pages) {
    REMISSAO.lastIndex = 0;

    for (const match of page.text.matchAll(REMISSAO)) {
      const alvo = match[1];

      if (vistos.has(alvo)) {
        continue;
      }

      /*
       * Remissão a item de norma EXTERNA não é remissão interna. No 116-25:
       * "Conforme descrito no item 5.11.10 da Norma Técnica N-321.0002" — o item
       * está na norma da concessionária, não no memorial, e cobrá-lo aqui era
       * falso positivo. Mesmo caso de "itens 17.5 e 17.6 desta norma
       * regulamentadora" (NR-10), que é problema de citação, não de remissão.
       */
      const depois = page.text.slice(
        (match.index ?? 0) + match[0].length,
        (match.index ?? 0) + match[0].length + 60,
      );

      if (
        /^\s*d[aeo]s?\s+(norma|nbr|nr\b|in\b|instru|abnt|lei|decreto|portaria|resolu|n-\d)/i.test(depois) ||
        /^\s*desta\s+norma/i.test(depois)
      ) {
        continue;
      }

      // Conta quantas vezes o número aparece no documento inteiro. A própria
      // remissão conta 1; qualquer outra ocorrência (o título do item, outra
      // remissão) já basta para considerar que o alvo existe.
      const ocorrencias = extracted.text.split(alvo).length - 1;

      if (ocorrencias > 1) {
        continue;
      }

      vistos.add(alvo);
      quebradas.push({
        page: page.page,
        alvo,
        trecho: snippet(page.text, match.index ?? 0, 90).replace(/\s+/g, " ").trim(),
      });
    }
  }

  if (quebradas.length === 0) {
    return [];
  }

  return [
    makeFinding(nextId(), {
      arquivo: fileName,
      prioridade: "Media/Alta",
      impacto: "tecnico_contratual",
      pagina: [...new Set(quebradas.map((q) => q.page))].sort((a, b) => a - b).join(", "),
      capitulo: "Remissões internas",
      local: "referência a item do próprio memorial",
      tipo: "Remissão a item inexistente",
      descricao: `${quebradas.length} remissão(ões) apontam para itens que não aparecem em nenhum outro ponto do documento: ${quebradas
        .map((q) => q.alvo)
        .join(", ")}.`,
      evidencia: quebradas.map((q) => `p. ${q.page}: "${q.trecho}"`).join(" | "),
      termo_busca: quebradas[0].alvo,
      conflito:
        "O item referenciado não existe no documento — quem for executar não tem para onde ir, e a exigência fica sem conteúdo.",
      sugestao_correcao:
        "Corrigir a numeração da remissão para o item correto ou incluir o item que ficou faltando.",
      confianca: "media",
    }),
  ];
}

// --- Regra 11: parágrafo repetido --------------------------------------------

/*
 * Duplicação editorial: o mesmo parágrafo escrito duas vezes. No 063-26 o item
 * 3.6.3.2 repete quase palavra por palavra o parágrafo sobre manutenção dos
 * azulejos tipo tijolinho.
 *
 * Cuidados que evitam o falso positivo óbvio — memorial repete MUITA coisa de
 * propósito:
 *  - só parágrafos longos (>= 180 caracteres): frase curta se repete à toa;
 *  - as ocorrências têm de estar na MESMA página;
 *  - comparação normalizada (caixa, acento, espaço), porque o pdfjs quebra
 *    palavra e a repetição raramente é byte a byte.
 *
 * A janela é o que separa defeito de convenção, e foi apertada em duas medições:
 *  - sem janela, o 08-controle-limpo acusava 7 parágrafos. Memorial repete
 *    cláusula geral entre seções distantes de propósito ("os revestimentos
 *    deverão ser executados estritamente de acordo com o projeto", págs. 28 e
 *    30, 29 e 56) — é o estilo do documento, não erro;
 *  - com janela de 1 página ainda sobrava o 05-par-memorial, onde a cláusula de
 *    mão de obra especializada cai nas págs. 30 e 31. Vizinhança não distingue
 *    boilerplate de descuido.
 *
 * Mesma página é o corte que sobrou de pé: o mesmo parágrafo escrito duas vezes
 * na mesma página é escorregão de edição, não convenção. Troca recall por
 * precisão de propósito — duplicação que atravessa a quebra de página escapa.
 */
const MIN_PARAGRAFO = 180;
const MAX_DISTANCIA_DE_PAGINAS = 0;

function normalizarParagrafo(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function runDuplicateParagraphRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  const grupos = new Map<string, { paginas: number[]; amostra: string }>();

  for (const page of extracted.pages) {
    // Frase como unidade: o pdfjs entrega a página como uma linha só, então
    // quebrar por ponto final é o que mais se aproxima de "parágrafo".
    for (const bruto of page.text.split(/(?<=\.)\s+/)) {
      const normalizado = normalizarParagrafo(bruto);

      if (normalizado.length < MIN_PARAGRAFO) {
        continue;
      }

      const atual = grupos.get(normalizado);

      if (atual) {
        atual.paginas.push(page.page);
        continue;
      }

      grupos.set(normalizado, {
        paginas: [page.page],
        amostra: bruto.replace(/\s+/g, " ").trim().slice(0, 160),
      });
    }
  }

  const repetidos = [...grupos.values()].filter((grupo) => {
    if (grupo.paginas.length < 2) {
      return false;
    }

    const espalhamento = Math.max(...grupo.paginas) - Math.min(...grupo.paginas);
    return espalhamento <= MAX_DISTANCIA_DE_PAGINAS;
  });

  if (repetidos.length === 0) {
    return [];
  }

  return [
    makeFinding(nextId(), {
      arquivo: fileName,
      prioridade: "Baixa/Media",
      impacto: "revisao_editorial",
      pagina: [...new Set(repetidos.flatMap((r) => r.paginas))].sort((a, b) => a - b).join(", "),
      capitulo: "Revisão editorial",
      local: "parágrafo repetido",
      tipo: "Parágrafo duplicado no mesmo documento",
      descricao: `${repetidos.length} parágrafo(s) longo(s) aparecem mais de uma vez no documento.`,
      evidencia: repetidos
        .slice(0, 3)
        .map((r) => `p. ${[...new Set(r.paginas)].join(" e ")}: "${r.amostra}…"`)
        .join(" | "),
      termo_busca: repetidos[0].amostra.slice(0, 60),
      conflito:
        "O mesmo texto aparece repetido; se as duas ocorrências forem intencionais, uma delas deve ser remissão à outra.",
      sugestao_correcao:
        "Eliminar a repetição ou substituí-la por remissão ao item onde o texto já está.",
      confianca: "media",
    }),
  ];
}

// --- Regra 9: marca sem "ou similar" ----------------------------------------

/*
 * Em obra pública não se especifica marca: a Lei 14.133/2021 (art. 41) veda a
 * preferência por marca salvo justificativa técnica registrada. O padrão do
 * escritório é escrever sempre "<marca> ou similar".
 *
 * A âncora NÃO é uma lista de marcas — é a convenção do próprio memorial. O
 * escritório declara produto sob "Tipo comercial:" / "Protótipo comercial:", e
 * no 063-26 quase todas as ocorrências já trazem "ou similar" ("Eliane ou
 * similar", "Suvinil ou similar", "Optimirror (Saint-Gobain Glass) ou similar").
 * Conferir a convenção contra ela mesma dá precisão alta e zero manutenção de
 * dicionário — uma lista de marcas envelheceria e deixaria passar o resto.
 *
 * Consolidado: um achado com TODAS as ocorrências, não um por marca.
 */

/** aceita "ou similar", "ou equivalente", "ou de qualidade equivalente" */
const RESSALVA_DE_SIMILAR = /\bou\s+(?:similar|equivalente|de\s+qualidade\s+equivalente)/i;

/** onde o escritório declara produto comercial */
const DECLARACAO_COMERCIAL = /(?:prot[óo]tipo|tipo)\s+comercial\s*:?\s+/gi;

/*
 * Quanto texto depois da declaração ainda pertence à mesma especificação.
 *
 * 420, e não 220, porque a janela precisa atravessar a quebra de página: o
 * rodapé do memorial sozinho tem ~200 caracteres (nome da obra, caminho do
 * .odm, aviso de direitos autorais). No 063-26 a barra de apoio da p.35 termina
 * exatamente no rodapé e o "/ Deca ou similar." está na primeira linha da p.36 —
 * com janela curta e presa à página, isso virava falso positivo.
 */
const ALCANCE_DA_RESSALVA = 420;

function runBrandWithoutSimilarRule(
  extracted: ExtractedPdf,
  fileName: string,
  nextId: () => string,
): AuditFinding[] {
  const semRessalva: { page: number; trecho: string }[] = [];

  extracted.pages.forEach((page, indice) => {
    DECLARACAO_COMERCIAL.lastIndex = 0;

    // A especificação pode continuar na página seguinte; a janela acompanha.
    const continuacao = extracted.pages[indice + 1]?.text ?? "";

    for (const match of page.text.matchAll(DECLARACAO_COMERCIAL)) {
      const inicio = (match.index ?? 0) + match[0].length;
      const janela = (page.text.slice(inicio) + " " + continuacao).slice(0, ALCANCE_DA_RESSALVA);

      // Corta na PRÓXIMA declaração comercial: sem isso, um "ou similar" do item
      // seguinte cobriria indevidamente o item atual.
      const proxima = janela.search(/(?:prot[óo]tipo|tipo)\s+comercial/i);
      const escopo = proxima >= 0 ? janela.slice(0, proxima) : janela;

      if (RESSALVA_DE_SIMILAR.test(escopo)) {
        continue;
      }

      const trecho = escopo.replace(/\s+/g, " ").trim().slice(0, 90);

      if (trecho.length >= 4) {
        semRessalva.push({ page: page.page, trecho });
      }
    }
  });

  if (semRessalva.length === 0) {
    return [];
  }

  const paginas = [...new Set(semRessalva.map((item) => item.page))].sort((a, b) => a - b);
  const amostra = semRessalva
    .slice(0, 8)
    .map((item) => `p. ${item.page}: "${item.trecho}"`)
    .join("; ");

  return [
    makeFinding(nextId(), {
      arquivo: fileName,
      prioridade: "Alta",
      /*
       * Bloqueador: marca fechada em memorial de obra pública é não conformidade
       * legal, não ponto de conferência técnica. Vai a licitação assim e vira
       * impugnação. Reversível aqui se o escritório preferir tratar como técnico.
       */
      impacto: "critico_documental",
      pagina: paginas.join(", "),
      capitulo: "Especificação de materiais",
      local: "declaração de produto comercial",
      tipo: "Marca especificada sem a ressalva 'ou similar'",
      descricao: `${semRessalva.length} especificação(ões) de produto comercial não trazem "ou similar" nem "ou equivalente". Em obra pública a marca não pode ser fechada sem justificativa técnica registrada (Lei 14.133/2021, art. 41).`,
      evidencia: amostra,
      termo_busca: "tipo comercial",
      conflito:
        'O próprio memorial adota o padrão "<marca> ou similar" na maioria das especificações; nestas a ressalva está ausente, fechando a marca.',
      sugestao_correcao:
        'Acrescentar "ou similar" (ou "ou equivalente") após a marca em cada ocorrência listada. Se alguma marca for realmente exclusiva, registrar a justificativa técnica exigida pelo art. 41 no próprio memorial.',
    }),
  ];
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

/**
 * A tabela é um QUADRO DE ÁREAS DA EDIFICAÇÃO?
 *
 * É o guarda do qualificador, e a lição que a análise de arquitetura já tinha
 * tirado do Ledger, aplicada antes de o Ledger existir: **estruturar sem
 * qualificar é fábrica de falso positivo**. Uma tabela de área de PINTURA também
 * fecha com TOTAL em m², e compará-la com a área construída produziria
 * exatamente o "Escola Geral" de novo — um número certo lido como se fosse
 * outra coisa.
 *
 * Duas primeiras linhas porque quadro de áreas costuma abrir com um título que
 * ocupa a linha inteira antes do cabeçalho de colunas.
 *
 * Conservador nos dois sentidos, e de propósito: perder um quadro real custa um
 * achado; comparar grandezas diferentes custa a confiança no parecer inteiro.
 */
function ehQuadroDeAreas(tabela: { linhas: string[][] }): boolean {
  const cabecalho = tabela.linhas.slice(0, 2).flat().join(" ");
  return /[áa]rea|ambiente|compartimento|depend[êe]ncia/i.test(cabecalho);
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

    /*
     * A MESMA GRANDEZA, LIDA DA TABELA.
     *
     * Nenhuma comparação nova: o piso de plausibilidade, a tolerância de 0,5 m²
     * e o disparo em dois valores distintos estão logo abaixo e já eram
     * testados. A tabela entra só como segunda fonte do mesmo fato — o que
     * faltava era enxergá-la.
     *
     * E era estrutural: a âncora de prosa acima ("área total construída" a até
     * 25 caracteres do número) é o que torna a regra precisa no texto corrido, e
     * é a mesma coisa que a tornava cega na célula, onde não há frase alguma
     * antes do número.
     */
    for (const tabela of page.tabelas ?? []) {
      if (!ehQuadroDeAreas(tabela)) continue;

      for (const linha of tabela.linhas) {
        if (!linha.some((celula) => /^\s*total\b/i.test(celula))) continue;

        for (const celula of linha) {
          const bruto = /^\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:m(?:²|2))?\s*$/.exec(celula);
          if (!bruto) continue;

          const valorDaCelula = parseAreaValue(bruto[1]);
          if (valorDaCelula === null || valorDaCelula < 10) continue;

          found.push({
            page: page.page,
            value: valorDaCelula,
            display: `${bruto[1]} m²`,
            evidence: `quadro de áreas, linha "${linha.filter(Boolean).join(" | ")}"`,
          });
          break;
        }
      }
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
