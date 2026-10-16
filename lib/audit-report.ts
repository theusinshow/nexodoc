import { countByState, readEngineReport, type EngineFindingV1, type EngineReportV1 } from "./audit-engine/report-contract.ts";
import type { AiProvider } from "@/lib/ai-providers";
import type { AuditMode } from "@/lib/audit-mode";
import type { AnalysisLevel } from "@/lib/analysis-level";
import type { TextoCorrigido } from "./texto-corrigido.ts";
/*
 * CAMINHO RELATIVO, e não o alias: este módulo é executado por scripts em node
 * cru (`npm run test:severidade`, `test:audit`), onde `@/` não existe. Os
 * outros imports daqui são `import type` — apagados em tempo de execução, e por
 * isso nunca cobraram o alias. Este é valor, e cobrou: quebrou as duas provas
 * na primeira tentativa.
 */
import { ehLeituraDoDocumentoPelaIa, incompletudeDoParecer } from "./auditoria-incompleta.ts";
import { plural } from "./plural.ts";
import { classifyFindingTier, type FindingTier } from "./camada-do-achado.ts";
import { rotuloDoAchado, textoComRotulos } from "./rotulo-do-achado.ts";

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
  /**
   * As OUTRAS disciplinas que o achado envolve, lidas do cabeçalho das demais
   * páginas que ele cita (`lib/disciplina-da-pagina.ts`). Um conflito entre o
   * capítulo de arquitetura e o de hidrossanitário é dos dois — e com uma
   * disciplina só, quem filtrava hidrossanitário não o via. Nunca repete a
   * `disciplina`. Ausente em parecer antigo; aí a prosa responde.
   */
  disciplinas_envolvidas?: FindingDiscipline[];
  referencia_comparada?: string;
  conflito: string;
  sugestao_correcao: string;
  confianca: FindingConfidence;
  /**
   * De onde o achado veio.
   *
   * `"chat"` nasceu na conversa pós-parecer, com o engenheiro perguntando — e
   * passa pelos MESMOS ramos que `"ia"` em severidade, verificação e reuso,
   * porque é nascido de IA e merece a mesma trava anti-alucinação. Os seis
   * consumidores deste campo testam `=== "regra"`, e nenhum precisou mudar.
   *
   * A distinção existe para a TELA: o engenheiro precisa saber que aquele
   * achado veio da conversa, e não da varredura.
   */
  origem?: "regra" | "ia" | "chat";
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
  /**
   * O texto corrigido que a IA gerou quando alguém clicou em "texto corrigido"
   * (`lib/texto-corrigido.ts`). Gravado para o segundo clique — e o colega que
   * abrir o mesmo achado — não pagarem de novo. Guarda também o "sem troca",
   * pelo mesmo motivo. Ausente = ninguém pediu ainda.
   */
  texto_corrigido?: TextoCorrigido;
  /**
   * Contrato do motor novo (`lib/audit-engine/report-contract.ts`), versionado e
   * OPCIONAL: estado real da investigação, premissas, fontes por lado, limites.
   * Ausente em parecer antigo — e aí o estado é desconhecido, não "confirmado".
   */
  motor?: EngineFindingV1;
};

