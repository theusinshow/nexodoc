import type { AiProvider } from "@/lib/ai-providers";
import type { AuditMode } from "@/lib/audit-mode";
import type { AnalysisLevel } from "@/lib/analysis-level";
/*
 * CAMINHO RELATIVO, e não o alias: este módulo é executado por scripts em node
 * cru (`npm run test:severidade`, `test:audit`), onde `@/` não existe. Os
 * outros imports daqui são `import type` — apagados em tempo de execução, e por
 * isso nunca cobraram o alias. Este é valor, e cobrou: quebrou as duas provas
 * na primeira tentativa.
 */
import { plural } from "./plural.ts";

/**
 * Um capítulo do documento, reduzido ao que identifica o CONTEÚDO dele.
 *
 * Mora aqui, e não em [[audit-fingerprint.ts]], porque é forma do parecer: o
 * módulo que calcula hash importa `node:crypto`, e o relatório é lido também
 * pelo navegador. Tipo no lado de cá, cálculo no lado de lá.
 */
export type CapituloImpresso = {
  titulo: string;
  startPage: number;
  endPage: number;
  chars: number;
  /** sha-256 do texto normalizado do capítulo. */
  hash: string;
};

export type ImpressaoDoArquivo = { arquivo: string; capitulos: CapituloImpresso[] };

/**
 * A síntese por capítulo, chaveada pelo HASH — não pelo índice nem pelo título.
 * É o hash que sobrevive a capítulo inserido no meio, e é por hash que o
 * casamento da impressão digital já funciona.
 *
 * Serve para a reauditoria barata: os capítulos que não mudaram não vão ao
 * modelo em texto integral, vão como uma linha cada. Sem isso, a leitura que
 * recebe só o delta não teria como notar que o capítulo novo contradiz um que
 * ficou parado — e a passada de validação não cobre isso, porque ela só julga
 * candidatos que já existem.
 */
export type SinteseDoArquivo = {
  arquivo: string;
  capitulos: { hash: string; resumo: string }[];
};

export type FindingPriority = "Alta" | "Media/Alta" | "Media" | "Baixa/Media" | "Baixa";
export type FindingConfidence = "alta" | "media" | "baixa";
export type FindingImpact = "critico_documental" | "tecnico_contratual" | "revisao_editorial";

export type AuditFinding = {
  id: string;
  arquivo?: string;
  prioridade: FindingPriority;
  /**
   * POR QUE esta prioridade — a frase que a matriz de severidade escreve
   * (`lib/severidade.ts`), nomeando consequência e certeza. Existe para o
   * critério ser discutível: dá para discordar de uma frase escrita; de um
   * número que ninguém explica, não.
   *
   * Opcional porque parecer antigo não tem: gravados antes desta versão são
   * lidos sem ela, e a tela apenas não mostra a explicação.
   */
  severity_reason?: string;
  pagina: string;
  capitulo: string;
  local: string;
  tipo: string;
  descricao: string;
  evidencia: string;
  termo_busca?: string;
  categoria?: string;
  /**
   * Disciplina LIDA do cabeçalho da página onde o trecho está — fato, não
   * inferência. Vazia quando a página não trazia cabeçalho reconhecível; aí a
   * classificação cai na varredura do texto do achado.
   */
  disciplina?: FindingDiscipline;
  referencia_comparada?: string;
  conflito: string;
  sugestao_correcao: string;
  confianca: FindingConfidence;
  origem?: "regra" | "ia";
  impacto?: FindingImpact;
  // Item 4 — camada de exibição. "principal" = achado sólido (regra ou IA
  // confirmada); "sugestao" = achado de IA que a validação rebaixou em vez de
  // deletar (vai pra seção recolhível "Sugestões da IA — confira").
  tier?: FindingTier;
  /**
   * Este achado veio da auditoria ANTERIOR, de um capítulo byte a byte
   * idêntico, com a página reancorada para o documento novo.
   *
   * O parecer sustenta uma decisão de emitir projeto. Achado que não foi
   * produzido nesta corrida precisa dizer isso — esconder seria afirmar um
   * trabalho que não houve, que é o mesmo defeito das auditorias parciais
   * silenciosas.
   */
  herdado_de?: { auditId: string; quando: string };
};

export type FindingTier = "principal" | "sugestao";

// Regra de camada para a UI de duas camadas (itens 2 e 4):
// - achado de regra é sempre principal (verificado, não alucina);
// - achado de IA explicitamente rebaixado pela validação vai pra "sugestao";
// - achado de IA de baixa confiança também é sugestão.
export function classifyFindingTier(finding: AuditFinding): FindingTier {
  if (finding.origem === "regra") {
    return "principal";
  }

  if (finding.tier) {
    return finding.tier;
  }

  return finding.confianca === "baixa" ? "sugestao" : "principal";
}