// A regra de camada mora em `camada-do-achado.ts` (a contagem é só de confirmados).
export type { FindingTier } from "./camada-do-achado.ts";
export { achadosConfirmados, classifyFindingTier } from "./camada-do-achado.ts";

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
  /**
   * Folhas com conteúdo na página e NENHUM caractere extraível — ver
   * [[pagina-muda.ts]].
   *
   * Existem porque o denominador acima é cego a elas. `caracteres_totais` sai
   * de `extracted.text.length`, ou seja, da própria extração: no
   * `114_19_VOLUME ÚNICO.pdf`, 25 das 31 páginas têm o texto desenhado em vez
   * de escrito, a extração devolveu 7.470 caracteres, e a cobertura declarou
   * **7.470 de 7.470 = 100%** para uma auditoria que leu um décimo do memorial.
   * O `resumoDoEsforco` saiu sem uma palavra de ressalva, porque não há como
   * perceber a falta de uma página que nunca apareceu na conta.
   */
  paginas_mudas?: number;
  /** Quantas dessas folhas foram recuperadas por visão antes da leitura. */
  paginas_transcritas?: number;
  /**
   * ONDE o texto não está na camada do PDF — por página, e não só a conta.
   *
   * O visor grifa procurando o trecho na camada de texto; numa folha muda
   * transcrita ou num quadro em imagem lido por visão o trecho NÃO está lá, e o
   * visor abria a página sem marca nenhuma, como se tivesse errado. Com a lista
   * ele diz o porquê (05/10/2026, 141-26).
   *
   *  - `paginas_por_visao`: folhas mudas relidas por visão (`origem: "visao"`).
   *  - `quadros_por_visao`: folhas com texto próprio cujo quadro em imagem foi
   *    relido (`textoDaImagem`).
   *  - `imagens_nao_lidas`: folhas com imagem grande que ninguém leu — figura,
   *    pictograma ou quadro sem legenda. Não tira a cobertura de completa: é
   *    aviso, não buraco (a trava de `audit-verify.ts` já impede afirmar
   *    ausência sobre elas).
   */
  paginas_por_visao?: number[];
  quadros_por_visao?: number[];
  imagens_nao_lidas?: number[];
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
    /**
     * Regras que a validação por IA quis remover e não pôde.
     *
     * Não muda o parecer — achado de regra continua protegido de ser apagado.
     * É fila de revisão da camada determinística: a validação lê o documento com
     * a página do achado na frente, e é a única coisa no sistema capaz de dizer
     * "esta regra errou". Em 18/08/2026 ela diagnosticou corretamente três
     * falsos positivos nossos, e os três vereditos eram descartados em silêncio.
     */
    regras_contestadas?: {
      achado: string;
      tipo: string;
      pagina: string;
      motivo: string;
      evidencia: string;
    }[];
    /**
     * Sugestões que a própria validação dispensou ("Nenhuma correção
     * necessária", "Tratar no INC-005") e que saíram do parecer. Ver
     * [[sugestao-sem-correcao.ts]]: guardadas para conferência, não contadas.
     */
    sugestoes_dispensadas?: {
      tipo: string;
      pagina: string;
      evidencia: string;
      sugestao_correcao: string;
    }[];
    /**
     * A comparação com a última auditoria do MESMO documento no projeto, de
     * qualquer conversa. Ver [[comparado-com-anterior.ts]]. Os achados atuais
     * vão por `id` (deste parecer); os corrigidos, por descrição, porque o id
     * deles é do parecer anterior.
     */
    comparado_com_anterior?: {
      audit_id: string;
      desde: string;
      corrigidos: { tipo: string; pagina: string; termo_busca: string }[];
      continuam: string[];
      novos: string[];
      /** Só quando o texto anterior estava guardado. */
      novos_em_texto_que_ja_existia?: string[];
      novos_em_texto_alterado?: string[];
      /**
       * Dos `corrigidos`, os que saíram com o trecho IGUAL no texto atual: não
       * foram corrigidos, a leitura não os apontou de novo.
       */
      saidos_com_trecho_igual?: { tipo: string; pagina: string; termo_busca: string }[];
    };
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
     * Quando cada etapa começou e terminou, em ms desde o pedido — a linha do
     * tempo do resumo completo. Ausente nos pareceres antes de 02/10/2026.
     */
    etapas?: { passada: string; inicio_ms: number; fim_ms?: number }[];
    /** O nome de quem pediu a auditoria. Ausente nos pareceres antes de 02/10/2026. */
    auditado_por?: string;
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
    /** Etapa da análise não completou: a contagem não é o total. */
    | "auditoria incompleta — não use para emitir"
    | "revisão obrigatória antes de emissão";
  total_incongruencias: number;
  arquivos_analisados: AuditFileSummary[];
  comparacoes: string[];
  incongruencias: AuditFinding[];
  conclusao: string;
  /** Resumo versionado do motor novo (cobertura rastreada e contagem por estado). Opcional. */
  motor?: EngineReportV1;
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

/**
 * AS DISCIPLINAS QUE UM ACHADO PODE TER.
 *
 * É uma lista MENOR que a do escritório (`server/nexo/disciplinas.ts`, 24
 * entradas), e isso é deliberado: ali estão as disciplinas que geram capa,
 * separatriz e LD; aqui estão as que aparecem na PROSA de um memorial com
 * vocabulário próprio o bastante para serem reconhecidas.
 *
 * `climatizacao` e `gases_medicinais` entraram em 21/08/2026, e não por
 * completismo. Medido nos dois memoriais de referência: dos 52 achados que
 * caíam em "geral", TRINTA vinham dos capítulos "13 PROJETO DE CLIMATIZAÇÃO",
 * "14 PROJETO DE GASES MEDICINAIS" e "RELATÓRIO DE CARGA TÉRMICA". Não era
 * palavra faltando no vocabulário — eram duas disciplinas inteiras que o
 * escritório conhece, tem grupo responsável e capítulo próprio no documento, e
 * que esta lista não sabia nomear. Um memorial de hospital é metade disso.
 *
 * O QUE SOBROU EM "GERAL" É GERAL DE VERDADE: identidade da obra, condições
 * gerais e preliminares, ARTs e caderno de encargos. Documento, não disciplina.
 *
 * As outras ausências (topografia, sondagem, maquete, levantamento) continuam
 * fora de propósito: nenhuma delas tem capítulo nos memoriais medidos, e
 * inventar regra para vocabulário que não se viu é como a lista erra.
 */