/**
 * QUANTO DO DOCUMENTO PASSOU PELO MODELO nesta corrida.
 *
 * O produto media achados, custo e tempo — e nunca cobertura. Foi por isso que
 * uma auditoria que leu 16% do memorial 084_25 atravessou código, testes,
 * relatório e veredito sem disparar nada, e ainda AFIRMOU no parecer ter lido
 * "98 blocos" quando leu 8 (o texto usava o total de capítulos do documento em
 * vez dos que foram lidos).
 *
 * Um auditor que não sabe dizer quanto leu não é auditor. Estes números existem
 * para que o parecer não possa mais falar de si mesmo por cima.
 */
export type CoberturaDoArquivo = {
  /** Caracteres que a leitura global efetivamente enviou ao modelo. */
  caracteres_lidos: number;
  caracteres_totais: number;
  /** Blocos por capítulo que foram ao modelo. */
  blocos_lidos: number;
  /** Blocos que o documento tem — `lidos < totais` é buraco declarado. */
  blocos_totais: number;
  /**
   * Blocos que o PLANO desta corrida pretendia ler.
   *
   * Sem este campo não dá para distinguir "o plano era ler 8 e leu 0" (buraco)
   * de "o plano era ler 0 porque a global lê tudo" (Profundo, por desenho). Os
   * dois casos gravavam `blocos_lidos: 0, blocos_totais: 98`, e a auditoria
   * ficava permanentemente marcada como incompleta — em TODA corrida Profunda.
   * Um alarme que toca sempre não avisa nada, e foi o que se mediu: o parecer
   * que leu o documento inteiro e o parecer cuja leitura global morreu em 503
   * saíram com a MESMA frase.
   *
   * Opcional porque parecer antigo não o tem; nesse caso vale `blocos_totais`,
   * que preserva a leitura de quem já estava gravado.
   */
  blocos_planejados?: number;
};

export type AuditFileSummary = {
  arquivo: string;
  tipo_documento: string;
  paginas?: number;
  caracteres_extraidos?: number;
  resumo: string;
  cobertura?: CoberturaDoArquivo;
};

export type AuditReport = {
  arquivo?: string;
  tipo_auditoria: AuditMode;
  tipo_documento: string;
  runtime?: {
    /**
     * Passadas da análise que não completaram. Vazio = análise íntegra. É o que
     * permite o veredito dizer que não pode ser usado para liberar.
     */
    passadas_incompletas?: { passada: string; motivo?: string }[];
    nivel_analise?: AnalysisLevel;
    motor_auditoria?: "single" | "dual";
    regras_locais_ativas?: boolean;
    provedor_principal?: AiProvider;
    provedor_validacao?: AiProvider;
    modelo_principal?: string;
    modelo_validacao?: string;
    segunda_ia?: {
      ativa?: boolean;
      modelo?: string;
      papel?: "validacao_semantica";
      observacao?: string;
    };
    modelos_operacionais?: {
      identidade?: string;
      leitura_global?: string;
      blocos?: string;
      comparacao_arquivos?: string;
      validacao?: string;
    };
    esforco_raciocinio?: string;
    duracao_ms?: number;
    arquivos?: number;
    gerado_em?: string;
    /**
     * A IMPRESSÃO DIGITAL DO DOCUMENTO, capítulo a capítulo (sha-256 do texto).
     *
     * É o que permite a PRÓXIMA auditoria do mesmo memorial dizer o que mudou —
     * e, na etapa seguinte, mandar ao modelo só isso. Ausente nos pareceres
     * gravados antes de 12/08/2026: quem compara precisa tratar a falta como
     * "não dá para comparar", nunca como "nada mudou". Ver [[audit-fingerprint.ts]].
     */
    impressao?: ImpressaoDoArquivo[];
    /**
     * Qual auditor produziu este parecer. Impressão e síntese só são
     * reaproveitáveis por um auditor da MESMA versão — achado herdado de um
     * prompt anterior é leitura vencida. Ausente (todo parecer anterior a
     * 13/08/2026) significa incomparável, nunca "compatível".
     *
     * HASH desde 17/08/2026 (ver [[versao-do-auditor.ts]]): era um número subido
     * à mão e a disciplina falhou na primeira oportunidade. Pareceres gravados
     * antes disso trazem `1`, que nunca casa com um hash — e não casar é o
     * desfecho correto, porque aquele auditor de fato não existe mais.
     */
    versao_auditor?: string;
    sintese?: SinteseDoArquivo[];
    /**
     * Preenchido só quando a auditoria usou o caminho barato. A ausência dele
     * significa leitura completa — nunca "não sei".
     */
    reauditoria?: {
      base_audit_id: string;
      capitulos_lidos: number;
      capitulos_herdados: number;
      achados_herdados: number;
      promovidos_sem_ancora: string[];
    };
  };
  obra: string;
  codigo: string;
  municipio: string;
  volume?: string;
  orgao?: string;
  data_documento: string;
  status_analise: "concluida" | "parcial" | "falha";
  status_geral:
    | "sem achados críticos"
    | "com pontos de revisão"
    | "com inconsistências críticas"
    | "revisão obrigatória antes de emissão";
  total_incongruencias: number;
  arquivos_analisados: AuditFileSummary[];
  comparacoes: string[];
  incongruencias: AuditFinding[];
  conclusao: string;
};