export type FindingDiscipline =
  | "arquitetura"
  | "estrutural"
  | "hidrossanitario"
  | "eletrico"
  | "ppci"
  | "cabeamento"
  | "climatizacao"
  | "gases_medicinais"
  | "terraplenagem"
  | "drenagem"
  | "pavimentacao"
  | "sinalizacao"
  | "urbanizacao"
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
  climatizacao: "Climatização",
  gases_medicinais: "Gases medicinais",
  terraplenagem: "Terraplenagem",
  drenagem: "Drenagem",
  pavimentacao: "Pavimentação",
  sinalizacao: "Sinalização viária",
  urbanizacao: "Urbanização",
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
  { key: "ppci", pattern: /\b(?:ppci|incendio|cbmsc|smsci|preventivo|hidrante|extintor|brigada|trrf|iluminacao de emergencia|saidas de emergencia|sinalizacao de emergencia|rota de fuga)/ },
  /*
   * GASES MEDICINAIS ANTES DE HIDROSSANITÁRIO, e não em ordem alfabética.
   *
   * A rede de gases é tubulação, e a prosa dela fala de tubo, ramal e pressão —
   * palavras que o hidrossanitário também usa. O vocabulário abaixo é o que
   * NENHUMA outra disciplina diz: "posto de utilização" e "vácuo clínico" são
   * de gases medicinais e de mais nada.
   *
   * `cilindro` FICOU DE FORA de propósito, embora seja a palavra mais óbvia:
   * corpo de prova cilíndrico é ensaio de concreto, e a regra roubaria achado
   * do estrutural. Uma palavra que casa demais é pior que uma que falta.
   */
  { key: "gases_medicinais", pattern: /\b(?:gases medicinais|gas medicinal|oxigenio medicinal|ar comprimido medicinal|vacuo clinico|vacuo medicinal|posto de utilizacao|nbr 12188|oxido nitroso)/ },
  /*
   * CLIMATIZAÇÃO tem vocabulário próprio e sem vizinho: nenhuma outra
   * disciplina do memorial fala de carga térmica, condensadora ou psicrometria.
   * `split` e `chiller` são nomes de equipamento e não aparecem em outro lugar.
   */
  { key: "climatizacao", pattern: /\b(?:climatiz|carga termica|ar condicionado|condicionamento de ar|condensadora|evaporadora|fancoil|fan coil|chiller|split|psicrometr|vrf|btu)/ },
  { key: "hidrossanitario", pattern: /\b(?:hidrossanit|hidraulic|saneamento|esgoto|agua fria|agua quente|reservatori|sanitari|bacia|louca|efluente|pluvial)/ },
  { key: "eletrico", pattern: /\b(?:eletric|qgp|quadro geral|quadro de distribui|luminotecnic|spda|aterramento|baixa tensao|subestacao|concessionaria)/ },
  { key: "cabeamento", pattern: /\b(?:cabeamento|cftv|logica|telecom|rack)/ },
  { key: "estrutural", pattern: /\b(?:estrutural|concreto armado|fundac|pilar|viga|laje|estrutura de madeira|nbr 7480|nbr 14931)/ },
  { key: "paisagismo", pattern: /\b(?:paisagism|especie|botanic|arvore|arbust|vegeta|jardim|maranta|ipe)/ },
  { key: "acessibilidade", pattern: /\b(?:acessib|pcd|rota acess|piso tatil|piso podotatil|rampa|nbr 9050|vaga acess|vaga especial)/ },
  /*
   * A INFRAESTRUTURA, SEPARADA (05/10/2026). Era um balde só, "Terraplenagem /
   * Urbanização", com chip TER: no 141-26 cinco capítulos (terraplenagem,
   * drenagem, pavimentação, sinalização, urbanização) caíam nele, e um achado do
   * capítulo de urbanização aparecia como terraplenagem. As cinco dividem a COR
   * (ds.css), para a paleta não virar arco-íris; o nome e a sigla separam.
   *
   * Sinalização vem DEPOIS de PPCI, que segura "sinalização de emergência".
   */
  { key: "sinalizacao", pattern: /\b(?:sinalizac|tacha refletiva|faixa de pedestre|sinalizacao horizontal|sinalizacao vertical)/ },
  { key: "drenagem", pattern: /\b(?:drenagem|boca de lobo|sarjeta|bueiro|caixa coletora|galeria de aguas pluviais)/ },
  { key: "urbanizacao", pattern: /\b(?:urbaniza|passeio publico|calcada|mobiliario urbano)/ },
  { key: "pavimentacao", pattern: /\b(?:pavimenta|paver|intertravad|asfalt|cbuq|imprimacao|meio-fio|sub-base)/ },
  { key: "terraplenagem", pattern: /\b(?:terraplenagem|movimento de terra|desenho geometrico|rodovia|aterro|estacionamento|brita)/ },
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
 * A disciplina de um TÍTULO DE CAPÍTULO — pela ordem das palavras, e não pela
 * ordem das regras.
 *
 * MESMO VOCABULÁRIO, outro desempate, e a diferença importa em uma linha:
 * `"3 - PROJETO ARQUITETÔNICO E URBANIZAÇÃO"`. `disciplinaDoTexto` responde
 * `terraplenagem`, porque a regra dela (que casa `urbaniza`) vem antes da de
 * arquitetura — e a ordem daquela lista é prioridade de ASSUNTO, montada para
 * prosa de achado ("PPCI antes porque cita várias disciplinas"). Num título,
 * quem manda é o substantivo da frente: o que vem depois do "E" é o secundário.
 *
 * O ESTRAGO MEDIDO (memorial do 113-22, 21/08/2026): esse cabeçalho está na
 * página 28, e as páginas 29 a 81 dizem `"3 - PROJETO ARQUITETÔNICO"`, limpo.
 * Como são o MESMO capítulo 3, a regra de continuidade não revisa o que já
 * sabe — e 54 das 113 páginas mapeadas do documento saíam como terraplenagem.
 * Metade do memorial de um hospital arquivada na disciplina errada, e mostrada
 * na tela como fato lido do documento.
 *
 * Só para cabeçalho. A prosa do achado continua em `disciplinaDoTexto`: lá a
 * palavra mais cedo não é a mais importante, é só a que veio primeiro na frase.
 */
export function disciplinaDoTitulo(titulo: string): FindingDiscipline | null {
  const alvo = normalizeForMatch(titulo);

  let melhor: FindingDiscipline | null = null;
  let maisCedo = Infinity;

  for (const rule of DISCIPLINE_RULES) {
    // As regras não têm a flag `g`, então `exec` não guarda estado entre
    // chamadas — sem isso, dois títulos seguidos dariam respostas diferentes.
    const casou = rule.pattern.exec(alvo);

    if (casou && casou.index < maisCedo) {
      maisCedo = casou.index;
      melhor = rule.key;
    }
  }

  return melhor;
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
 * OS NOMES DAS DISCIPLINAS, e não o vocabulário delas.
 *
 * `DISCIPLINE_RULES` casa palavra de ASSUNTO ("pintura", "esgoto", "split") —
 * serve para adivinhar a disciplina de um texto que não diz qual é. Para saber
 * se um achado ENVOLVE outra disciplina, isso casa demais: "aquecimento
 * elétrico" num achado de arquitetura não envolve o projeto elétrico. Aqui só
 * entra quando o achado NOMEIA a disciplina ("a arquitetura prevê…, enquanto o
 * hidrossanitário declara…") — que é como a IA escreve um conflito entre
 * capítulos. `estrutura` sozinha fica de fora: é palavra comum.
 */
const NOMES_DAS_DISCIPLINAS: Array<{ key: FindingDiscipline; pattern: RegExp }> = [
  { key: "arquitetura", pattern: /\b(?:arquitetura|arquitetonic)/ },
  { key: "estrutural", pattern: /\b(?:estrutural|projeto de estrutura|calculo estrutural)/ },
  // "Sistema hidráulico" é do PPCI (hidrantes); só o PROJETO hidráulico é desta.
  { key: "hidrossanitario", pattern: /\b(?:hidrossanit|projeto hidraulic|instalacoes hidraulicas|instalacoes sanitarias)/ },
  { key: "eletrico", pattern: /\b(?:projeto eletrico|instalacoes eletricas|instalacao eletrica|capitulo de eletrica|o eletrico|a eletrica)\b/ },
  { key: "ppci", pattern: /\b(?:ppci|preventivo de incendio|prevencao (?:e combate )?(?:a|contra) incendio|combate a incendio)/ },
  { key: "cabeamento", pattern: /\b(?:cabeamento|cftv)/ },
  { key: "climatizacao", pattern: /\b(?:climatiza)/ },
  { key: "gases_medicinais", pattern: /\b(?:gases medicinais)/ },
  { key: "terraplenagem", pattern: /\b(?:terraplenagem)/ },
  { key: "drenagem", pattern: /\b(?:drenagem)/ },
  { key: "pavimentacao", pattern: /\b(?:pavimentacao)\b/ },
  { key: "sinalizacao", pattern: /\b(?:sinalizacao viaria)/ },
  { key: "urbanizacao", pattern: /\b(?:urbanizacao)/ },
  { key: "paisagismo", pattern: /\b(?:paisagism)/ },
  { key: "acessibilidade", pattern: /\b(?:acessibilidade)/ },
];

/** As disciplinas que um texto NOMEIA, na ordem da lista. */
export function disciplinasNomeadas(texto: string): FindingDiscipline[] {
  const alvo = normalizeForMatch(texto);
  return NOMES_DAS_DISCIPLINAS.filter((n) => n.pattern.test(alvo)).map((n) => n.key);
}

/**
 * TODAS as disciplinas do achado: a principal primeiro, depois as envolvidas.
 *
 * Envolvida é o que o servidor leu nas outras páginas citadas
 * (`disciplinas_envolvidas`) mais o que o próprio achado nomeia no tipo, na
 * descrição, no conflito e na referência. A `evidencia` fica de fora pelo
 * mesmo motivo de sempre: são as palavras do memorial, não a natureza do
 * defeito. "Geral" nunca é envolvida — é ausência de disciplina.
 */
export function classifyFindingDisciplines(finding: AuditFinding): FindingDiscipline[] {
  const principal = classifyFindingDiscipline(finding);
  const prosa = disciplinasNomeadas(
    [finding.tipo, finding.descricao, finding.conflito, finding.referencia_comparada ?? ""].join(" "),
  );
  const envolvidas = [...new Set([...(finding.disciplinas_envolvidas ?? []), ...prosa])].filter(
    (d) => d !== "geral" && d !== principal,
  );
  // "Geral" é não saber: se alguma disciplina apareceu, ela assume a frente.
  if (principal === "geral" && envolvidas.length) return envolvidas;
  return [principal, ...envolvidas];
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
      return "Crítico documental";
    case "tecnico_contratual":
      return "Técnico/contratual";
    case "revisao_editorial":
      return "Revisão editorial";
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
    /*
     * A FRASE PRECISA DIZER O QUE OS CRÍTICOS SÃO.
     *
     * Ela era fixa em "de identidade/localização da obra", e a faixa crítica há
     * muito deixou de ser só isso: hierarquia documental contraditória, campo de
     * template não preenchido e erro de unidade também sobem para cá. No 129-24
     * a conclusão anunciou "4 incongruências críticas de identidade/localização
     * da obra" quando só UMA delas era de identidade — as outras três eram
     * prevalência documental e duas unidades erradas. Quem leu só a conclusão
     * leu um documento diferente do que o relatório continha.
     *
     * Agora o qualificador só aparece quando TODOS os críticos são de
     * identidade; se a faixa for mista, a frase nomeia os tipos que estão lá.
     */
    const ehIdentidade = (finding: AuditFinding) => {
      const scope = normalizeForMatch([finding.tipo, finding.categoria ?? "", finding.local ?? ""].join(" "));
      return (
        scope.includes("identidade") ||
        scope.includes("identificacao") ||
        scope.includes("nome da obra") ||
        scope.includes("municipio") ||
        scope.includes("endereco") ||
        scope.includes("localiza")
      );
    };

    const contagem = plural(critical.length, "incongruência crítica", "incongruências críticas");

    if (critical.every(ehIdentidade)) {
      parts.push(
        `Documento com ${contagem} de identidade/localização da obra, com risco de reaproveitamento de texto ou emissão com dados divergentes.`,
      );
    } else {
      const tipos = [...new Set(critical.map((finding) => finding.tipo))].slice(0, 4);
      parts.push(
        `Documento com ${contagem} que impedem a emissão: ${tipos.join("; ")}.`,
      );
    }
  }

  if (technical.length > 0) {
    parts.push(
      `${plural(technical.length, "ponto técnico/contratual exige", "pontos técnicos/contratuais exigem")} conferência antes da emissão.`,
    );
  }

  if (editorial.length > 0) {
    parts.push(
      `${plural(editorial.length, "ponto editorial deve ser revisado", "pontos editoriais devem ser revisados")} sem o mesmo peso dos erros documentais.`,
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

  /*
   * Sem a leitura da IA não é "análise parcial", é outra coisa: o parecer tem
   * só os achados de regra. Em 14/09/2026 o 117_25 saiu assim com 10 achados,
   * contra 56 da corrida completa, e o rótulo âmbar não impediu que a contagem
   * fosse lida como o total. Vermelho, e dizendo o que faltou.
   */
  if (passadasIncompletas.some((p) => ehLeituraDoDocumentoPelaIa(p.passada))) {
    return {
      emoji: "🔴",
      label: "AUDITORIA INCOMPLETA — A IA NÃO LEU O DOCUMENTO. NÃO USE PARA EMITIR",
      detail:
        "Só as regras automáticas rodaram: os achados abaixo não são o total de problemas do documento. Rode a auditoria de novo.",
    };
  }

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
      detail: `${plural(groups.tecnico_contratual.length, "ponto técnico/contratual exige", "pontos técnicos/contratuais exigem")} conferência.`,
    };
  }

  if (groups.revisao_editorial.length > 0) {
    return {
      emoji: "🟢",
      label: "LIBERADO COM RESSALVAS EDITORIAIS",
      detail: `${plural(groups.revisao_editorial.length, "ajuste editorial", "ajustes editoriais")}, sem impacto documental.`,
    };
  }

  return {
    emoji: "🟢",
    label: "LIBERADO",
    detail: "Nenhum achado documental, técnico ou editorial detectado.",
  };
}

export type AvaliacaoDeEmissao = {
  estado: "incompleto" | "nao_emitir" | "revisar" | "liberado_com_ressalvas" | "liberado";
  veredito: EmissionVerdict;
  /** Aviso que vem ANTES do veredito e das contagens. `null` quando a análise está íntegra. */
  aviso: { titulo: string; explicacao: string } | null;
  /** O escopo efetivamente analisado — "liberado" nunca é conformidade integral. */
  escopo: string;
  pendencias: string[];
};

/**
 * A REGRA ÚNICA de aptidão para emissão. Tela, texto exportado, cartão do Nexo
 * e grafo passam por aqui; nenhum recalcula com uma lista diferente de achados.
 *
 * - O semáforo olha só achados PRINCIPAIS (sugestão não acende sozinha).
 * - Incompletude vem de `incompletudeDoParecer` (passadas, status parcial/falha,
 *   folhas mudas) E do resumo do motor quando existe (cobertura, falhas,
 *   persistência inválida, desenho prometido e não avaliado).
 * - Zero achados + análise interrompida nunca vira liberação.
 * - Questão crítica em aberto (motor inconclusivo de prioridade Alta) impede
 *   "liberado".
 */
export function avaliarEmissao(report: AuditReport, opcoes: { promessaVisual?: boolean } = {}): AvaliacaoDeEmissao {
  const principais = report.incongruencias.filter((f) => classifyFindingTier(f) === "principal");
  const passadas = report.runtime?.passadas_incompletas ?? [];
  const base = getEmissionVerdict(principais, passadas);
  const inc = incompletudeDoParecer(report);
  const motor = readEngineReport(report);
  const impeditivas: string[] = [];
  const ressalvas: string[] = [];

  if (inc.incompleta) impeditivas.push(inc.titulo || "análise incompleta");
  if (motor.kind === "invalid") impeditivas.push(`resumo do motor ilegível (${motor.errors.join(", ")}): integridade da persistência não confirmada`);
  let visualPendente = 0;
  if (motor.kind === "engine") {
    // Coerência: o resumo tem de bater com os achados publicados; achado do motor
    // corrompido não pode sumir da conta nem ser lido como legado.
    const porEstado = countByState(report.incongruencias);
    if (porEstado.invalid > 0) impeditivas.push(`${plural(porEstado.invalid, "achado do motor ilegível", "achados do motor ilegíveis")}: integridade não confirmada`);
    else if (porEstado.confirmed !== motor.value.counts.confirmed) {
      impeditivas.push(`contagem do motor (${plural(motor.value.counts.confirmed, "confirmado", "confirmados")}) não confere com os achados publicados (${porEstado.confirmed})`);
    }
    const cov = motor.value.coverage;
    if (cov.status !== "complete" && cov.status !== "complete_with_inherited" && cov.status !== "empty") {
      const pct = cov.completedRatio === null ? "—" : `${Math.round(cov.completedRatio * 100)}%`;
      impeditivas.push(`cobertura do motor ${cov.status}: ${pct} do texto concluído`);
    }
    if (motor.value.counts.operationalFailures > 0) impeditivas.push(`${plural(motor.value.counts.operationalFailures, "verificação não concluída", "verificações não concluídas")} por falha ou orçamento`);
    visualPendente = cov.revisions.reduce((n, r) => n + r.visualPending.length, 0);
    if (visualPendente && opcoes.promessaVisual) impeditivas.push(`${plural(visualPendente, "página de desenho prometida e não avaliada", "páginas de desenho prometidas e não avaliadas")}`);
  }
  const criticasAbertas = report.incongruencias.filter((f) => f.motor?.state === "inconclusive" && f.prioridade === "Alta").length;
  if (criticasAbertas) ressalvas.push(`${plural(criticasAbertas, "questão crítica", "questões críticas")} em aberto`);

  const arquivos = report.arquivos_analisados ?? [];
  const paginas = arquivos.reduce((n, a) => n + (a.paginas ?? 0), 0);
  const escopo = [
    `${plural(arquivos.length, "arquivo", "arquivos")}${paginas ? `, ${plural(paginas, "página", "páginas")}` : ""}`,
    motor.kind === "engine" ? `cobertura rastreada (${motor.value.coverage.status})` : "cobertura não rastreada (parecer anterior ao motor)",
    visualPendente && !opcoes.promessaVisual ? `desenhos não avaliados em ${plural(visualPendente, "página", "páginas")} — limite do modo textual` : "",
  ].filter(Boolean).join("; ");

  const ehIncompleto = base.label.includes("NÃO USE PARA EMITIR");
  if (impeditivas.length || ehIncompleto) {
    const veredito = ehIncompleto ? base : {
      emoji: "⚠️", label: "ANÁLISE PARCIAL — NÃO USE PARA EMITIR",
      detail: `Pendências: ${impeditivas.join("; ")}. Os achados valem, mas a ausência de outros não significa que não existam. Rode de novo ou conclua as etapas pendentes.`,
    };
    return {
      estado: "incompleto", veredito, escopo, pendencias: [...impeditivas, ...ressalvas],
      aviso: { titulo: inc.titulo || veredito.label, explicacao: inc.explicacao || veredito.detail },
    };
  }
  if (criticasAbertas && base.label.startsWith("LIBERADO")) {
    return {
      estado: "revisar", escopo, pendencias: ressalvas, aviso: null,
      veredito: { emoji: "🟡", label: "REVISAR ANTES DE EMITIR", detail: `${ressalvas.join("; ")}: resolva antes de liberar.` },
    };
  }
  const estado = base.label === "NÃO EMITIR" ? "nao_emitir" : base.label.startsWith("REVISAR") ? "revisar"
    : base.label === "LIBERADO" ? "liberado" : "liberado_com_ressalvas";
  const veredito = base.label.startsWith("LIBERADO")
    ? { ...base, detail: `${base.detail} Não foram identificadas inconsistências confirmadas no escopo analisado (${escopo}).` }
    : base;
  return { estado, veredito, escopo, pendencias: ressalvas, aviso: null };
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
  return `- ${rotuloDoAchado(finding.id)}: ${textoComRotulos(finding.tipo)} | Página ${finding.pagina || "não identificada"} | ${finding.conflito || finding.descricao}`;
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
  const avaliacao = avaliarEmissao(report);
  const verdict = avaliacao.veredito;
  const deterministicFindings = principalFindings.filter((finding) => finding.origem === "regra");
  const findings =
    principalFindings.length === 0
      ? "- nenhum achado sólido detectado"
      : principalFindings
          .map((finding) => {
            return [
              `Achado ${rotuloDoAchado(finding.id)}: ${textoComRotulos(finding.tipo)}`,
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

  const aviso = avaliacao.aviso;

  return `
${aviso ? `!!! ${aviso.titulo} !!!
${aviso.explicacao}

` : ""}0. Veredito de emissão
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