export function normalizePriority(value: string | undefined): FindingPriority {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("alta") && normalized.includes("media")) {
    return "Media/Alta";
  }

  if (normalized === "alta" || normalized.includes("critica")) {
    return "Alta";
  }

  if (normalized.includes("baixa") && normalized.includes("media")) {
    return "Baixa/Media";
  }

  if (normalized === "baixa") {
    return "Baixa";
  }

  return "Media";
}

export function normalizeConfidence(value: string | undefined): FindingConfidence {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("alta")) {
    return "alta";
  }

  if (normalized.includes("baixa")) {
    return "baixa";
  }

  return "media";
}

export function getPriorityRank(priority: FindingPriority) {
  switch (priority) {
    case "Alta":
      return 0;
    case "Media/Alta":
      return 1;
    case "Media":
      return 2;
    case "Baixa/Media":
      return 3;
    case "Baixa":
      return 4;
    default:
      return 5;
  }
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const FINDING_IMPACTS: FindingImpact[] = [
  "critico_documental",
  "tecnico_contratual",
  "revisao_editorial",
];

/**
 * Lê a faixa declarada pelo modelo. Devolve undefined para valor ausente ou fora
 * do vocabulário — nesse caso `classifyFindingImpact` cai na inferência por
 * palavra-chave, que é o comportamento antigo.
 */
export function parseFindingImpact(value: unknown): FindingImpact | undefined {
  const normalized = normalizeForMatch(String(value ?? "")).replace(/[\s-]+/g, "_");
  return FINDING_IMPACTS.find((impact) => impact === normalized);
}

/*
 * Marcador de template deixado no texto final: XXXX, ____, [ ], <preencher>.
 *
 * É o único sinal forte o bastante para VENCER a faixa declarada pelo modelo.
 * Medido no 063-26 (12/08/2026): o modelo achou os seis "XXXX" da página 6 —
 * escopo, topografia, rua de acesso, área do terreno e área construída — e os
 * declarou "tecnico_contratual". Documento com campo de preenchimento em branco
 * não é ponto de conferência para o responsável técnico: é minuta, e não se
 * emite. Aqui a evidência é literal e não admite leitura alternativa, então a
 * regra ganha do julgamento do modelo.
 *
 * Repare que a busca é na EVIDÊNCIA (texto citado do documento), não na prosa do
 * achado: é o que impede um achado que apenas *fala sobre* preenchimento de
 * subir de faixa sem ter o marcador de verdade.
 */
function hasTemplatePlaceholder(finding: AuditFinding) {
  const quoted = [finding.evidencia ?? "", finding.termo_busca ?? ""].join(" ");

  return (
    /\bx{4,}\b/i.test(quoted) ||
    /_{4,}/.test(quoted) ||
    /<\s*(preencher|inserir|informar)\b/i.test(quoted)
  );
}

export function classifyFindingImpact(finding: AuditFinding): FindingImpact {
  if (hasTemplatePlaceholder(finding)) {
    return "critico_documental";
  }

  // O que o modelo declarou vence a heurística: ele leu o achado inteiro, a
  // heurística só vê tipo/categoria. Achado de regra continua sendo classificado
  // aqui porque a regra não declara faixa.
  if (finding.impacto && FINDING_IMPACTS.includes(finding.impacto)) {
    return finding.impacto;
  }

  // Escopo = a auto-classificação do achado (tipo + categoria). Não inclui o
  // "local" nem a evidência: locais como "Sumário" ou "Título do capítulo"
  // contaminam a decisão (um achado técnico localizado no sumário não é
  // editorial), e a prosa da IA menciona "identidade" sem o achado ser disso.
  const scope = normalizeForMatch([finding.tipo, finding.categoria ?? ""].join(" "));
  const haystack = normalizeForMatch(
    [
      finding.tipo,
      finding.capitulo,
      finding.local,
      finding.descricao,
      finding.evidencia,
      finding.conflito,
      finding.sugestao_correcao,
    ].join(" "),
  );

  // 1) Crítico documental — identidade/localização da obra (o mais grave).
  //    Decidido pelo ESCOPO do achado (tipo/categoria/local), não pela prosa:
  //    a IA menciona "identidade"/"obra" em muitas descrições sem que o achado
  //    seja de identidade — usar o haystack completo inflava os críticos.
  if (
    scope.includes("nome da obra") ||
    scope.includes("nome de obra") ||
    scope.includes("obra/unidade") ||
    scope.includes("identidade") ||
    scope.includes("identificacao") ||
    scope.includes("ocupacao") ||
    scope.includes("municipio") ||
    scope.includes("proprietario") ||
    scope.includes("endereco") ||
    scope.includes("logradouro") ||
    scope.includes("bairro") ||
    scope.includes("ubs")
  ) {
    return "critico_documental";
  }

  // 1b) Documento não finalizado — campo em branco, marcador de template (XXXX,
  //     ___), sumário que não bate com o corpo, resíduo textual de outro
  //     empreendimento. Impede emitir tanto quanto trocar o nome da obra.
  //     Antes isto caía no fallback e virava "revisao_editorial": foi assim que
  //     os seis XXXX da página 6 do 063-26 sumiram do topo do relatório.
  if (
    scope.includes("completude") ||
    scope.includes("nao finalizad") ||
    scope.includes("nao preenchid") ||
    scope.includes("preenchimento") ||
    scope.includes("template") ||
    scope.includes("minuta") ||
    // Prevalência documental contraditória: o documento diz duas coisas que se
    // anulam e nenhuma pode ser aplicada. Casado pelo ESCOPO (tipo+categoria),
    // não pelo haystack — "hierarquia" solto na prosa também descreve numeração
    // de itens fora de ordem, que é editorial.
    scope.includes("prevalenc") ||
    scope.includes("hierarquia documental") ||
    // "reaproveitado"/"resíduo" NÃO entram: o tipo "Trecho reaproveitado / norma
    // suspeita" é usado pelo modelo em achados que só citam identidade na prosa,
    // e classificá-los como críticos foi falso positivo antes (teste em
    // scripts/test-audit-consistency.ts). Reaproveitamento real chega pelo campo
    // `impacto` declarado, que tem precedência no topo desta função.
    scope.includes("sumario") ||
    scope.includes("indice") ||
    /\bxxxx+\b/.test(haystack) ||
    haystack.includes("campo em branco") ||
    haystack.includes("nao preenchid")
  ) {
    return "critico_documental";
  }

  // 2) Revisão editorial — decidido pelo TIPO/CATEGORIA do achado (grafia,
  //    redação, formatação, numeração, duplicidade). Evita "titulo"/"sumario"
  //    soltos, que são locais e não indicam natureza editorial.
  if (
    scope.includes("reda") ||
    scope.includes("grafia") ||
    scope.includes("ortograf") ||
    scope.includes("formata") ||
    scope.includes("acentua") ||
    scope.includes("editorial") ||
    scope.includes("numeracao") ||
    scope.includes("duplicad") ||
    scope.includes("repetid")
  ) {
    return "revisao_editorial";
  }

  // 3) Técnico/contratual.
  if (
    haystack.includes("hierarquia") ||
    haystack.includes("prevalenc") ||
    haystack.includes("responsabilidade") ||
    haystack.includes("terraplenagem") ||
    haystack.includes("linguagem rodoviaria") ||
    haystack.includes("eixo da rodovia") ||
    haystack.includes("quadro de origem e destino") ||
    haystack.includes("dnit") ||
    haystack.includes("norma") ||
    haystack.includes("calculo") ||
    haystack.includes("autonomia") ||
    haystack.includes("carga termica") ||
    haystack.includes("referencia municipal") ||
    haystack.includes("comcap") ||
    haystack.includes("prancha") ||
    haystack.includes("revisao") ||
    scope.includes("escopo")
  ) {
    return "tecnico_contratual";
  }

  return "revisao_editorial";
}

// --- Classificação por DISCIPLINA e por TIPO DE ERRO (filtros do resultado) ----
// Derivadas por palavra-chave dos campos do achado (memorial é organizado por
// disciplina, então o texto do capítulo/categoria carrega o sinal). Determinístico
// e de graça; achado ambíguo cai em "geral"/"tecnico".

export type FindingDiscipline =
  | "arquitetura"
  | "estrutural"
  | "hidrossanitario"
  | "eletrico"
  | "ppci"
  | "cabeamento"
  | "terraplenagem"
  | "paisagismo"
  | "acessibilidade"
  | "geral";

export type FindingErrorType =
  | "identidade"
  | "escopo"
  | "norma"
  | "quantitativo"
  | "especificacao"
  | "editorial"
  | "tecnico";

const DISCIPLINE_LABELS: Record<FindingDiscipline, string> = {
  arquitetura: "Arquitetura",
  estrutural: "Estrutural",
  hidrossanitario: "Hidrossanitário",
  eletrico: "Elétrico",
  ppci: "PPCI / Incêndio",
  cabeamento: "Cabeamento / CFTV",
  terraplenagem: "Terraplenagem / Urbanização",
  paisagismo: "Paisagismo",
  acessibilidade: "Acessibilidade",
  geral: "Geral / Documental",
};

const ERROR_TYPE_LABELS: Record<FindingErrorType, string> = {
  identidade: "Identidade / documental",
  escopo: "Escopo / contratual",
  norma: "Norma",
  quantitativo: "Quantitativo",
  especificacao: "Especificação / material",
  editorial: "Redação / editorial",
  tecnico: "Técnico (geral)",
};

export function getDisciplineLabel(discipline: FindingDiscipline) {
  return DISCIPLINE_LABELS[discipline];
}

export function getErrorTypeLabel(errorType: FindingErrorType) {
  return ERROR_TYPE_LABELS[errorType];
}

function findingHaystack(finding: AuditFinding) {
  return normalizeForMatch(
    [finding.tipo, finding.categoria ?? "", finding.capitulo, finding.local, finding.evidencia, finding.conflito].join(" "),
  );
}

// ordem = prioridade (mais específico primeiro); PPCI antes porque cita várias disciplinas
const DISCIPLINE_RULES: Array<{ key: FindingDiscipline; pattern: RegExp }> = [
  { key: "ppci", pattern: /\b(?:ppci|incendio|cbmsc|smsci|preventivo|hidrante|extintor|brigada|trrf|iluminacao de emergencia|saidas de emergencia)/ },
  { key: "hidrossanitario", pattern: /\b(?:hidrossanit|hidraulic|esgoto|agua fria|agua quente|reservatori|sanitari|bacia|louca|efluente|pluvial)/ },
  { key: "eletrico", pattern: /\b(?:eletric|qgp|quadro geral|quadro de distribui|luminotecnic|spda|aterramento|baixa tensao|subestacao|concessionaria)/ },
  { key: "cabeamento", pattern: /\b(?:cabeamento|cftv|logica|telecom|rack)/ },
  { key: "estrutural", pattern: /\b(?:estrutural|concreto armado|fundac|pilar|viga|laje|estrutura de madeira|nbr 7480|nbr 14931)/ },
  { key: "paisagismo", pattern: /\b(?:paisagism|especie|botanic|arvore|arbust|vegeta|jardim|maranta|ipe)/ },
  { key: "acessibilidade", pattern: /\b(?:acessib|pcd|rota acess|piso tatil|piso podotatil|rampa|nbr 9050|vaga acess|vaga especial)/ },
  { key: "terraplenagem", pattern: /\b(?:terraplenagem|pavimenta|urbaniza|drenagem|rodovia|aterro|meio-fio|estacionamento|paver|brita)/ },
  { key: "arquitetura", pattern: /\b(?:arquitetonic|bancada|granito|esquadria|telha|cobertura|revestimento|pintura|forro|porta de vidro|grade)/ },
];

/**
 * A disciplina que um texto qualquer denuncia, ou `null` se nenhum vocabulário
 * casar. Separada de `classifyFindingDiscipline` porque o cabeçalho da página
 * usa o MESMO vocabulário sobre outro texto — e duas listas de palavras de
 * disciplina no repositório acabariam discordando.
 */
export function disciplinaDoTexto(texto: string): FindingDiscipline | null {
  const alvo = normalizeForMatch(texto);

  for (const rule of DISCIPLINE_RULES) {
    if (rule.pattern.test(alvo)) {
      return rule.key;
    }
  }

  return null;
}

/**
 * De que disciplina é o achado.
 *
 * A DECLARADA VENCE. Ela vem do cabeçalho da página onde o trecho está — fato
 * objetivo, lido por regra no servidor (`lib/disciplina-da-pagina.ts`). A
 * inferência abaixo é o que sobra quando a página não tem cabeçalho: ela varre
 * a prosa do achado, inclusive a `evidencia`, que são as palavras do memorial e
 * não a natureza do defeito — um achado do capítulo de elétrica cuja frase
 * citada mencione granito era classificado como arquitetura.
 *
 * Mesma ordem de `impacto`: o que foi apurado tem precedência sobre o que foi
 * adivinhado.
 */
export function classifyFindingDiscipline(finding: AuditFinding): FindingDiscipline {
  if (finding.disciplina) {
    return finding.disciplina;
  }

  return disciplinaDoTexto(findingHaystack(finding)) ?? "geral";
}

/*
 * A ORDEM É PRIORIDADE, e `editorial` subiu para logo depois de `identidade`.
 *
 * Ele era o último, e por isso quase nunca ganhava: um achado de grafia cujo
 * tipo é "Grafia de área construída" casava antes em `quantitativo` (`area`), e
 * um sobre a redação de uma citação de norma casava em `norma`. O achado ia
 * para o balde errado e sumia do filtro "Redação / editorial" — justamente o
 * filtro que existe para separar revisão de texto de divergência técnica.
 *
 * `identidade` fica na frente porque grafia do NOME DA OBRA não é revisão de
 * texto: é o documento falando de outro empreendimento.
 */
const ERROR_TYPE_RULES: Array<{ key: FindingErrorType; pattern: RegExp }> = [
  { key: "identidade", pattern: /\b(?:identidade|nome de obra|nome da obra|obra\/unidade|ocupacao divergente|reaproveit|gabarito|outra obra)/ },
  { key: "editorial", pattern: /\b(?:redac|grafia|ortograf|formata|editorial|acentua|concordanc|pontuac|digitac|portugues|palavra trocada|paragrafo duplicad)/ },
  { key: "norma", pattern: /\b(?:norma|nbr|abnt|nr ?18|iso \d|vigencia|desatualiz|instituiu)/ },
  { key: "escopo", pattern: /\b(?:escopo|responsabilidad|hierarquia|prevalenc|contratual|precedencia)/ },
  { key: "quantitativo", pattern: /\b(?:area|unidade|quantitativ|populacao|vaga|dimens)/ },
  { key: "especificacao", pattern: /\b(?:material|especifica|bancada|grade|granito|inox|bacia|caixa acoplada|valvula)/ },
];

/**
 * De que NATUREZA é o defeito — o que alimenta os chips de filtro do parecer.
 *
 * LIA O TEXTO ERRADO. A busca varria o `findingHaystack`, que inclui a
 * `evidencia` e o `capitulo` — e esses dois não são o auditor descrevendo o
 * defeito, são as PALAVRAS DO MEMORIAL. Um erro de grafia cuja frase citada
 * mencionasse "área", "norma" ou "bancada" virava quantitativo, norma ou
 * especificação; o filtro de revisão de texto ficava vazio numa auditoria cheia
 * de erros de texto.
 *
 * É a mesma distinção que `classifyFindingImpact` já fazia logo acima, entre o
 * ESCOPO do achado e a prosa em volta. Aqui ela chega em duas passadas:
 *
 *  1. o rótulo que o próprio auditor deu ao defeito (`tipo` + `categoria`);
 *  2. só então a descrição do conflito e a correção proposta — que ainda falam
 *     do defeito, ao contrário da citação.
 *
 * A `evidencia` não entra em nenhuma das duas.
 */
export function classifyFindingErrorType(finding: AuditFinding): FindingErrorType {
  const escopo = normalizeForMatch([finding.tipo, finding.categoria ?? ""].join(" "));

  for (const rule of ERROR_TYPE_RULES) {
    if (rule.pattern.test(escopo)) {
      return rule.key;
    }
  }

  const descricao = normalizeForMatch(
    [finding.descricao, finding.conflito, finding.sugestao_correcao].join(" "),
  );

  for (const rule of ERROR_TYPE_RULES) {
    if (rule.pattern.test(descricao)) {
      return rule.key;
    }
  }

  return "tecnico";
}

export function getImpactRank(impact: FindingImpact) {
  switch (impact) {
    case "critico_documental":
      return 0;
    case "tecnico_contratual":
      return 1;
    case "revisao_editorial":
      return 2;
    default:
      return 3;
  }
}

export function getImpactLabel(impact: FindingImpact) {
  switch (impact) {
    case "critico_documental":
      return "Critico documental";
    case "tecnico_contratual":
      return "Tecnico/contratual";
    case "revisao_editorial":
      return "Revisao editorial";
    default:
      return "Outro";
  }
}

export function withFindingImpact(finding: AuditFinding): AuditFinding {
  // Sempre reclassifica: `classifyFindingImpact` já respeita a faixa declarada
  // pelo modelo, e é ele quem aplica as sobreposições determinísticas que TÊM de
  // vencer essa declaração (marcador de template). Manter o `??` aqui fazia a
  // sobreposição existir na função e nunca chegar ao agrupamento.
  return {
    ...finding,
    impacto: classifyFindingImpact(finding),
  };
}

export function sortAuditFindings(findings: AuditFinding[]) {
  return findings.map(withFindingImpact).sort((a, b) => {
    const impactDiff =
      getImpactRank(a.impacto ?? classifyFindingImpact(a)) -
      getImpactRank(b.impacto ?? classifyFindingImpact(b));

    if (impactDiff !== 0) {
      return impactDiff;
    }

    const priorityDiff = getPriorityRank(a.prioridade) - getPriorityRank(b.prioridade);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const pageA = Number.parseInt(a.pagina, 10);
    const pageB = Number.parseInt(b.pagina, 10);

    if (Number.isFinite(pageA) && Number.isFinite(pageB) && pageA !== pageB) {
      return pageA - pageB;
    }

    return a.tipo.localeCompare(b.tipo, "pt-BR");
  });
}

export function groupFindingsByImpact(findings: AuditFinding[]) {
  const sorted = sortAuditFindings(findings);

  return {
    critico_documental: sorted.filter((finding) => finding.impacto === "critico_documental"),
    tecnico_contratual: sorted.filter((finding) => finding.impacto === "tecnico_contratual"),
    revisao_editorial: sorted.filter((finding) => finding.impacto === "revisao_editorial"),
  };
}

export function buildExecutiveSummary(findings: AuditFinding[]) {
  const groups = groupFindingsByImpact(findings);
  const critical = groups.critico_documental;
  const technical = groups.tecnico_contratual;
  const editorial = groups.revisao_editorial;

  if (findings.length === 0) {
    return "Não foram detectados achados críticos dentro da auditoria executada.";
  }

  const parts: string[] = [];

  if (critical.length > 0) {
    parts.push(
      `Documento com ${plural(critical.length, "incongruência crítica", "incongruências críticas")} de identidade/localização da obra, com risco de reaproveitamento de texto ou emissão com dados divergentes.`,
    );
  }

  if (technical.length > 0) {
    parts.push(
      `${technical.length} ponto(s) técnico(s)/contratual(is) exigem conferência antes da emissão.`,
    );
  }

  if (editorial.length > 0) {
    parts.push(
      `${editorial.length} ponto(s) editorial(is) devem ser revisados sem o mesmo peso dos erros documentais.`,
    );
  }

  return parts.join(" ");
}

// Item 12 — bandeira de emissão binária no topo do relatório. Determinística:
// existe achado crítico documental -> não emitir; só técnico/contratual -> revisar;
// nada disso -> liberado. É o "semáforo" que o cliente lê em 1 segundo.
export type EmissionVerdict = {
  emoji: string;
  label: string;
  detail: string;
};

export function getEmissionVerdict(
  findings: AuditFinding[],
  /**
   * Passadas da análise que não completaram (timeout, aborto, erro de provider).
   * Quando há alguma, o veredito NÃO pode ser usado para liberar: ele estaria
   * afirmando sobre uma leitura que não aconteceu. Medido no 017-26 — a leitura
   * global abortou aos 300s e o resultado chegou na tela indistinguível de uma
   * auditoria completa.
   */
  passadasIncompletas: readonly { passada: string }[] = [],
): EmissionVerdict {
  const groups = groupFindingsByImpact(findings);

  if (passadasIncompletas.length > 0) {
    const quais = passadasIncompletas.map((p) => p.passada).join("; ");
    return {
      emoji: "⚠️",
      label: "ANÁLISE PARCIAL — NÃO USE PARA EMITIR",
      detail: `Uma etapa da análise não completou (${quais}). Os achados abaixo valem, mas a ausência de outros não significa que não existam. Rode de novo antes de decidir.`,
    };
  }

  if (groups.critico_documental.length > 0) {
    return {
      emoji: "🔴",
      label: "NÃO EMITIR",
      detail: `${plural(groups.critico_documental.length, "incongruência crítica", "incongruências críticas")} de identidade/documento antes da emissão.`,
    };
  }

  if (groups.tecnico_contratual.length > 0) {
    return {
      emoji: "🟡",
      label: "REVISAR ANTES DE EMITIR",
      detail: `${groups.tecnico_contratual.length} ponto(s) técnico(s)/contratual(is) exigem conferência.`,
    };
  }

  if (groups.revisao_editorial.length > 0) {
    return {
      emoji: "🟢",
      label: "LIBERADO COM RESSALVAS EDITORIAIS",
      detail: `${groups.revisao_editorial.length} ajuste(s) editorial(is), sem impacto documental.`,
    };
  }

  return {
    emoji: "🟢",
    label: "LIBERADO",
    detail: "Nenhum achado documental, técnico ou editorial detectado.",
  };
}

// Item 4 — selo de confiança por achado. Achado de regra é verificável (página +
// evidência conferidas deterministicamente, sem alucinação); achado de IA é uma
// sugestão que passou pela trava anti-alucinação, mas ainda pede conferência.
export function getFindingAssurance(finding: AuditFinding) {
  if (finding.origem === "regra") {
    return "✔ Verificado (regra determinística — página e evidência conferidas)";
  }

  return "◻ Sugerido pela IA (confira a evidência antes de agir)";
}

function formatFindingLine(finding: AuditFinding) {
  return `- ${finding.id}: ${finding.tipo} | Página ${finding.pagina || "não identificada"} | ${finding.conflito || finding.descricao}`;
}

export function makeTextReport(report: AuditReport) {
  const sortedFindings = sortAuditFindings(report.incongruencias);
  // Item 4 — duas camadas: achados sólidos (principal) mandam no veredito e nas
  // seções principais; sugestões da IA (rebaixadas) ficam numa seção à parte e
  // NÃO acendem o semáforo sozinhas.
  const principalFindings = sortedFindings.filter(
    (finding) => classifyFindingTier(finding) === "principal",
  );
  const suggestionFindings = sortedFindings.filter(
    (finding) => classifyFindingTier(finding) === "sugestao",
  );
  const grouped = groupFindingsByImpact(principalFindings);
  const executiveSummary = buildExecutiveSummary(principalFindings);
  const verdict = getEmissionVerdict(principalFindings, report.runtime?.passadas_incompletas ?? []);
  const deterministicFindings = principalFindings.filter((finding) => finding.origem === "regra");
  const findings =
    principalFindings.length === 0
      ? "- nenhum achado sólido detectado"
      : principalFindings
          .map((finding) => {
            return [
              `Achado ${finding.id}: ${finding.tipo}`,
              `Prioridade: ${finding.prioridade}`,
              `Verificação: ${getFindingAssurance(finding)}`,
              `Documento: ${finding.arquivo ?? report.arquivo ?? report.arquivos_analisados[0]?.arquivo ?? "não informado"}`,
              `Página provável: ${finding.pagina || "não identificada"}`,
              `Capítulo: ${finding.capitulo || "não identificado"}`,
              `Local: ${finding.local || "não informado"}`,
              `Evidência: ${finding.evidencia || finding.descricao}`,
              `Termo de busca: ${finding.termo_busca || finding.evidencia || finding.descricao}`,
              finding.categoria ? `Categoria: ${finding.categoria}` : "",
              finding.referencia_comparada ? `Referência comparada: ${finding.referencia_comparada}` : "",
              `Conflito: ${finding.conflito || "não informado"}`,
              `Ação recomendada: ${finding.sugestao_correcao || "revisar o trecho indicado"}`,
              `Impacto: ${getImpactLabel(finding.impacto ?? classifyFindingImpact(finding))}`,
              `Confiança: ${finding.confianca}`,
            ].filter(Boolean).join("\n");
          })
          .join("\n\n");

  return `
0. Veredito de emissão
${verdict.emoji} ${verdict.label} — ${verdict.detail}

1. Projeto analisado
Arquivo: ${report.arquivo ?? "não informado"}
Obra: ${report.obra || "não identificada"}
Projeto: ${report.codigo || "não identificado"}
Documento: ${report.tipo_documento || "não identificado"}
Volume: ${report.volume || "não identificado"}
Data: ${report.data_documento || "não identificada"}
Órgão: ${report.orgao || "não identificado"}
Modelo: ${report.runtime?.modelo_principal || "não informado"}
Validação: ${report.runtime?.modelo_validacao || report.runtime?.modelo_principal || "não informado"}
Nível: ${report.runtime?.nivel_analise === "deep" ? "Profundo" : "Padrão"}

2. Status geral
${report.status_geral}

2.1 Síntese executiva
${executiveSummary}

2.2 Principais riscos
${grouped.critico_documental.length > 0 ? grouped.critico_documental.map(formatFindingLine).join("\n") : "- nenhum risco crítico documental identificado"}

3. Arquivos analisados
${report.arquivos_analisados
  .map((item) => {
    return `- ${item.arquivo} | ${item.tipo_documento} | ${item.paginas ?? "-"} páginas | ${item.caracteres_extraidos ?? "-"} caracteres`;
  })
  .join("\n")}

4. Análise por arquivo
${report.arquivos_analisados
  .map((item) => {
    return `Arquivo: ${item.arquivo}\nResumo: ${item.resumo}`;
  })
  .join("\n\n")}

5. Comparações entre arquivos
${report.comparacoes.length > 0 ? report.comparacoes.map((item) => `- ${item}`).join("\n") : "- sem comparação específica"}

5.1 O que só o Nexodoc encontra (achados verificados, sem IA)
${
  deterministicFindings.length > 0
    ? `${deterministicFindings.length} achado(s) obtidos por regras determinísticas — identidade reaproveitada, confronto entre documentos e contradições entre capítulos distantes, cada um com página e evidência conferidas (o tipo de erro que um chat de IA genérico não localiza de forma confiável):\n${deterministicFindings
        .map(formatFindingLine)
        .join("\n")}`
    : "- nenhum achado determinístico neste conjunto (a leitura por IA cobre o restante)"
}

6. Achados críticos documentais
${grouped.critico_documental.length > 0 ? grouped.critico_documental.map(formatFindingLine).join("\n") : "- nenhum achado crítico documental"}

6.1 Pontos técnicos/contratuais
${grouped.tecnico_contratual.length > 0 ? grouped.tecnico_contratual.map(formatFindingLine).join("\n") : "- nenhum ponto técnico/contratual detectado"}

6.2 Revisões editoriais
${grouped.revisao_editorial.length > 0 ? grouped.revisao_editorial.map(formatFindingLine).join("\n") : "- nenhuma revisão editorial detectada"}

6.3 Lista completa com evidências
${findings}

6.4 Sugestões da IA — confira (menor confiança, não contam para o veredito)
${
  suggestionFindings.length > 0
    ? suggestionFindings.map(formatFindingLine).join("\n")
    : "- nenhuma sugestão adicional"
}

7. Conclusão objetiva
${report.conclusao}
`.trim();
}
