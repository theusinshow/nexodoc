import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseAuditMode, type AuditMode } from "@/lib/audit-mode";
import { parseAnalysisLevel, type AnalysisLevel } from "@/lib/analysis-level";
import {
  formatAuditLearningsForPrompt,
  listAuditLearnings,
} from "@/lib/audit-learnings";
import type { EmitirMarco, MarcoDaAuditoria } from "@/lib/audit-progress";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import {
  makeTextReport,
  buildExecutiveSummary,
  classifyFindingImpact,
  normalizeConfidence,
  normalizePriority,
  parseFindingImpact,
  sortAuditFindings,
  type AuditFinding,
  type AuditReport,
} from "@/lib/audit-report";
import { disciplinaDoAchado, disciplinaPorPagina } from "@/lib/disciplina-da-pagina";
import { severidadeDoAchado } from "@/lib/severidade";
import { getAuditorPrompt } from "@/lib/auditor-prompt";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { Actor } from "@/lib/actor";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  assertProjectAccess,
  getUserActor,
  normalizeEmail,
  type ActorIdentity,
} from "@/lib/project-store";
import {
  getMockAuditResult,
  isMockModeEnabled,
  waitForMockAudit,
} from "@/lib/mock-audit";
import {
  classifyProviderFailure,
  createInvalidProviderResponseError,
  getAuditExecutionProfile,
  isInvalidProviderResponseError,
  recordProviderFailure,
  type AuditModelRole,
} from "@/lib/ai-providers";
import {
  executeAuditModelResponse,
  parseAuditModelJson,
  type ModelFinding,
} from "@/lib/audit-ai";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import {
  createPendingAudit,
  persistCompletedAudit,
  persistFailedAudit,
  type UploadedAuditFile,
} from "@/lib/audit-persistence";
import {
  agruparBlocosParaLeitura,
  chunkPdfByChapter,
  extractPdfText,
  type AuditTextChunk,
  type ExtractedPdf,
} from "@/lib/pdf-text";
import { compararImpressoes, impressaoDosCapitulos } from "@/lib/audit-fingerprint";
import { versaoDoAuditor } from "@/lib/versao-do-auditor";
import { avaliarBase, fraseDaRecusa } from "@/lib/elegibilidade-da-base";
import { planejarReuso } from "@/lib/audit-reuso";
import {
  isLocalityPhrase,
  runCrossDocumentRules,
  runWithinDocumentIdentityRules,
} from "@/lib/cross-document-audit";
import { runDocumentCoherenceRules } from "@/lib/audit-coherence";
import {
  auditValidationResponseFormat,
  buildDocumentContext,
  buildFindingCandidateList,
  buildValidationContext,
  getFindingValidationPrompt,
  buildDocumentContextComReuso,
  getGlobalContextChars,
} from "@/lib/audit-validation-prompt";
import { filterGroundedFindings } from "@/lib/audit-verify";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
// Piso, não sugestão: ver `getMaxOutputTokens`. Era 1800 e truncava.
const DEFAULT_CHUNK_MAX_OUTPUT_TOKENS = 6000;
/** Limite de segurança do teto por bloco. Acima disto o bloco é grande demais. */
const MAX_CHUNK_OUTPUT_TOKENS = 16000;
/*
 * O TAMANHO DE UM BLOCO DE LEITURA, em caracteres.
 *
 * 28.000 (o teto do `chunkPdfByChapter`) foi testado em produção no 084_25 e
 * REPROVOU: 20 de 25 blocos truncaram. Os que couberam eram de 3 páginas. Este
 * número não é uma preferência — é o maior tamanho para o qual existe evidência
 * de que a resposta fecha. Mexer nele exige repetir a medição, não intuição.
 */
const CHUNK_GROUP_CHARS = 10000;
const DEFAULT_REASONING_EFFORT = "high";
const MIN_TEXT_CHARS_FOR_DEEP_AUDIT = 300;
const DEFAULT_MAX_CHUNKS_PER_FILE = 8;
const DEFAULT_CHUNK_CONCURRENCY = 3;
const DEFAULT_CHUNK_TIMEOUT_MS = 120_000;

type AuditEngine = "single" | "dual";

// Item 1 — gabarito declarado na tela de entrada (ground truth). Todos opcionais:
// se o usuário pular, ficam vazios e o motor volta a inferir.
type AuditGabarito = {
  obra?: string;
  prefeitura?: string;
  municipio?: string;
  centroCusto?: string;
  endereco?: string;
};

const auditFindingModelSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prioridade: { type: "string" },
    pagina: { type: "string" },
    capitulo: { type: "string" },
    local: { type: "string" },
    tipo: { type: "string" },
    descricao: { type: "string" },
    evidencia: { type: "string" },
    termo_busca: { type: "string" },
    arquivo: { type: "string" },
    categoria: { type: "string" },
    referencia_comparada: { type: "string" },
    conflito: { type: "string" },
    sugestao_correcao: { type: "string" },
    confianca: { type: "string" },
    // Faixa de consequência declarada pelo próprio modelo. Antes era só inferida
    // por palavra-chave em audit-report.ts, o que jogava "completude documental"
    // (os campos XXXX) em revisao_editorial e sumia com ele do topo do relatório.
    // A inferência continua existindo como fallback quando vier vazio/inválido.
    impacto: { type: "string" },
  },
  required: [
    "prioridade",
    "pagina",
    "capitulo",
    "local",
    "tipo",
    "descricao",
    "evidencia",
    "termo_busca",
    "arquivo",
    "categoria",
    "referencia_comparada",
    "conflito",
    "sugestao_correcao",
    "confianca",
    "impacto",
  ],
};

const auditFindingsResponseFormat = {
  type: "json_schema" as const,
  name: "audit_findings",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      findings: {
        type: "array",
        items: auditFindingModelSchema,
      },
    },
    required: ["findings"],
  },
};

/**
 * SÓ DA LEITURA GLOBAL — e é por isso que existe um formato separado.
 *
 * O `auditFindingsResponseFormat` acima é compartilhado por quatro passadas
 * (blocos, identidade, global e coerência). No modo `strict` da OpenAI todo
 * campo declarado é obrigatório: acrescentar a síntese lá dentro obrigaria a
 * passada de BLOCO, que vê um pedaço do documento, e a de IDENTIDADE, que vê
 * uma amostra, a resumir capítulos que elas não leram.
 *
 * A síntese só faz sentido em quem recebe o documento inteiro.
 */
const auditGlobalResponseFormat = {
  type: "json_schema" as const,
  name: "audit_global",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      findings: {
        type: "array",
        items: auditFindingModelSchema,
      },
      sintese: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            capitulo: { type: "string" },
            resumo: { type: "string" },
          },
          required: ["capitulo", "resumo"],
        },
      },
    },
    required: ["findings", "sintese"],
  },
};

const auditCrossDocumentResponseFormat = {
  type: "json_schema" as const,
  name: "audit_cross_document",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      comparisons: {
        type: "array",
        items: { type: "string" },
      },
      findings: {
        type: "array",
        items: auditFindingModelSchema,
      },
    },
    required: ["comparisons", "findings"],
  },
};

const auditRefutationResponseFormat = {
  type: "json_schema" as const,
  name: "audit_refutation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source_id: { type: "string" },
            sustentado: { type: "boolean" },
            motivo: { type: "string" },
          },
          required: ["source_id", "sustentado", "motivo"],
        },
      },
    },
    required: ["verdicts"],
  },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class AuditInputError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "AuditInputError";
    this.status = status;
  }
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function jsonError(message: string, status = 400) {
  return withCors(NextResponse.json({ error: message }, { status }));
}

function getLowTextPdfMessage(fileName: string, fileType: string) {
  const type = fileType.toLowerCase();
  const baseMessage = `O arquivo "${fileName}" não possui texto pesquisável suficiente para auditoria documental.`;

  if (type === "pranchas") {
    return `${baseMessage} Para pranchas, envie um PDF com texto/OCR pesquisável ou use o módulo de LD para leitura visual dos selos.`;
  }

  return `${baseMessage} Envie uma versão com OCR ou texto selecionável para que o auditor consiga verificar evidências.`;
}

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.NEXODOC_ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin) {
    return allowedOrigins?.[0] ?? "*";
  }

  if (!allowedOrigins || allowedOrigins.length === 0) {
    return origin;
  }

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function withCors(response: NextResponse, request?: Request) {
  const allowedOrigin = request ? getAllowedOrigin(request) : "*";

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Vary", "Origin");

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

function getReasoningEffort(analysisLevel: AnalysisLevel, auditMode: AuditMode) {
  const effort =
    analysisLevel === "deep"
      ? process.env.OPENAI_DEEP_REASONING_EFFORT ?? process.env.OPENAI_REASONING_EFFORT
      : process.env.OPENAI_STANDARD_REASONING_EFFORT;

  if (auditMode === "memorial" && analysisLevel === "deep") {
    if (effort === "minimal") {
      return "none";
    }

    if (
      effort === "none" ||
      effort === "low" ||
      effort === "medium" ||
      effort === "high" ||
      effort === "xhigh"
    ) {
      return effort;
    }

    /*
     * Memorial no Profundo: `medium`, não `high`.
     *
     * Medido no 063_26_md_geral_a.pdf (73 páginas, 173k chars) em 12/08/2026,
     * com o prompt de "pecar pelo excesso":
     *   high   -> abortou em 480s; abortou de novo em 900s; 0 achado de IA.
     *   medium -> 258s, 35 achados de IA, out=13.893 de 16.000.
     *
     * Não é economia: o `high` simplesmente não converge quando a passada lê o
     * documento inteiro e o pedido é exaustivo. Subir o teto de tempo já falhou
     * duas vezes; quem quiser `high` precisa antes dividir a leitura global em
     * duas passadas por faixa de impacto, não dar mais minutos.
     *
     * `OPENAI_DEEP_REASONING_EFFORT=high` continua funcionando para quem quiser
     * tentar — em documento pequeno o `high` termina normalmente.
     */
    return "medium";
  }

  if (
    effort === "none" ||
    effort === "minimal" ||
    effort === "low" ||
    effort === "medium" ||
    effort === "high" ||
    effort === "xhigh"
  ) {
    return effort;
  }

  return analysisLevel === "deep" ? DEFAULT_REASONING_EFFORT : "medium";
}

function getPrimaryExecutionProfile(
  auditMode: AuditMode,
  analysisLevel: AnalysisLevel,
  role?: AuditModelRole,
) {
  return getAuditExecutionProfile({ auditMode, analysisLevel, role });
}

function getPrimaryModelName(
  auditMode: AuditMode,
  analysisLevel: AnalysisLevel,
  role?: AuditModelRole,
) {
  return getPrimaryExecutionProfile(auditMode, analysisLevel, role).model;
}

function getValidationExecutionProfile(auditMode: AuditMode, analysisLevel: AnalysisLevel) {
  return getAuditExecutionProfile({ auditMode, analysisLevel, role: "validation" });
}

function getValidationModelName(auditMode: AuditMode, analysisLevel: AnalysisLevel) {
  return getValidationExecutionProfile(auditMode, analysisLevel).model;
}

function isRuleBasedAuditEnabled() {
  return process.env.NEXODOC_ENABLE_RULE_BASED_AUDIT === "true";
}

// A comparação determinística entre documentos é sempre ativa. Este flag apenas
// mantém disponível o motor legado de comparação por IA (mais caro e sujeito a
// alucinação) para benchmark; desligado por padrão.
function isAiCrossDocumentEnabled() {
  return process.env.NEXODOC_ENABLE_AI_CROSS_DOCUMENT === "true";
}

// Fase C — a identidade documental (obra, município, endereço, proprietário,
// órgão, código, revisão) é decidida por regras determinísticas da Camada 1
// (guardas capa×corpo + `runWithinDocumentIdentityRules`), que não alucinam e
// citam página/evidência. A passada de IA dedicada à identidade virou redundante
// e é a maior fonte de "aponta obra divergente que não existe"; fica atrás deste
// flag, desligada por padrão, disponível apenas para benchmark.
function isAiIdentityPassEnabled() {
  return process.env.NEXODOC_ENABLE_AI_IDENTITY_PASS === "true";
}

// Item 3 — passada de refutação adversarial. Depois que os achados de IA passam
// pela trava de ancoragem (Fase B), uma 2ª chamada tenta DERRUBAR cada um: "essa
// evidência realmente sustenta o conflito?". O que a IA não conseguir defender é
// descartado. Corta o falso positivo plausível-porém-errado. Só afeta achados de
// IA (regra nunca é refutada). Custa 1 chamada extra por arquivo; fica atrás de
// flag, desligado por padrão até validação com tokens reais.
function isRefutationPassEnabled() {
  return process.env.NEXODOC_ENABLE_REFUTATION_PASS === "true";
}

function parseAuditEngine(value: FormDataEntryValue | null): AuditEngine {
  return value === "dual" ? "dual" : "single";
}

function parseRequiredAuditModelJson(text: string, operation: string) {
  const parsed = parseAuditModelJson(text);

  if (!parsed) {
    const error = createInvalidProviderResponseError();
    error.message = `Resposta inválida do modelo na etapa ${operation}.`;
    throw error;
  }

  return parsed;
}

/*
 * Envelope quebrado = etapa descartável.
 *
 * Media só `code === "invalid_response"` — o código do JSON ilegível. Mas a
 * resposta TRUNCADA chega com `code=incomplete_max_output_tokens` (o tipo é que
 * vale "invalid_response"), e a recusa com `code=refusal`. Nenhuma das duas
 * casava, então a etapa relançava e a auditoria inteira morria por causa de um
 * bloco. Foi o que derrubou o 084_25_est_md.pdf duas vezes em 11/08/2026.
 */
function isInvalidAuditModelResponse(error: unknown) {
  return isInvalidProviderResponseError(error);
}

function getChunkPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  chunk: AuditTextChunk;
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Audite volume de projeto: coerência entre capa, separatriz, LDs/listas, pranchas, selos, revisões, títulos, disciplinas, volume e tomo."
      : "Audite memorial descritivo textual: coerência interna, normas suspeitas, cálculos simples, hierarquia e redação técnica.";

  return `
${modeInstruction}

Leia o trecho abaixo procurando erros que possam comprometer emissão, licitação, cliente ou consistência documental.
Procure ativamente: conflito de hierarquia documental, norma inadequada ao escopo, cálculo incoerente, unidade de medida divergente (cm × m, m² × m³), linguagem técnica reaproveitada de outro tipo de obra (ex.: rodovia num prédio), quadro/tabela inconsistente e redação/formatação crítica.

NÃO reporte divergência de identidade documental — nome da obra, unidade, município, bairro, endereço, proprietário, órgão, cliente ou código. Essa camada é auditada por regras determinísticas próprias e reafirmá-la aqui só gera ruído e falso positivo. Se notar um trecho que parece de outra obra, trate-o apenas como possível reaproveitamento de linguagem técnica, não como troca de identidade.

Se o trecho for sumário/índice (títulos com pontilhado e número de página), NÃO gere achados sobre ele — títulos repetidos, numeração ou grafia do índice não são defeitos. Nunca reclame de "recorte", "página fornecida" ou de não conseguir auditar a partir do sumário.

UMA OCORRÊNCIA, UM ACHADO. Grafia, concordância, pontuação e palavra trocada se corrigem uma a uma, em lugares diferentes do texto: cada uma é um achado com a SUA "pagina", o SEU trecho em "evidencia", o SEU "termo_busca" e a SUA "sugestao_correcao". NUNCA junte várias numa frase só ("pág. 8 ...; pág. 23 ...; pág. 35 ..."): assim ninguém consegue abrir, localizar no PDF nem marcar como resolvida uma ocorrência isolada. Junte num achado só quando UMA decisão resolver todas de uma vez (convenção de unidade, nomenclatura, regra de prevalência). Em achado de texto, escreva "categoria": "Ortografia / Redação".

Projeto informado: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Trecho: ${args.chunk.title}, páginas ${args.chunk.startPage}-${args.chunk.endPage}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "categoria do achado (use \"Ortografia / Redação\" nos de texto)",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa",
      "impacto": "critico_documental|tecnico_contratual|revisao_editorial"
    }
  ]
}

Se não encontrar erro relevante, retorne {"findings":[]}.

TEXTO:
${args.chunk.text}
`.trim();
}

/*
 * Teto de saída de um BLOCO (e da leitura de identidade).
 *
 * Os 1800 originais vinham de quando a saída era só texto. Hoje o teto é
 * COMPARTILHADO com os tokens de raciocínio, e o Padrão roda com esforço
 * "medium": um bloco denso queima os 1800 pensando e devolve `output_text`
 * vazio, com `incomplete_max_output_tokens`.
 *
 * Medido no 084_25_est_md.pdf em 11/08/2026: dois blocos responderam em 3s com
 * 217 e 257 tokens de saída, e um terceiro gastou 24s para entregar ZERO —
 * raciocínio comeu o teto inteiro. Duas tentativas seguidas, mesmo bloco.
 *
 * Subir o teto não sobe a conta sozinho: `max_output_tokens` é limite, não
 * compra. Quem paga caro é a truncagem — 1800 tokens cobrados por uma resposta
 * que não chegou. O piso é aplicado sobre a variável de ambiente de propósito,
 * porque os 1800 estão gravados no .env e no render.yaml.
 */
/**
 * O TETO DE SAÍDA DE UM BLOCO — agora em função do TAMANHO dele.
 *
 * Era fixo em 6.000 para qualquer bloco, e isso custou caro em 17/08/2026:
 * blocos agrupados em 28k caracteres truncaram 20 vezes seguidas no memorial
 * 084_25. Medido no banco (`AiUsageEvent`): as 20 chamadas truncadas somaram
 * **exatamente 120.000 tokens de saída** — 20 × 6.000, o teto inteiro — e
 * devolveram ZERO achado. US$ 4,32 de US$ 6,09 da auditoria inteira.
 *
 * A lição que essa fatura ensina: chamada truncada é o PIOR caso possível, não
 * um caso degradado. Ela gasta o teto todo em raciocínio e não entrega nada. Por
 * isso o teto não pode ser generoso "por precaução" — teto alto num bloco que
 * vai truncar só encarece a perda. O que resolve é o bloco caber.
 *
 * Os blocos que couberam na mesma corrida gastaram ~1.000 tokens cada; o único
 * com conteúdo de verdade (páginas 80-82, 11 achados) gastou 4.803 — perto
 * demais de 6.000 para o conforto de um teto fixo. Daí a escala: um bloco pequeno
 * segue com 6.000, e um bloco maior ganha proporcionalmente, sem nunca passar do
 * limite de segurança.
 */
function getMaxOutputTokens(chunkChars?: number) {
  const value = Number(process.env.NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS);

  if (Number.isFinite(value) && value > DEFAULT_CHUNK_MAX_OUTPUT_TOKENS) {
    return Math.min(MAX_CHUNK_OUTPUT_TOKENS, Math.floor(value));
  }

  if (!chunkChars || !Number.isFinite(chunkChars)) {
    return DEFAULT_CHUNK_MAX_OUTPUT_TOKENS;
  }

  return Math.min(
    MAX_CHUNK_OUTPUT_TOKENS,
    Math.max(DEFAULT_CHUNK_MAX_OUTPUT_TOKENS, Math.ceil(chunkChars / 2)),
  );
}

// A passada de coerência lê o documento inteiro e pode devolver vários achados
// com evidências longas; precisa de um teto de saída bem maior que o dos blocos,
// senão o JSON trunca e a etapa vira "resposta inválida" (0 achados).
function getCoherenceMaxOutputTokens() {
  const value = Number(process.env.NEXODOC_COHERENCE_MAX_OUTPUT_TOKENS);

  if (Number.isFinite(value) && value >= 2000) {
    return Math.min(16000, Math.floor(value));
  }

  return 6000;
}

// Teto de saída da leitura global do Profundo, que agora lê o documento inteiro.
// Precisa ser grande para caber a lista completa de achados sem truncar o JSON.
/*
 * Teto de saída da LEITURA GLOBAL, por nível.
 *
 * O Padrão usava `getMaxOutputTokens()` — 1800, o teto pensado para um BLOCO de
 * capítulo — na passada que lê o documento inteiro. Num memorial de 132 páginas
 * o JSON truncava, `parseRequiredAuditModelJson` rejeitava a resposta inteira e
 * a etapa era descartada: a auditoria chegava como ANÁLISE PARCIAL.
 *
 * Medido no banco em 2026-07-29: das 25 auditorias concluídas com relatório, 8
 * vieram parciais; 6 delas eram Padrão com "resposta inválida na etapa
 * audit-global", todas no mesmo documento, em 77-94s — longe de qualquer
 * timeout. O mesmo documento passava quando a saída cabia.
 *
 * Retentativa NÃO resolveria: truncar é determinístico, e tentar de novo com o
 * mesmo teto trunca de novo. O que faltava era espaço para a resposta.
 *
 * O Padrão fica abaixo do Profundo de propósito: ele lê uma janela amostrada do
 * documento, então devolve menos achados — e o teto é também um freio de custo.
 */
/*
 * OS PADRÕES CARREGAM +6.000 DE FOLGA PARA A SÍNTESE POR CAPÍTULO.
 *
 * A leitura global passa a devolver, além dos achados, uma linha por capítulo —
 * e os memoriais reais têm de 33 a 148 capítulos (medido em 12/08/2026), o que
 * dá até ~6.000 tokens só de síntese. Sem a folga, somá-la ao mesmo teto faz o
 * JSON truncar, e truncar aqui derruba os ACHADOS junto: a etapa inteira vira
 * "resposta inválida" com zero achados. Foi o que aconteceu no 017-26 com 6.000.
 *
 * `max_output_tokens` é teto, não meta: subir não custa nada em auditoria que
 * não usa o espaço.
 *
 * Quem sobrescrever pelas variáveis de ambiente está assumindo o número — e
 * precisa lembrar desta folga, senão volta a truncar.
 */
function getStandardGlobalMaxOutputTokens() {
  const value = Number(process.env.NEXODOC_STANDARD_GLOBAL_MAX_OUTPUT_TOKENS);

  if (Number.isFinite(value) && value >= 2000) {
    return Math.min(16000, Math.floor(value));
  }

  return 14000;
}

function getDeepGlobalMaxOutputTokens() {
  const value = Number(process.env.NEXODOC_DEEP_GLOBAL_MAX_OUTPUT_TOKENS);

  if (Number.isFinite(value) && value >= 4000) {
    return Math.min(32000, Math.floor(value));
  }

  return 22000;
}

// A leitura global do Profundo lê o documento inteiro e devolve bastante saída —
// precisa de bem mais que os 120s dos blocos. Teto de 15 min.
function getDeepGlobalTimeoutMs() {
  const value = Number(process.env.NEXODOC_DEEP_GLOBAL_TIMEOUT_MS);

  if (Number.isFinite(value) && value >= 120_000) {
    return Math.min(900_000, Math.floor(value));
  }

  /*
   * 900s, não 480s. O 480 foi medido no 017-26 com o prompt antigo (78k tokens
   * de entrada, cap de 30 achados): 181s, 192s, 202s.
   *
   * Em 12/08/2026 o prompt passou a pedir muito mais por passada — peque pelo
   * excesso, cap de 60, conferência aritmética de toda tabela e sumário contra
   * corpo. No 063-26 (48k tokens de entrada, MENOS que o 017-26) a passada bateu
   * exatamente nos 480s e foi abortada: a auditoria voltou com 0 achado de IA e
   * US$ ~0,60 queimados. Não foi o documento que cresceu, foi o pedido.
   *
   * Quem aperta este número troca a leitura global inteira por uma economia que
   * ninguém pediu — e o custo do aborto é o mesmo do sucesso.
   */
  return 900_000;
}

/*
 * A validação tem tempo PRÓPRIO, não o de bloco.
 *
 * Ela herdava `getChunkTimeoutMs()` — orçamento pensado para um capítulo curto —
 * mas no Profundo recebe os achados de uma leitura do documento INTEIRO, que
 * sozinha leva 180s+. Resultado medido no 017-26: `status=FAILED ... 120014ms ::
 * Request was aborted` em toda auditoria profunda, ou seja, a passada que rebaixa
 * achado incerto para "Sugestão" e filtra alucinação simplesmente não rodava
 * justamente no modo que mais depende dela.
 */
function getValidationTimeoutMs(analysisLevel: AnalysisLevel) {
  const value = Number(process.env.NEXODOC_VALIDATION_TIMEOUT_MS);

  if (Number.isFinite(value) && value >= 60_000) {
    return Math.min(480_000, Math.floor(value));
  }

  return analysisLevel === "deep" ? 300_000 : getChunkTimeoutMs();
}

/*
 * COBERTURA TOTAL — o nível único que lê o documento inteiro DE VERDADE.
 *
 * Hoje nenhum dos dois níveis cobre um memorial grande:
 *
 *   Padrão   identidade + leitura global AMOSTRADA (90k: cabeça/meio/cauda)
 *            + no máximo 8 blocos → buraco depois do 8º capítulo;
 *   Profundo identidade + leitura global INTEIRA (até 700k) + ZERO blocos
 *            → uma chamada gigante, com a perda de recall no miolo que toda
 *              janela longa tem.
 *
 * Os blocos foram cortados do Profundo quando a leitura global passou a ler o
 * documento inteiro (item 5, "vira redundante"). A premissa era que ler tudo
 * numa ida equivale a ler por partes — e não equivale: a chamada única enxerga o
 * documento, a passada por capítulo o EXAMINA. Foi num memorial de 300k que os
 * dois falsos positivos do 084_25 apareceram no lugar dos achados reais.
 *
 * Com esta flag ligada some a distinção: um nível só, leitura global inteira MAIS
 * um bloco por capítulo, sem teto. Custa mais e por isso nasce desligada — a
 * medição vem antes de virar padrão (ver `scripts/mede-cobertura-total.ts`).
 */
function isCoberturaTotalEnabled() {
  return process.env.NEXODOC_AUDIT_COBERTURA_TOTAL === "true";
}

function getMaxChunksPerFile(analysisLevel: AnalysisLevel) {
  const value = Number(process.env.NEXODOC_MAX_CHUNKS_PER_FILE);
  // Sem teto na cobertura total: o teto É o buraco que ela existe para fechar.
  // O override numérico continua valendo, para poder afunilar numa emergência.
  const modeLimit = isCoberturaTotalEnabled()
    ? Number.POSITIVE_INFINITY
    : analysisLevel === "deep"
      ? 24
      : 8;

  if (Number.isFinite(value) && value > 0) {
    return Math.min(modeLimit, Math.floor(value));
  }

  if (isCoberturaTotalEnabled()) {
    return Number.POSITIVE_INFINITY;
  }

  return analysisLevel === "deep" ? DEFAULT_MAX_CHUNKS_PER_FILE : 8;
}

function getChunkConcurrency() {
  const value = Number(process.env.NEXODOC_CHUNK_CONCURRENCY);

  if (Number.isFinite(value) && value > 0) {
    return Math.min(4, Math.floor(value));
  }

  return DEFAULT_CHUNK_CONCURRENCY;
}

/** Teto de tempo da leitura global no Padrão — os 120s dos blocos ficam curtos. */
function getStandardGlobalTimeoutMs() {
  const value = Number(process.env.NEXODOC_STANDARD_GLOBAL_TIMEOUT_MS);

  if (Number.isFinite(value) && value >= 60_000) {
    return Math.min(300_000, Math.floor(value));
  }

  return 180_000;
}

function getChunkTimeoutMs() {
  const value = Number(process.env.NEXODOC_CHUNK_TIMEOUT_MS);

  if (Number.isFinite(value) && value >= 30_000) {
    return Math.min(300_000, Math.floor(value));
  }

  return DEFAULT_CHUNK_TIMEOUT_MS;
}

// A1 — no nível Profundo a leitura global recebe o DOCUMENTO INTEIRO (uma passada
// forte, como quem cola o PDF todo no ChatGPT). Antes amostrava ~90k chars (~1/5
// de um memorial), então a IA nunca via a metade de trás e só sobrava o sumário.
// O gpt-5.5 comporta ~300k+ chars com folga. Padrão segue amostrado (velocidade/custo).
const IDENTITY_CONTEXT_PATTERN =
  /\b(obra|identifica[cç][aã]o|localiza[cç][aã]o|endere[cç]o|propriet[aá]rio|nome|memorial descritivo|projeto preventivo|ppci|constru[cç][aã]o|reforma|adequa[cç][aã]o)\b/gi;

const IDENTITY_CANDIDATE_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
  {
    field: "identidade em cabecalho",
    pattern: /[–-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,120})\s+[–-]\s*PROJETO\s+EXECUTIVO/gi,
  },
  {
    field: "campo identificado",
    pattern: /\b(obra|identifica[cç][aã]o|nome|projeto|localiza[cç][aã]o|endere[cç]o|propriet[aá]rio|cliente|[oó]rg[aã]o)\s*:\s*([^.;\n]{4,180})/gi,
  },
  {
    field: "entidade nomeada",
    pattern: /\b((?:Centro|Cidade|UBS|Unidade|Escola|Creche|Gin[aá]sio|Reforma)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^,.;\n]{2,110})/g,
  },
  {
    field: "finalidade/obra citada",
    pattern: /\b(?:constru[cç][aã]o|execu[cç][aã]o|implanta[cç][aã]o)\s+(?:da|do|de|para\s+a|para\s+o)\s+([^.;\n]{4,140})/gi,
  },
  {
    field: "reforma/adequacao citada",
    pattern: /\b(?:reforma|adequa[cç][aã]o|reforma\s+e\s+adequa[cç][aã]o)\s*(?:[-–]\s*)?([^.;\n]{4,140})/gi,
  },
];

type IdentityCandidate = {
  field: string;
  value: string;
  pages: number[];
  count: number;
  evidence: string;
  firstPage: number;
  key: string;
};

function getContextSnippet(text: string, index: number, radius = 320) {
  return text
    .slice(Math.max(0, index - radius), Math.min(text.length, index + radius))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanIdentityCandidate(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^(?:para\s+a|para\s+o|da|do|de)\s+/i, "")
    .replace(/^reforma\s+/i, "")
    .replace(/\s+(?:é|possui|volume|projeto executivo|localizado|localizada|sito|situado|situada|no munic[ií]pio|em crici[uú]ma|endereço|endere[cç]o|propriet[aá]rio|[aá]rea)\b.*$/i, "")
    .replace(/\s*[,;:.-]+$/g, "")
    .trim();
}

function isLikelyProjectIdentity(value: string) {
  const normalized = normalizeLoose(value);

  // valor CRU: `isLocalityPhrase` usa a caixa para separar "na cidade de
  // Criciúma" (localidade) de "Cidade do Autista" (obra real).
  if (isLocalityPhrase(value)) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const startsAsNamedEntity =
    /^(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(
      normalized,
    );

  if (normalized.length < 8) {
    return false;
  }

  if (
    /\bescola municipal\s+contendo\s+\w+\s+blocos?\b/i.test(normalized) ||
    /\bnao\s+(?:e|eh)\s+considerado\b/i.test(normalized)
  ) {
    return false;
  }

  if (words.length > 10 && !startsAsNamedEntity) {
    return false;
  }

  if (
    /\b(procedimento|norma|paver|chapisco|estrutura|contentor|contentores|litros|publico em|acessibilidade|declividade|carga|pavimento|projeto executivo|prefeitura municipal|fiscalizacao|desenhos atualizados|conforme executado|aterro|aterros|jazida|infraestrutura composta|cabos|tubulacoes|caixas de passagem|tomadas de logica|rack de telecomunicacoes|indice de atendimento|populacao atendida|unidade de saude)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return /\b(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(normalized);
}

function shouldKeepIdentityCandidate(field: string, value: string) {
  const normalized = normalizeLoose(value);

  if (isLocalityPhrase(value)) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const startsAsNamedEntity =
    /^(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(
      normalized,
    );

  if (
    /\bescola municipal\s+contendo\s+\w+\s+blocos?\b/i.test(normalized) ||
    /\bnao\s+(?:e|eh)\s+considerado\b/i.test(normalized)
  ) {
    return false;
  }

  if (
    field === "finalidade/obra citada" &&
    (!startsAsNamedEntity || words.length > 10)
  ) {
    return false;
  }

  if (
    /\b(fiscalizacao|desenhos atualizados|conforme executado|aterro|aterros|jazida|infraestrutura composta|cabos|tubulacoes|caixas de passagem|tomadas de logica|rack de telecomunicacoes|indice de atendimento|populacao atendida|unidade de saude)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return true;
}

function identityComparisonKey(value: string) {
  return normalizeLoose(value)
    .replace(/\b(de|do|da|dos|das)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIdentityCandidates(extracted: ExtractedPdf) {
  const groups = new Map<string, IdentityCandidate>();

  for (const page of extracted.pages) {
    for (const { field, pattern } of IDENTITY_CANDIDATE_PATTERNS) {
      pattern.lastIndex = 0;

      for (const match of page.text.matchAll(pattern)) {
        const rawValue = match[2] ?? match[1] ?? "";
        const value = cleanIdentityCandidate(rawValue);
        const key = normalizeLoose(value);

        if (value.length < 4 || key.length < 4) {
          continue;
        }

        if (!shouldKeepIdentityCandidate(field, value)) {
          continue;
        }

        const current = groups.get(key);

        if (current) {
          current.count += 1;

          if (!current.pages.includes(page.page)) {
            current.pages.push(page.page);
          }

          continue;
        }

        groups.set(key, {
          field,
          value,
          pages: [page.page],
          count: 1,
          evidence: getContextSnippet(page.text, match.index ?? 0, 220),
          firstPage: page.page,
          key,
        });
      }
    }
  }

  return [...groups.values()]
    .sort((left, right) => {
      const countDiff = right.count - left.count;

      if (countDiff !== 0) {
        return countDiff;
      }

      return left.firstPage - right.firstPage;
    })
    .slice(0, 160);
}

function buildIdentityCandidateInventory(extracted: ExtractedPdf) {
  return getIdentityCandidates(extracted)
    .map((item) => {
      return [
        `Campo: ${item.field}`,
        `Valor: ${item.value}`,
        `Paginas: ${item.pages.join(", ")}`,
        `Ocorrencias: ${item.count}`,
        `Evidencia: ${item.evidence}`,
      ].join("\n");
    })
    .join("\n\n");
}

function areSameIdentity(left: IdentityCandidate, right: IdentityCandidate) {
  const leftKey = identityComparisonKey(left.value);
  const rightKey = identityComparisonKey(right.value);

  return leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey);
}

function isActionableDivergentIdentityCandidate(
  candidate: IdentityCandidate,
  dominant: IdentityCandidate,
) {
  const candidateKey = identityComparisonKey(candidate.value);
  const dominantKey = identityComparisonKey(dominant.value);
  const candidateWords = candidateKey.split(/\s+/).filter(Boolean);

  if (candidateWords.length > 10) {
    return false;
  }

  if (candidateKey.includes(dominantKey) || dominantKey.includes(candidateKey)) {
    return false;
  }

  if (
    candidate.field === "finalidade/obra citada" &&
    !/^(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(
      candidateKey,
    )
  ) {
    return false;
  }

  return true;
}

function summarizePages(pages: number[]) {
  const uniquePages = [...new Set(pages)].sort((left, right) => left - right);
  const visible = uniquePages.slice(0, 6).join(", ");

  if (uniquePages.length <= 6) {
    return visible;
  }

  return `${visible} e mais ${uniquePages.length - 6}`;
}

function getDominantIdentityCandidate(candidates: IdentityCandidate[]) {
  const viable = candidates.filter((candidate) => isLikelyProjectIdentity(candidate.value));

  return viable
    .map((candidate) => {
      const earlyBonus = candidate.firstPage <= 3 ? 10 : candidate.firstPage <= 15 ? 4 : 0;
      const headerBonus = candidate.field === "identidade em cabecalho" ? 12 : 0;
      const labelBonus = candidate.field === "campo identificado" ? 4 : 0;

      return {
        candidate,
        score: candidate.count * 3 + earlyBonus + headerBonus + labelBonus,
      };
    })
    .sort((left, right) => right.score - left.score)[0]?.candidate ?? null;
}

function deriveIdentityFindingsFromText(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const candidates = getIdentityCandidates(extracted);
  const dominant = getDominantIdentityCandidate(candidates);

  if (!dominant) {
    return [];
  }

  const divergentGroups = new Map<string, IdentityCandidate>();

  for (const candidate of candidates
    .filter((candidate) => isLikelyProjectIdentity(candidate.value))
    .filter((candidate) => !areSameIdentity(candidate, dominant))
    .filter((candidate) => isActionableDivergentIdentityCandidate(candidate, dominant))
    .filter((candidate) => candidate.firstPage > dominant.firstPage || candidate.count < dominant.count)
    .sort((left, right) => left.firstPage - right.firstPage)) {
    const key = identityComparisonKey(candidate.value);
    const current = divergentGroups.get(key);

    if (current) {
      current.count += candidate.count;
      current.pages = [...new Set([...current.pages, ...candidate.pages])].sort((left, right) => left - right);
      continue;
    }

    divergentGroups.set(key, { ...candidate });
  }

  return [...divergentGroups.values()].slice(0, 4).map((candidate, index) => ({
    id: `ID-${String(index + 1).padStart(3, "0")}`,
    arquivo: fileName,
    origem: "regra",
    prioridade: "Alta",
    pagina: candidate.pages.join(", "),
    capitulo: "Identidade documental",
    local: candidate.field,
    tipo: "Possível trecho reaproveitado de outro projeto",
    descricao: `O documento tem identidade predominante "${dominant.value}", mas também cita "${candidate.value}".`,
    evidencia: candidate.evidence,
    termo_busca: candidate.value.slice(0, 160),
    categoria: "Identidade documental",
    referencia_comparada: `Identidade predominante inferida: ${dominant.value} (${dominant.count} ocorrência(s), páginas ${summarizePages(dominant.pages)}).`,
    conflito: `"${candidate.value}" não corresponde à identidade predominante "${dominant.value}".`,
    sugestao_correcao: "Confirmar a obra correta e revisar o trecho indicado para remover referência residual de outro projeto.",
    confianca: candidate.count === 1 ? "media" : "alta",
    impacto: "critico_documental",
  }));
}

function getDominantIdentityForPages(
  extracted: ExtractedPdf,
  predicate: (page: ExtractedPdf["pages"][number]) => boolean,
) {
  const pages = extracted.pages.filter(predicate);

  if (pages.length === 0) {
    return null;
  }

  return getDominantIdentityCandidate(
    getIdentityCandidates({
      pages,
      text: pages.map((page) => `--- PAGINA ${page.page} ---\n${page.text}`).join("\n\n"),
      pageCount: pages.length,
      charCount: pages.reduce((total, page) => total + page.text.length, 0),
    }),
  );
}

function deriveMandatoryIdentityGuardFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const firstPage = extracted.pages[0];

  if (firstPage && firstPage.text.length < 80) {
    findings.push({
      id: "GUARDA-CAPA-LEITURA",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media/Alta",
      pagina: String(firstPage.page),
      capitulo: "Pré-leitura documental",
      local: "capa / primeira página",
      tipo: "Capa sem texto pesquisável suficiente",
      descricao:
        "A primeira página possui pouco texto extraível, então a auditoria não consegue validar a capa com segurança.",
      evidencia: firstPage.text || "Nenhum texto pesquisável relevante extraído da primeira página.",
      termo_busca: firstPage.text.slice(0, 120) || "capa sem texto pesquisável",
      categoria: "Confiabilidade da leitura",
      referencia_comparada: "Texto extraído da primeira página do PDF.",
      conflito:
        "Sem texto pesquisável na capa, o sistema pode deixar passar obra, código, município ou órgão divergente.",
      sugestao_correcao:
        "Enviar PDF com OCR/texto pesquisável ou revisar manualmente a capa antes de aceitar o relatório.",
      confianca: "alta",
      impacto: "tecnico_contratual",
    });
  }

  const coverIdentity = getDominantIdentityForPages(extracted, (page) => page.page <= 2);
  const bodyIdentity = getDominantIdentityForPages(extracted, (page) => page.page > 2);

  if (
    coverIdentity &&
    bodyIdentity &&
    isLikelyProjectIdentity(coverIdentity.value) &&
    isLikelyProjectIdentity(bodyIdentity.value) &&
    !areSameIdentity(coverIdentity, bodyIdentity)
  ) {
    findings.push({
      id: "GUARDA-CAPA-CORPO",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Alta",
      pagina: coverIdentity.pages.join(", "),
      capitulo: "Identidade documental",
      local: "capa x corpo do memorial",
      tipo: "Capa divergente do corpo do memorial",
      descricao: `A capa indica "${coverIdentity.value}", mas o corpo do memorial indica "${bodyIdentity.value}".`,
      evidencia: coverIdentity.evidence,
      termo_busca: coverIdentity.value.slice(0, 160),
      categoria: "Identidade documental",
      referencia_comparada: `Identidade predominante no corpo: ${bodyIdentity.value} (páginas ${summarizePages(bodyIdentity.pages)}).`,
      conflito: `"${coverIdentity.value}" na capa não corresponde a "${bodyIdentity.value}" no corpo do memorial.`,
      sugestao_correcao:
        "Substituir a capa ou revisar o corpo do memorial para que a identidade documental seja única antes da emissão.",
      confianca: "alta",
      impacto: "critico_documental",
    });
  }

  return findings;
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function findEvidenceLine(text: string, term: string) {
  const normalizedTerm = normalizeLoose(term);
  const line = text
    .split(/\r?\n/)
    .find((item) => normalizeLoose(item).includes(normalizedTerm));

  return (line ?? term).replace(/\s+/g, " ").trim();
}

function deriveSpellingFindingsFromText(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const dominant = getDominantIdentityCandidate(getIdentityCandidates(extracted));

  if (!dominant) {
    return [];
  }

  const identityWords = normalizeLoose(dominant.value)
    .split(/\s+/)
    .filter((word) => word.length >= 8);
  const findings = new Map<string, AuditFinding>();

  if (identityWords.length === 0) {
    return [];
  }

  for (const page of extracted.pages) {
    const rawWords = page.text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{8,}\b/g) ?? [];

    for (const rawWord of rawWords) {
      const normalizedWord = normalizeLoose(rawWord);
      const target = identityWords.find((word) => {
        return (
          normalizedWord !== word &&
          normalizedWord[0] === word[0] &&
          Math.abs(normalizedWord.length - word.length) <= 2 &&
          levenshteinDistance(normalizedWord, word) <= 2
        );
      });

      if (!target || findings.has(normalizedWord)) {
        continue;
      }

      findings.set(normalizedWord, {
        id: `REG-GRAFIA-${String(findings.size + 1).padStart(3, "0")}`,
        arquivo: fileName,
        origem: "regra",
        prioridade: "Media",
        pagina: String(page.page),
        capitulo: "Identidade documental",
        local: "nome da obra",
        tipo: "Grafia divergente no nome da obra",
        descricao: `O termo "${rawWord}" parece uma variação ortográfica de "${target}".`,
        evidencia: findEvidenceLine(page.text, rawWord),
        termo_busca: rawWord,
        categoria: "Revisão editorial",
        referencia_comparada: `Identidade predominante inferida: ${dominant.value}.`,
        conflito: `A grafia "${rawWord}" diverge da forma predominante "${target}", sem indicar troca de obra.`,
        sugestao_correcao: "Padronizar a grafia do nome da obra no trecho indicado.",
        confianca: "media",
        impacto: "tecnico_contratual",
      });
    }
  }

  return [...findings.values()].slice(0, 4);
}

function cleanHeadingTitle(value: string) {
  return normalizeLoose(value)
    .replace(/\d+/g, " ")
    .replace(/\b(pag|pagina|página)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSummaryAndNumberingFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const headings: Array<{ page: number; number: string; title: string; evidence: string }> = [];

  for (const page of extracted.pages) {
    for (const line of page.text.split(/\r?\n/)) {
      const compactLine = line.replace(/\s+/g, " ").trim();
      const match = /^(\d+(?:\.\d+)+)\s+([^.\n]{4,120}?)(?:\.{2,}|\s{2,}|\d{1,4}\s*$|$)/.exec(compactLine);

      if (!match) {
        continue;
      }

      const title = match[2].trim();

      if (title.length < 4 || cleanHeadingTitle(title).length < 4) {
        continue;
      }

      headings.push({
        page: page.page,
        number: match[1],
        title,
        evidence: compactLine,
      });
    }
  }

  const findings: AuditFinding[] = [];
  const byTitle = new Map<string, Array<{ page: number; number: string; title: string; evidence: string }>>();

  for (const heading of headings) {
    const key = cleanHeadingTitle(heading.title);
    const current = byTitle.get(key) ?? [];
    current.push(heading);
    byTitle.set(key, current);
  }

  for (const entries of byTitle.values()) {
    const distinctNumbers = [...new Set(entries.map((entry) => entry.number))];

    if (entries.length < 2 || distinctNumbers.length < 2) {
      continue;
    }

    const sample = entries.slice(0, 3);
    findings.push({
      id: `REG-SUM-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: [...new Set(sample.map((entry) => entry.page))].join(", "),
      capitulo: "Sumário / hierarquia",
      local: sample.map((entry) => entry.number).join(" e "),
      tipo: "Título repetido em itens distintos",
      descricao: `O título "${sample[0].title}" aparece em mais de um item numerado.`,
      evidencia: sample.map((entry) => entry.evidence).join(" | "),
      termo_busca: sample[0].title.slice(0, 160),
      categoria: "Sumário / hierarquia",
      referencia_comparada: `Itens identificados: ${distinctNumbers.join(", ")}.`,
      conflito: "A repetição do mesmo título em itens diferentes sugere erro de edição, duplicidade ou seção não renomeada.",
      sugestao_correcao: "Confirmar se os itens tratam de assuntos diferentes; se forem distintos, renomear. Se forem duplicados, eliminar redundância e renumerar.",
      confianca: "alta",
      impacto: "tecnico_contratual",
    });

    if (findings.length >= 3) {
      break;
    }
  }

  const text = extracted.text.replace(/\r/g, "");
  const hierarchyChecks = [
    {
      chapter: "8",
      label: "Projeto Estrutural",
      wrongPrefix: "1.",
      pattern: /(?:^|\n)\s*8(?:\.\d+)?\s+[^\n]{0,80}Projeto\s+Estrutural[\s\S]{0,12000}?(?:^|\n)\s*(1\.(?:1[2-9]|[2-9]\d?)\s+[^\n]{4,140})/i,
    },
    {
      chapter: "14.3",
      label: "Memorial de Cálculo do Processo de Tratamento",
      wrongPrefix: "1.3.",
      pattern: /(?:^|\n)\s*14\.3\s+[^\n]{0,120}Memorial\s+de\s+C[aá]lculo[\s\S]{0,12000}?(?:^|\n)\s*(1\.3\.\d+\s+[^\n]{4,140})/i,
    },
  ];

  for (const check of hierarchyChecks) {
    const match = check.pattern.exec(text);

    if (!match) {
      continue;
    }

    const evidence = match[1].replace(/\s+/g, " ").trim();
    const page = extracted.pages.find((item) => item.text.includes(match[1]))?.page ?? "";

    findings.push({
      id: `REG-NUM-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: page ? String(page) : "não identificada",
      capitulo: check.label,
      local: `numeração iniciada por ${check.wrongPrefix}`,
      tipo: "Numeração hierárquica incoerente",
      descricao: `Foi encontrado item com prefixo "${check.wrongPrefix}" dentro do capítulo ${check.chapter}.`,
      evidencia: evidence,
      termo_busca: evidence.slice(0, 160),
      categoria: "Sumário / hierarquia",
      referencia_comparada: `Capítulo esperado: ${check.chapter}.`,
      conflito: "A numeração do subitem não acompanha o capítulo em que aparece, sugerindo colagem ou revisão incompleta.",
      sugestao_correcao: "Revisar a hierarquia e renumerar os subitens para seguir o capítulo correto.",
      confianca: "media",
      impacto: "tecnico_contratual",
    });
  }

  return findings.slice(0, 6);
}

function deriveTechnicalReuseFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const indicators = [
    "eixo da rodovia",
    "Volume 2 - Quadro de Origem e Destino",
    "Volume 2 – Quadro de Origem e Destino",
    "DNIT",
  ];
  const findings: AuditFinding[] = [];

  for (const page of extracted.pages) {
    const normalizedPage = normalizeLoose(page.text);
    const found = indicators.find((indicator) => normalizedPage.includes(normalizeLoose(indicator)));

    if (!found || normalizedPage.includes("sumario")) {
      continue;
    }

    findings.push({
      id: `REG-TEC-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: String(page.page),
      capitulo: "Coerência técnica do memorial",
      local: "redação técnica",
      tipo: "Linguagem técnica possivelmente reaproveitada",
      descricao: `O texto contém expressão típica de terraplenagem/rodovia: "${found}".`,
      evidencia: findEvidenceLine(page.text, found),
      termo_busca: found,
      categoria: "Revisão técnica",
      referencia_comparada: "Objeto principal inferido do documento e linguagem técnica do trecho.",
      conflito: "A expressão pode ser compatível com metodologia de terraplenagem, mas exige conferência porque pode indicar texto-base de outro tipo de projeto.",
      sugestao_correcao: "Revisar o trecho para confirmar se a linguagem rodoviária é aplicável ao escopo da obra ou se deve ser ajustada.",
      confianca: "media",
      impacto: "tecnico_contratual",
    });

    if (findings.length >= 1) {
      break;
    }
  }

  return findings;
}

function findLooseEvidenceLine(text: string, normalizedTerm: string) {
  const line = text
    .split(/\r?\n/)
    .find((item) => normalizeLoose(item).includes(normalizedTerm));

  return (line ?? normalizedTerm).replace(/\s+/g, " ").trim();
}

function deriveMemorialConsistencyFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const normalizedText = normalizeLoose(extracted.text);
  const hasJoseGiassi = normalizedText.includes("emeb jose giassi") || normalizedText.includes("jose giassi");
  const hasCriciuma = normalizedText.includes("criciuma");
  const coverPage = extracted.pages.find((page) => page.page <= 3);
  const coverText = normalizeLoose(coverPage?.text ?? "");

  if (coverPage && hasJoseGiassi && coverText.includes("centro comunitario primeira linha")) {
    findings.push({
      id: "REG-MEM-001",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Alta",
      pagina: String(coverPage.page),
      capitulo: "Capa / identidade documental",
      local: "titulo da capa",
      tipo: "Capa com obra divergente",
      descricao: "A capa cita Centro Comunitario Primeira Linha, mas o corpo do memorial identifica a obra como EMEB Jose Giassi.",
      evidencia: findLooseEvidenceLine(coverPage.text, "centro comunitario primeira linha"),
      termo_busca: "Centro Comunitario Primeira Linha",
      categoria: "Identidade documental",
      referencia_comparada: "Identidade predominante no memorial: EMEB Jose Giassi.",
      conflito: "O titulo da capa aponta outra obra, indicando reaproveitamento ou emissao com capa incorreta.",
      sugestao_correcao: "Corrigir a capa para a obra EMEB Jose Giassi e conferir se cabecalhos/rodapes usam a mesma identidade.",
      confianca: "alta",
      impacto: "critico_documental",
    });
  }

  if (
    (normalizedText.includes("construcao de escola municipal") ||
      normalizedText.includes("construcao da escola municipal") ||
      normalizedText.includes("construcao da escola municipal de ensino basico")) &&
    normalizedText.includes("reforma e adequacao do edificio")
  ) {
    const page = extracted.pages.find((item) => normalizeLoose(item.text).includes("reforma e adequacao do edificio"));

    findings.push({
      id: "REG-MEM-002",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media/Alta",
      pagina: page ? String(page.page) : "nao identificada",
      capitulo: "Escopo da obra",
      local: "plantas e desenhos",
      tipo: "Escopo de reforma em obra de construcao nova",
      descricao: "O memorial caracteriza a obra como construcao de escola municipal, mas tambem usa texto de reforma e adequacao do edificio.",
      evidencia: page ? findLooseEvidenceLine(page.text, "reforma e adequacao do edificio") : "reforma e adequacao do edificio",
      termo_busca: "reforma e adequacao do edificio",
      categoria: "Reaproveitamento de texto",
      referencia_comparada: "Caracterizacao predominante: construcao de escola municipal.",
      conflito: "O trecho parece herdado de memorial de reforma e nao corresponde ao escopo de construcao nova.",
      sugestao_correcao: "Substituir por texto indicando que os documentos servem de referencia para a construcao da edificacao.",
      confianca: "alta",
      impacto: "critico_documental",
    });
  }

  const areaRefs: Array<{ page: number; value: string; evidence: string }> = [];
  for (const page of extracted.pages) {
    for (const line of page.text.split(/\r?\n/)) {
      const normalizedLine = normalizeLoose(line);

      if (!normalizedLine.includes("area") || !normalizedLine.includes("construida")) {
        continue;
      }

      const values = line.match(/\d{1,3}(?:\.\d{3})*,\d{2}\s*m(?:²|2)?/gi) ?? [];
      for (const value of values) {
        areaRefs.push({
          page: page.page,
          value: value.replace(/\s+/g, " ").trim(),
          evidence: line.replace(/\s+/g, " ").trim(),
        });
      }
    }
  }
  const distinctAreas = [...new Set(areaRefs.map((item) => item.value))];

  if (distinctAreas.length >= 2) {
    const sample = areaRefs.filter((item, index) => areaRefs.findIndex((candidate) => candidate.value === item.value) === index);
    findings.push({
      id: "REG-MEM-003",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Alta",
      pagina: [...new Set(sample.map((item) => item.page))].join(", "),
      capitulo: "Area da obra",
      local: "areas construidas informadas",
      tipo: "Area construida divergente",
      descricao: `O memorial informa areas construidas diferentes: ${distinctAreas.join(" x ")}.`,
      evidencia: sample.map((item) => item.evidence).join(" | "),
      termo_busca: distinctAreas[0],
      categoria: "Consistencia quantitativa",
      referencia_comparada: "Valores de area construida encontrados no mesmo memorial.",
      conflito: "Nao fica claro qual area e oficial, nem se os valores representam area total, computavel ou area considerada por disciplina.",
      sugestao_correcao: "Padronizar a area oficial ou declarar explicitamente area total, area computavel e area considerada por disciplina.",
      confianca: "alta",
      impacto: "critico_documental",
    });
  }

  const hasFiveBlocks = /\b(cinco|5)\s+blocos?\b/i.test(normalizedText);
  const hasSixBlocks = /\b(seis|6)\s+blocos?\b/i.test(normalizedText);
  const hasBlockCQuadra = /\bbloco\s+c\b[\s\S]{0,80}\bquadra\b/i.test(normalizedText);
  const hasBlockEQuadra = /\bbloco\s+e\b[\s\S]{0,80}\bquadra\b/i.test(normalizedText);

  if ((hasFiveBlocks && hasSixBlocks) || (hasBlockCQuadra && hasBlockEQuadra)) {
    const page = extracted.pages.find((item) => {
      const normalizedPage = normalizeLoose(item.text);
      return normalizedPage.includes("bloco c") && normalizedPage.includes("quadra");
    }) ?? extracted.pages.find((item) => normalizeLoose(item.text).includes("seis blocos"));

    findings.push({
      id: "REG-MEM-004",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media/Alta",
      pagina: page ? String(page.page) : "nao identificada",
      capitulo: "Caracterizacao dos blocos",
      local: "descricao dos blocos da escola",
      tipo: "Quantidade ou nomenclatura de blocos incoerente",
      descricao: "O memorial alterna a caracterizacao dos blocos, com conflito entre cinco/seis blocos ou entre Bloco C e Bloco E para a quadra.",
      evidencia: page ? getContextSnippet(page.text, normalizeLoose(page.text).indexOf("bloco"), 420) : "blocos C/D, Bloco C, Bloco E, seis blocos",
      termo_busca: "Bloco C",
      categoria: "Consistencia interna",
      referencia_comparada: "Apresentacao dos blocos x descricoes tecnicas posteriores.",
      conflito: "A mesma estrutura da obra fica ambigua, afetando entendimento de escopo, disciplinas e revisao do memorial.",
      sugestao_correcao: "Padronizar a lista de blocos, indicando Blocos C/D para ensino fundamental, Bloco E para quadra se essa for a estrutura correta, e tratar reservatorio como apoio quando aplicavel.",
      confianca: "media",
      impacto: "tecnico_contratual",
    });
  }

  if (hasCriciuma && normalizedText.includes("coopera")) {
    const page = extracted.pages.find((item) => normalizeLoose(item.text).includes("coopera"));

    findings.push({
      id: "REG-MEM-005",
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: page ? String(page.page) : "nao identificada",
      capitulo: "Projeto eletrico",
      local: "concessionaria / normas aplicaveis",
      tipo: "Concessionaria eletrica exige validacao",
      descricao: "O memorial cita COOPERA para uma obra em Criciuma/SC; isso pode estar correto, mas exige confirmacao territorial.",
      evidencia: page ? findLooseEvidenceLine(page.text, "coopera") : "COOPERA",
      termo_busca: "COOPERA",
      categoria: "Ponto de checagem",
      referencia_comparada: "Endereco/municipio da obra em Criciuma/SC.",
      conflito: "Se a concessionaria aplicavel ao endereco nao for COOPERA, o trecho indica reaproveitamento de memorial eletrico ou norma incorreta.",
      sugestao_correcao: "Confirmar a concessionaria do endereco e ajustar normas de subestacao, medicao e aterramento se necessario.",
      confianca: "baixa",
      impacto: "tecnico_contratual",
    });
  }

  return findings;
}

function deriveRuleBasedReviewFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  return [
    ...deriveMemorialConsistencyFindings(extracted, fileName),
    ...deriveSpellingFindingsFromText(extracted, fileName),
    ...deriveSummaryAndNumberingFindings(extracted, fileName),
    ...deriveTechnicalReuseFindings(extracted, fileName),
  ];
}

function buildIdentityContext(extracted: ExtractedPdf) {
  const sections: string[] = [];

  for (const page of extracted.pages) {
    const snippets: string[] = [];
    const seen = new Set<string>();

    if (page.page <= 3) {
      const coverSnippet = page.text.slice(0, 1400).replace(/\s+/g, " ").trim();

      if (coverSnippet) {
        snippets.push(coverSnippet);
      }
    }

    IDENTITY_CONTEXT_PATTERN.lastIndex = 0;
    for (const match of page.text.matchAll(IDENTITY_CONTEXT_PATTERN)) {
      const candidate = getContextSnippet(page.text, match.index ?? 0);
      const key = candidate.slice(0, 160).toLowerCase();

      if (!candidate || seen.has(key)) {
        continue;
      }

      seen.add(key);
      snippets.push(candidate);

      if (snippets.length >= 5) {
        break;
      }
    }

    if (snippets.length > 0) {
      sections.push(`Pagina ${page.page}\n- ${snippets.join("\n- ")}`);
    }
  }

  return sections.join("\n\n").slice(0, 140_000);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

function modelFindingToAuditFinding(
  finding: ModelFinding,
  index: number,
  fileName?: string,
): AuditFinding | null {
  const description = String(finding.descricao ?? "").trim();
  const type = String(finding.tipo ?? "").trim();
  const evidence = String(finding.evidencia ?? "").trim();

  if (!description && !type && !evidence) {
    return null;
  }

  return {
    id: `IA-${String(index).padStart(3, "0")}`,
    arquivo: fileName,
    origem: "ia",
    prioridade: normalizePriority(finding.prioridade),
    pagina: String(finding.pagina ?? "não identificada"),
    capitulo: String(finding.capitulo ?? "não identificado"),
    local: String(finding.local ?? "não informado"),
    tipo: type || "Incongruência documental",
    descricao: description || evidence,
    evidencia: evidence || description,
    termo_busca: String(finding.termo_busca ?? (evidence || description))
      .trim()
      .slice(0, 160),
    categoria: String(finding.categoria ?? "").trim() || undefined,
    referencia_comparada:
      String(finding.referencia_comparada ?? "").trim() || undefined,
    conflito: String(finding.conflito ?? "não informado"),
    sugestao_correcao: String(finding.sugestao_correcao ?? "revisar o trecho indicado"),
    confianca: normalizeConfidence(finding.confianca),
    // O modelo agora declara a faixa. `parseFindingImpact` devolve undefined
    // quando vem vazio ou fora do vocabulário, e aí a inferência por palavra-chave
    // de audit-report.ts assume — o campo é uma melhora, não uma dependência.
    ...(parseFindingImpact(finding.impacto) ? { impacto: parseFindingImpact(finding.impacto)! } : {}),
  };
}

function hasSpecificAlternateIdentity(value: string) {
  const normalized = normalizeLoose(value);

  return (
    /\b(ubs|upa|centro|escola|creche|ginasio|ginásio|unidade)\s+[a-z0-9]/i.test(normalized) &&
    !/\b(unidade de saude|unidade atendida|populacao atendida)\b/i.test(normalized)
  );
}

function isLikelyFalseIdentityFinding(finding: AuditFinding) {
  const normalizedType = normalizeLoose(
    [
      finding.tipo,
      finding.categoria ?? "",
      finding.local,
      finding.descricao,
      finding.conflito,
      finding.evidencia,
      finding.termo_busca ?? "",
    ].join(" "),
  );

  const looksLikeIdentityConflict =
    normalizedType.includes("identidade") ||
    normalizedType.includes("reaproveitado de outro projeto") ||
    normalizedType.includes("nao corresponde a identidade predominante");

  if (!looksLikeIdentityConflict) {
    return false;
  }

  const searchTerm = normalizeLoose(finding.termo_busca ?? finding.evidencia);
  const evidence = normalizeLoose(finding.evidencia);
  const hasCorrectIdentityInEvidence =
    evidence.includes("centro de neurodivergencia") ||
    /pmf\s+secretaria municipal/.test(evidence) ||
    evidence.includes("projeto executivo memorial descritivo");
  const genericTechnicalContext =
    /\b(fiscalizacao|desenhos atualizados|conforme executado|aterro|aterros|jazida|infraestrutura composta|cabos|tubulacoes|caixas de passagem|tomadas de logica|rack de telecomunicacoes|indice de atendimento|populacao atendida|unidade de saude|estacao elevatoria|coeficiente de retorno)\b/i.test(
      `${searchTerm} ${evidence}`,
    );
  const startsAsGenericPhrase =
    /^(obra|aterros?|infraestrutura|indice|populacao|unidade|desenhos|fiscalizacao)\b/i.test(searchTerm);

  return (
    (hasCorrectIdentityInEvidence || genericTechnicalContext || startsAsGenericPhrase) &&
    !hasSpecificAlternateIdentity(searchTerm)
  );
}

function isLowValueModelFinding(finding: AuditFinding) {
  const normalized = normalizeLoose(
    [
      finding.tipo,
      finding.categoria ?? "",
      finding.local,
      finding.descricao,
      finding.evidencia,
      finding.conflito,
    ].join(" "),
  );

  if (
    normalized.includes("paginacao") &&
    normalized.includes("sumario") &&
    (normalized.includes("pagina analisada") || normalized.includes("trecho nao corresponde"))
  ) {
    return true;
  }

  if (
    normalized.includes("sobreposicao de escopo") &&
    normalized.includes("sumario") &&
    normalized.includes("paver") &&
    !normalized.includes("identidade")
  ) {
    return true;
  }

  return false;
}

function filterFalsePositiveIdentityFindings(findings: AuditFinding[]) {
  return findings.filter(
    (finding) =>
      !isLikelyFalseIdentityFinding(finding) && !isLowValueModelFinding(finding),
  );
}

function getAlternateIdentityKey(finding: AuditFinding) {
  const normalized = normalizeLoose(
    [finding.termo_busca ?? "", finding.conflito, finding.descricao, finding.evidencia].join(" "),
  );

  if (
    !normalized.includes("identidade predominante") &&
    !normalized.includes("nao corresponde") &&
    !normalized.includes("outro projeto")
  ) {
    return "";
  }

  const known = /(cidade do autista|centro dia do idoso|centro comunitario boa vista)/i.exec(normalized)?.[1];

  if (known) {
    return known;
  }

  const generic =
    /\b((?:cidade|centro|ubs|upa|unidade|escola|creche|ginasio)\s+[a-z0-9]+(?:\s+[a-z0-9]+){0,4})\b/i.exec(
      normalized,
    )?.[1] ?? "";

  return generic
    .replace(/\s+(?:e|eh|é|para|localizado|situado|sito)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactRepeatedIdentityFindings(findings: AuditFinding[]) {
  const result: AuditFinding[] = [];
  const byAlternateIdentity = new Map<string, AuditFinding>();

  for (const finding of findings) {
    const key = getAlternateIdentityKey(finding);

    if (!key) {
      result.push(finding);
      continue;
    }

    const current = byAlternateIdentity.get(key);

    if (!current) {
      byAlternateIdentity.set(key, finding);
      result.push(finding);
      continue;
    }

    current.pagina = [...new Set([...current.pagina.split(/\s*,\s*/), ...finding.pagina.split(/\s*,\s*/)])]
      .filter(Boolean)
      .join(", ");
    current.evidencia = current.evidencia.length >= finding.evidencia.length ? current.evidencia : finding.evidencia;
    current.confianca = current.confianca === "alta" || finding.confianca === "alta" ? "alta" : "media";
  }

  return result;
}

function dedupeFindings(findings: AuditFinding[]) {
  const seen = new Set<string>();
  const result: AuditFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.arquivo,
      finding.tipo,
      finding.pagina,
      finding.evidencia.slice(0, 120),
      finding.conflito.slice(0, 120),
    ]
      .join("|")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ ...finding, id: `INC-${String(result.length + 1).padStart(3, "0")}` });
  }

  return result;
}

function inferProjectFields(text: string, fallbackProjectName: string) {
  const obra =
    /\bObra\s*:\s*([^,.;\n]{4,120})/i.exec(text)?.[1]?.trim() ??
    /\bIdentifica[cç][aã]o\s*:\s*([^,.;\n]{4,120})/i.exec(text)?.[1]?.trim() ??
    /\b\d{2,4}[_-]\d{2}\s*[–-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,120})\s*[–-]\s*PROJETO\s+EXECUTIVO/i.exec(text)?.[1]?.trim() ??
    /UBS\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s-]+PORTE\s*\d+/i.exec(text)?.[0]?.trim() ??
    fallbackProjectName;
  const codigo = /\b\d{2,4}[_-]\d{2}\b/.exec(text)?.[0]?.replace("_", "-") ?? "";
  const municipio =
    /(Crici[uú]ma\/SC|Chapec[oó]\/SC|Munic[ií]pio\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]+)/i.exec(text)?.[0] ??
    "";
  const data = /(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/?\s*\d{4}/i.exec(text)?.[0]?.replace(/\s*\/\s*/g, "/") ?? "";
  const volume =
    /\bVol(?:ume)?\.?\s*(?:n[ºo]\s*)?([IVXLCDM]+|\d+)\b/i.exec(text)?.[0]?.trim() ??
    /\bVolume\s+([IVXLCDM]+|\d+)\b/i.exec(text)?.[0]?.trim() ??
    /\bVOL\.?\s*[–-]?\s*([IVXLCDM]+|\d+)\b/i.exec(text)?.[0]?.trim() ??
    "";
  const orgao =
    /(Prefeitura\s+Municipal\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+(?:Secretaria\s+Municipal\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+)?)/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ??
    /(Prefeitura\s+Municipal\s+de\s+Florian[oó]polis\s*\/\s*Secretaria\s+Municipal\s+de\s+Infraestrutura\s+e\s+Manuten[cç][aã]o\s+da\s+Cidade)/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ??
    /(PMF\s*-\s*Secretaria\s+Municipal\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+)/i
      .exec(text)?.[0]
      ?.replace(/^PMF\s*-\s*/i, "Prefeitura Municipal de Florianópolis / ")
      .replace(/\s+/g, " ")
      .trim() ??
    /(SECRETARIA\s+MUNICIPAL\s+DE\s+INFRAESTRUTURA\s+E\s+MANUTEN[CÇ][AÃ]O\s+DA\s+CIDADE)/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .replace(/^/i, "Prefeitura Municipal de Florianópolis / ")
      .trim() ??
    "";

  return {
    obra,
    codigo,
    municipio,
    volume,
    orgao,
    data,
  };
}

function inferDocumentType(auditMode: AuditMode, text: string) {
  if (/memorial\s+descritivo/i.test(text)) {
    return "Memorial Descritivo";
  }

  if (/lista\s+de\s+documentos|lista\s+de\s+desenhos|\bLD\b/i.test(text)) {
    return "Lista de Documentos";
  }

  if (/prancha|selo|carimbo/i.test(text)) {
    return "Prancha";
  }

  return auditMode === "volume" ? "Volume de projeto" : "Memorial Descritivo";
}

/** "17/08" — a data do parecer anterior, para a frase da recusa e o selo. */
function formatarDataCurta(quando: Date | null | undefined) {
  return quando
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(quando)
    : "antes";
}

function isMissingProjectField(value: string) {
  const normalized = normalizeLoose(value);

  return !normalized || normalized === "projeto nao informado" || normalized === "nao informado";
}

async function analyzeChunkWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  chunk: AuditTextChunk;
  conversationId?: string | null;
  userEmail?: string | null;
  /** Coletor de passadas incompletas (best-effort NÃO é silencioso). */
  degradacoes?: PassadaIncompleta[];
}) {
  const profile = getPrimaryExecutionProfile(args.auditMode, args.analysisLevel, "chunk");
  const model = profile.model;
  let result;

  try {
    result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.fileName,
      model,
      providerOverride: profile.provider,
      operation: "audit-chunk",
      timeoutMs: getChunkTimeoutMs(),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: {
          effort: getReasoningEffort(args.analysisLevel, args.auditMode),
        },
        // O teto acompanha o TAMANHO deste bloco — ver `getMaxOutputTokens`.
        max_output_tokens: getMaxOutputTokens(args.chunk.text.length),
        text: { format: auditFindingsResponseFormat },
        input: getChunkPrompt(args),
      },
      metadata: {
        fileName: args.fileName,
        fileType: args.fileType,
        chunkId: args.chunk.id,
        startPage: args.chunk.startPage,
        endPage: args.chunk.endPage,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
  } catch (error) {
    /*
     * ERA A ÚNICA PASSADA SEM REDE. Identidade, global, coerência, comparação
     * entre documentos e refutação já degradavam; o bloco não, e um bloco
     * truncado levava a auditoria inteira junto — o engenheiro perdia os 60s de
     * trabalho já feito e recebia uma mensagem sobre modelo indisponível.
     *
     * Engolimos o que é DAQUELE bloco: envelope quebrado (truncado, recusado,
     * ilegível) e estouro de tempo. Credencial, quota e modelo inexistente
     * continuam subindo — ali insistir nos outros blocos só queima tempo para
     * falhar igual no fim.
     */
    const category = classifyProviderFailure(profile.provider, "audit", model, error).category;

    if (!isInvalidAuditModelResponse(error) && category !== "timeout") {
      throw error;
    }

    const reason = (error as { message?: string })?.message ?? String(error);
    console.error(
      `[audit] ${args.fileName}: bloco ${args.chunk.startPage}-${args.chunk.endPage} ignorado (${reason.slice(0, 160)})`,
    );
    args.degradacoes?.push({
      passada: `Bloco de páginas ${args.chunk.startPage}-${args.chunk.endPage}`,
      motivo: reason.slice(0, 160),
    });
    return [];
  }

  const text = result.text;
  const parsed = parseAuditModelJson(text);

  return (parsed?.findings ?? [])
    .map((finding, index) =>
      modelFindingToAuditFinding(finding, index + 1, args.fileName),
    )
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function getIdentityAuditPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
}) {
  return `
Faça uma leitura livre e contextual apenas da identidade documental deste arquivo. Não use termos pré-cadastrados. Extraia do próprio texto quais nomes de obra, códigos, endereços, municípios, proprietários, órgãos, disciplinas e finalidades aparecem.

Depois compare:
- qual identidade parece predominante;
- quais trechos citam outra obra, outra finalidade, outro endereço ou outro projeto;
- quais divergências são graves o suficiente para aparecer antes de normas, cálculos ou erros de formatação.

Use o inventário de candidatos abaixo como pistas extraídas automaticamente do PDF, não como regras fixas. Valores muito recorrentes em capa/cabeçalho/apresentação tendem a indicar a identidade predominante. Valores raros, mas incompatíveis com essa identidade, devem ser avaliados como possível reaproveitamento de outro projeto.

Não trate como conflito de identidade trechos técnicos genéricos que apenas estejam próximos do rodapé/cabeçalho com a identidade correta. Se o trecho cita a mesma obra predominante, mesmo em frase longa de escopo, infraestrutura, aterro, fiscalização, unidade atendida ou execução, classifique no máximo como ponto técnico em outra etapa, não como outra obra.

Se houver conflito de identidade, ele deve ser achado de prioridade Alta. Se houver apenas dúvida de grafia/endereço, use Media/Alta ou Media conforme impacto. Ignore problemas que não sejam de identidade nesta etapa. Não retorne duplicidade de sumário, norma, cálculo ou redação nesta etapa.

Projeto informado pelo usuário: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Modo: ${args.auditMode}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "Identidade documental",
      "referencia_comparada": "identidade predominante ou trecho comparado",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa"
    }
  ]
}

Se não houver conflito de identidade, retorne {"findings":[]}.

INVENTÁRIO DE CANDIDATOS DE IDENTIDADE:
${buildIdentityCandidateInventory(args.extracted)}

TRECHOS DE IDENTIFICAÇÃO EXTRAÍDOS DO DOCUMENTO:
${buildIdentityContext(args.extracted)}
`.trim();
}

async function analyzeIdentityWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
  conversationId?: string | null;
  userEmail?: string | null;
}) {
  const profile = getPrimaryExecutionProfile(args.auditMode, args.analysisLevel, "identity");
  const model = profile.model;
  let parsed;

  try {
    const result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.fileName,
      model,
      providerOverride: profile.provider,
      operation: "audit-identity",
      timeoutMs: getChunkTimeoutMs(),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: { effort: getReasoningEffort(args.analysisLevel, args.auditMode) },
        max_output_tokens: getMaxOutputTokens(),
        text: { format: auditFindingsResponseFormat },
        input: getIdentityAuditPrompt(args),
      },
      metadata: {
        fileName: args.fileName,
        fileType: args.fileType,
        pages: args.extracted.pageCount,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
    parsed = parseRequiredAuditModelJson(result.text, "audit-identity");
  } catch (error) {
    if (!isInvalidAuditModelResponse(error)) {
      throw error;
    }

    console.error(`[audit] ${args.fileName}: resposta invalida na leitura de identidade; etapa ignorada`);
    return [];
  }

  return (parsed?.findings ?? [])
    .map((finding, index) =>
      modelFindingToAuditFinding(finding, index + 1, args.fileName),
    )
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function buildGabaritoContext(gabarito?: AuditGabarito) {
  if (!gabarito) {
    return "";
  }

  const lines = [
    gabarito.obra ? `- Obra (capa): ${gabarito.obra}` : "",
    gabarito.prefeitura ? `- Prefeitura: ${gabarito.prefeitura}` : "",
    gabarito.municipio ? `- Município: ${gabarito.municipio}` : "",
    gabarito.centroCusto ? `- Centro de custo: ${gabarito.centroCusto}` : "",
    gabarito.endereco ? `- Endereço: ${gabarito.endereco}` : "",
  ].filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return `
GABARITO DECLARADO PELO USUÁRIO (verdade da obra, não evidência). A identidade já é conferida por regra determinística — use isto apenas como referência para julgar coerência técnica; NÃO reafirme identidade:
${lines.join("\n")}
`.trim();
}

/**
 * O texto que a leitura global recebe: documento inteiro na primeira auditoria,
 * delta + resumos na reauditoria. Ver [[audit-validation-prompt.ts]].
 */
function contextoDoDocumento(args: {
  analysisLevel: AnalysisLevel;
  extracted: ExtractedPdf;
  hashesHerdados?: ReadonlySet<string>;
  resumoPorHash?: ReadonlyMap<string, string>;
}) {
  if (!args.hashesHerdados || args.hashesHerdados.size === 0) {
    return buildDocumentContext(args.extracted, args.analysisLevel);
  }

  const capitulos = chunkPdfByChapter(args.extracted);
  const impressos = impressaoDosCapitulos(capitulos);

  return buildDocumentContextComReuso({
    capitulos: capitulos.map((c, i) => ({
      hash: impressos[i].hash,
      titulo: c.title,
      texto: c.text,
    })),
    hashesHerdados: args.hashesHerdados,
    resumoPorHash: args.resumoPorHash ?? new Map(),
    maxChars: getGlobalContextChars(args.analysisLevel),
  });
}

function getGlobalFilePrompt(args: {
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  learningContext: string;
  gabarito?: AuditGabarito;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
  /** Hashes dos capítulos inalterados desde o parecer anterior. */
  hashesHerdados?: ReadonlySet<string>;
  /** Resumo por hash, de `runtime.sintese` do parecer anterior. */
  resumoPorHash?: ReadonlyMap<string, string>;
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Faça uma leitura global do volume de projeto, como auditor documental sênior."
      : "Faça uma leitura global do memorial descritivo, como auditor documental sênior.";

  return `
${modeInstruction}

Esta etapa deve funcionar como uma análise livre do documento inteiro, não como checklist de termos. Use a identidade predominante do documento (obra, município, órgão, disciplina) como referência para julgar coerência. Procure incongruências internas, capítulos incoerentes, normas suspeitas, contas inconsistentes, escopo ambíguo, promessas não cumpridas e problemas editoriais.

A identidade documental também é auditada por regras determinísticas próprias, que comparam o documento contra o gabarito informado. Elas pegam o que casa com o gabarito; NÃO pegam texto pertencente a um TERCEIRO empreendimento que nunca foi declarado. Por isso: quando encontrar nome de obra, bloco, unidade ou elemento construtivo que não pertence a este empreendimento e não aparece na caracterização (ex.: um nome de prédio estranho, um bloco que não existe no programa, uma torre que ninguém descreveu), GERE O ACHADO. Se a camada determinística já tiver apontado o mesmo trecho, a deduplicação posterior resolve — perder o resíduo é muito pior que repeti-lo.

SUMÁRIO / ÍNDICE. Linhas de título seguidas de pontilhado e número de página (ex.: "12.6 Quadro geral ....... 122") são o índice. Não gere achado sobre grafia ou espaçamento que exista SÓ no índice. Mas CONFIRA O ÍNDICE CONTRA O CORPO: se os capítulos listados no sumário não forem os capítulos que o documento realmente tem, ou se as páginas indicadas não corresponderem, isso é achado crítico de documento não finalizado — reporte com os dois lados (o que o sumário diz x o que o corpo traz). Nunca reclame de "recorte", "página fornecida" ou "reprocessar": você recebeu o documento inteiro; audite o conteúdo real.

Em memoriais, confira explicitamente antes de responder:
- construcao nova x trechos de reforma/adequacao (escopo ambíguo);
- quantidade e nomenclatura de blocos, pavimentos, volumes e disciplinas;
- areas informadas em secoes diferentes, inclusive arquitetura, eletrica, cabeamento e CFTV;
- concessionaria, normas locais e siglas que exigem validação técnica.

Priorize pelo impacto:
- Alta: contradição técnica interna grave, cálculo/quantitativo incoerente ou norma incompatível que impede emissão.
- Media/Alta: divergência técnica/contratual que pode afetar emissão, contratação ou revisão formal.
- Media ou menor: redação, formatação, duplicidade e pontos de conferência editoriais.

Preencha "impacto" em TODO achado, pela consequência para quem vai emitir: "critico_documental" (impede emitir), "tecnico_contratual" (exige decisão de responsável técnico antes de executar) ou "revisao_editorial" (não muda decisão técnica). A prioridade mede urgência; o impacto decide em qual seção do relatório o achado aparece. Norma desatualizada, edição normativa divergente e premissa de enquadramento não demonstrada são "tecnico_contratual", não crítico.

Não invente evidência. Se o documento só permitir suspeita, marque confiança média ou baixa e explique o motivo — mas registre o achado.

PEQUE PELO EXCESSO: reporte todo defeito real que encontrar, inclusive acabamento, esquadria, ferragem, parágrafo duplicado e erro de redação, mesmo quando já houver achado grave no documento. Não omita achado por ser secundário; a classificação por impacto é que organiza a lista.

UMA OCORRÊNCIA, UM ACHADO — quando a correção é feita ocorrência por ocorrência. Grafia, concordância, pontuação, palavra trocada, parágrafo duplicado: cada uma se corrige num lugar diferente do texto, então cada uma é um achado com a SUA "pagina", o SEU trecho em "evidencia", o SEU "termo_busca" e a SUA "sugestao_correcao". NUNCA junte várias numa frase só ("pág. 8 ...; pág. 23 ...; pág. 35 ..."): quem revisa não consegue abrir, localizar no PDF nem marcar como resolvida uma ocorrência que está enterrada dentro de um texto corrido. Ocorrências parecidas do mesmo defeito voltam a aparecer juntas na tela — isso é trabalho do software, não seu.

CONSOLIDE apenas quando UMA decisão resolve todas as ocorrências de uma vez: regra de prevalência documental, norma adotada, convenção de unidade, nomenclatura de bloco. Aí sim um único achado, citando as páginas onde a decisão se aplica.

Em achado de texto, escreva "categoria": "Ortografia / Redação". É por esse nome que a tela separa revisão de texto de divergência técnica.

Teto de 60 achados, no máximo 30 deles com impacto "revisao_editorial". Havendo mais ocorrências de texto que isso, reporte as de menor número de página primeiro. NUNCA descarte achado técnico para caber ocorrência de texto.

Projeto informado pelo usuário: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Páginas extraídas: ${args.extracted.pageCount}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

${buildGabaritoContext(args.gabarito)}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "categoria do achado (use \"Ortografia / Redação\" nos de texto)",
      "referencia_comparada": "identidade predominante ou trecho comparado, quando existir",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa",
      "impacto": "critico_documental|tecnico_contratual|revisao_editorial"
    }
  ]
}

Se não encontrar erro relevante, retorne {"findings":[]}.

Além dos achados, devolva em "sintese" UMA LINHA por capítulo do documento.
Não descreva o assunto do capítulo — registre o que ele AFIRMA: sistema
estrutural, resistências, dimensões, quem executa o quê, normas declaradas. É
isso que uma revisão futura pode contradizer, e é para isso que a linha serve.
Use no campo "capitulo" o título do capítulo exatamente como aparece no
documento. Se o documento não tiver capítulos identificáveis, devolve
"sintese":[].

TEXTO DO DOCUMENTO:
${contextoDoDocumento(args)}
`.trim();
}

async function analyzeFileGloballyWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  learningContext: string;
  gabarito?: AuditGabarito;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
  conversationId?: string | null;
  userEmail?: string | null;
  /** Coletor de passadas incompletas (best-effort NÃO é silencioso). */
  degradacoes?: PassadaIncompleta[];
  hashesHerdados?: ReadonlySet<string>;
  resumoPorHash?: ReadonlyMap<string, string>;
  /**
   * Coletor da síntese por capítulo, no mesmo idioma do `degradacoes` acima: a
   * leitura global tem duas saídas e só uma delas é o valor de retorno. Fica
   * vazio quando a passada falha, que é best-effort — e vazio aqui significa
   * "não há mapa deste arquivo", nunca "o documento não tem capítulos".
   */
  sintese?: { capitulo: string; resumo: string }[];
}) {
  const profile = getPrimaryExecutionProfile(args.auditMode, args.analysisLevel, "global");
  const model = profile.model;
  let parsed;

  try {
    const result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.fileName,
      model,
      providerOverride: profile.provider,
      operation: "audit-global",
      // A leitura do documento INTEIRO com esforço alto é lenta; o timeout curto
      // dos blocos abortava a global no meio (aborto aos 120s no 017-26). No
      // Profundo damos folga maior.
      // Com mais espaço de saída a resposta também demora mais; o teto de 120s
      // dos blocos passa a ser apertado para uma passada que lê o documento.
      timeoutMs:
        args.analysisLevel === "deep" ? getDeepGlobalTimeoutMs() : getStandardGlobalTimeoutMs(),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: { effort: getReasoningEffort(args.analysisLevel, args.auditMode) },
        // Com o documento inteiro, a leitura global do Profundo devolve MUITOS
        // achados; o teto precisa ser alto, senão o JSON trunca e a etapa inteira
        // vira "resposta inválida" (0 achados). Provado no 017-26: 6000 truncou.
        max_output_tokens:
          args.analysisLevel === "deep"
            ? getDeepGlobalMaxOutputTokens()
            : getStandardGlobalMaxOutputTokens(),
        text: { format: auditGlobalResponseFormat },
        input: getGlobalFilePrompt(args),
      },
      metadata: {
        fileName: args.fileName,
        fileType: args.fileType,
        pages: args.extracted.pageCount,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
    parsed = parseRequiredAuditModelJson(result.text, "audit-global");
    for (const item of parsed?.sintese ?? []) {
      if (item?.capitulo && item?.resumo) {
        args.sintese?.push({ capitulo: String(item.capitulo), resumo: String(item.resumo) });
      }
    }
  } catch (error) {
    // A leitura global é best-effort: se falhar (timeout, aborto, resposta
    // inválida, erro de provider), a auditoria NÃO pode ser perdida — os achados
    // determinísticos (identidade, coerência) já valem sozinhos. Só registramos.
    const reason = (error as { message?: string })?.message ?? String(error);
    console.error(`[audit] ${args.fileName}: leitura global ignorada (${reason.slice(0, 160)})`);
    /*
     * Best-effort NÃO é silencioso. Sem este registro, uma auditoria em que a
     * leitura do documento inteiro abortou chega na tela com a mesma cara de uma
     * completa — e o veredito diz "pode emitir" apoiado numa análise que não
     * aconteceu. Medido: aborto aos 300s no 017-26.
     */
    args.degradacoes?.push({
      passada: "Leitura global do documento",
      motivo: reason.slice(0, 160),
    });
    return [];
  }

  return (parsed?.findings ?? [])
    .map((finding, index) =>
      modelFindingToAuditFinding(finding, index + 1, args.fileName),
    )
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function isCoherencePassEnabled() {
  return process.env.NEXODOC_ENABLE_COHERENCE_PASS !== "false";
}

function getCoherenceContextChars() {
  const value = Number(process.env.NEXODOC_COHERENCE_CONTEXT_CHARS);

  if (Number.isFinite(value) && value >= 80_000) {
    return Math.min(600_000, Math.floor(value));
  }

  return 400_000;
}

// Documento inteiro (sem amostragem cabeça/meio/cauda). Só recorta se exceder o
// teto — memoriais típicos cabem por completo, garantindo que capítulos distantes
// sejam vistos na mesma passada.
function buildWholeDocumentContext(extracted: ExtractedPdf) {
  const maxChars = getCoherenceContextChars();

  if (extracted.text.length <= maxChars) {
    return extracted.text;
  }

  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head;

  return [
    extracted.text.slice(0, head),
    "\n\n--- RECORTE FINAL DO DOCUMENTO ---\n\n",
    extracted.text.slice(-tail),
  ].join("");
}

function getCoherencePrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  extracted: ExtractedPdf;
}) {
  return `
Você é um auditor documental sênior. Leia o DOCUMENTO INTEIRO abaixo de uma vez e procure APENAS incoerências que exigem enxergar capítulos distantes ao mesmo tempo — o tipo de erro que passa despercebido numa leitura por blocos:

- Regras contratuais contraditórias entre capítulos (ex.: hierarquia/prevalência de documentos que muda de um capítulo para outro).
- Responsabilidades atribuídas a partes diferentes em trechos distintos (ex.: um serviço dado ora à Prefeitura, ora à contratada).
- Escopo incoerente (obra declarada como construção nova em um capítulo e como reforma/adequação em outro).
- Erros de unidade/tabela (ex.: valor com unidade impossível, como "15,0 m" onde deveria ser cm).
- Nome de obra/unidade, município ou endereço que muda entre capítulos.
- Normas, siglas ou referências municipais que parecem pertencer a outro projeto.

Regras rígidas:
- Só relate o que puder sustentar com um trecho EXATO copiado do texto (campos evidencia e termo_busca). NÃO invente. Sem trecho exato, não relate.
- Cada achado deve citar as páginas/capítulos envolvidos.
- Ignore erros puramente editoriais de uma palavra (grafia isolada); foque em incoerências de conteúdo entre capítulos.

Modo: ${args.auditMode}
Projeto informado: ${args.projectName || "não informado"}
Solicitação do usuário: ${args.userMessage}

Responda APENAS JSON válido no formato {"findings":[{ "prioridade": "...", "pagina": "...", "capitulo": "...", "local": "...", "tipo": "...", "descricao": "...", "evidencia": "...", "termo_busca": "...", "categoria": "...", "referencia_comparada": "...", "conflito": "...", "sugestao_correcao": "...", "confianca": "..." }]}. Se nada, {"findings":[]}.

TEXTO DO DOCUMENTO:
${buildWholeDocumentContext(args.extracted)}
`.trim();
}

async function analyzeDocumentCoherenceWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
  conversationId?: string | null;
  userEmail?: string | null;
}) {
  const profile = getPrimaryExecutionProfile(args.auditMode, args.analysisLevel, "global");
  const model = profile.model;
  let parsed;

  try {
    const result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.fileName,
      model,
      providerOverride: profile.provider,
      operation: "audit-coherence",
      timeoutMs: getChunkTimeoutMs(),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: { effort: getReasoningEffort(args.analysisLevel, args.auditMode) },
        max_output_tokens: getCoherenceMaxOutputTokens(),
        text: { format: auditFindingsResponseFormat },
        input: getCoherencePrompt(args),
      },
      metadata: {
        fileName: args.fileName,
        fileType: args.fileType,
        pages: args.extracted.pageCount,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
    parsed = parseRequiredAuditModelJson(result.text, "audit-coherence");
  } catch (error) {
    if (!isInvalidAuditModelResponse(error)) {
      throw error;
    }

    console.error(`[audit] ${args.fileName}: resposta invalida na passada de coerência; etapa ignorada`);
    return [];
  }

  return (parsed?.findings ?? [])
    .map((finding, index) => modelFindingToAuditFinding(finding, index + 1, args.fileName))
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function getCrossDocumentPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
}) {
  let remainingCharacters = 120_000;
  const sources = args.files.map((file) => {
    const text = file.extracted.text.slice(0, Math.min(remainingCharacters, 45_000));
    remainingCharacters -= text.length;

    return [
      `ARQUIVO: ${file.file.name}`,
      `TIPO: ${file.fileType}`,
      `TEXTO EXTRAÍDO:`,
      text,
    ].join("\n");
  });

  return `
Compare os documentos do mesmo conjunto de auditoria. Esta etapa não é uma leitura isolada: confronte explicitamente os valores repetidos nos arquivos.

Modo: ${args.auditMode}
Projeto informado: ${args.projectName || "não informado"}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Verifique, quando os documentos fornecerem evidência suficiente:
- memorial x capa: obra, código, endereço, bairro, município, órgão e volume;
- LD/lista x pranchas: número da prancha, título e revisão;
- capa/separatriz x selos: disciplina, volume, tomo, projeto e revisão;
- indícios de arquivo pertencente a outro projeto.

Não produza achado se um valor não estiver visível nos dois lados da comparação.
Responda APENAS JSON válido:
{
  "comparisons": ["comparação realmente executada e seu resultado"],
  "findings": [
    {
      "arquivo": "documento em que a divergência foi localizada",
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "Comparação entre documentos",
      "categoria": "LD x prancha|capa x selo|memorial x capa|estrutura do volume",
      "referencia_comparada": "outro documento e valor comparado",
      "local": "campo ou local visível",
      "tipo": "tipo da divergência",
      "descricao": "descrição objetiva",
      "evidencia": "texto localizado no documento",
      "termo_busca": "termo exato para localizar",
      "conflito": "valor A x valor B",
      "sugestao_correcao": "ação objetiva",
      "confianca": "alta|media|baixa"
    }
  ]
}

DOCUMENTOS:
${sources.join("\n\n---\n\n")}
`.trim();
}

function normalizeImpactDecision(value: string | undefined) {
  if (
    value === "critico_documental" ||
    value === "tecnico_contratual" ||
    value === "revisao_editorial"
  ) {
    return value;
  }

  return undefined;
}

function isMandatoryGuardFinding(finding: AuditFinding) {
  return finding.id.startsWith("GUARDA-");
}

async function validateFindingsWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  auditEngine: AuditEngine;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
  findings: AuditFinding[];
  conversationId?: string | null;
  userEmail?: string | null;
}) {
  if (
    args.findings.length === 0 ||
    (args.auditEngine !== "dual" && process.env.NEXODOC_DISABLE_FINDING_VALIDATION === "true")
  ) {
    return args.findings;
  }

  const profile = getValidationExecutionProfile(args.auditMode, args.analysisLevel);

  try {
    const model = profile.model;
    const result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.projectName || "Auditoria",
      model,
      providerOverride: profile.provider,
      operation: "audit-validation",
      timeoutMs: getValidationTimeoutMs(args.analysisLevel),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: { effort: getReasoningEffort(args.analysisLevel, args.auditMode) },
        // Uma decisão por achado; com o doc inteiro a lista cresce (26 no 017-26)
        // e o teto fixo de 2600 truncava o JSON → validação inteira descartada.
        // Escala com o nº de achados.
        max_output_tokens: Math.min(16000, Math.max(2600, args.findings.length * 260)),
        text: { format: auditValidationResponseFormat },
        input: getFindingValidationPrompt(args),
      },
      metadata: {
        findings: args.findings.length,
        files: args.files.length,
        auditEngine: args.auditEngine,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
    const parsed = parseRequiredAuditModelJson(result.text, "audit-validation");
    const decisions = new Map(
      (parsed?.decisions ?? [])
        .filter((decision) => decision.source_id && decision.acao)
        .map((decision) => [String(decision.source_id), decision]),
    );

    if (decisions.size === 0) {
      return args.findings;
    }

    return args.findings
      .map((finding) => {
        const decision = decisions.get(finding.id);

        if (!decision) {
          return finding;
        }

        if (decision.acao === "remover") {
          // Fase C — a Camada 1 determinística é dona da identidade e da coerência.
          // A validação por IA pode reclassificar prioridade, mas nunca apagar um
          // achado de regra (guardas, identidade intra-documento, coerência): eles
          // não alucinam e citam página/evidência.
          if (isMandatoryGuardFinding(finding) || finding.origem === "regra") {
            return finding;
          }

          // Item 4 — recall: a validação NÃO deleta mais achado de IA incerto.
          // Rebaixa pra "Sugestão" (confiança baixa, camada recolhível) em vez de
          // sumir com ele. Alucinação e meta-lixo já foram cortados antes (ancoragem
          // + supressão). Aqui a gente prefere mostrar-e-marcar a perder recall.
          return {
            ...finding,
            tier: "sugestao" as const,
            confianca: "baixa" as const,
            impacto: "revisao_editorial" as const,
            prioridade: normalizePriority(decision.prioridade ?? "Baixa"),
            tipo: String(decision.tipo ?? finding.tipo).trim() || finding.tipo,
            descricao: String(decision.descricao ?? finding.descricao).trim() || finding.descricao,
            conflito: String(decision.conflito ?? finding.conflito).trim() || finding.conflito,
            sugestao_correcao:
              String(decision.sugestao_correcao ?? finding.sugestao_correcao).trim() ||
              finding.sugestao_correcao,
          };
        }

        return {
          ...finding,
          prioridade: normalizePriority(decision.prioridade ?? finding.prioridade),
          impacto: normalizeImpactDecision(decision.impacto) ?? finding.impacto,
          tipo: String(decision.tipo ?? finding.tipo).trim() || finding.tipo,
          descricao: String(decision.descricao ?? finding.descricao).trim() || finding.descricao,
          conflito: String(decision.conflito ?? finding.conflito).trim() || finding.conflito,
          sugestao_correcao:
            String(decision.sugestao_correcao ?? finding.sugestao_correcao).trim() ||
            finding.sugestao_correcao,
          confianca: normalizeConfidence(decision.confianca ?? finding.confianca),
        };
      })
      .filter((finding): finding is AuditFinding => Boolean(finding));
  } catch (error) {
    const failure = classifyProviderFailure(
      profile.provider,
      "audit",
      profile.model,
      error,
    );
    if (failure.category !== "unknown") {
      recordProviderFailure(failure);
    }
    console.error(`[audit] validacao semantica falhou; mantendo candidatos (${failure.category})`);
    return args.findings;
  }
}

async function analyzeCrossDocumentsWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
  conversationId?: string | null;
  userEmail?: string | null;
}) {
  if (args.files.length < 2) {
    return { findings: [] as AuditFinding[], comparisons: [] as string[] };
  }

  const profile = getPrimaryExecutionProfile(args.auditMode, args.analysisLevel, "crossDocument");
  const model = profile.model;
  let parsed;

  try {
    const result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.projectName || "Auditoria",
      model,
      providerOverride: profile.provider,
      operation: "audit-cross-document",
      timeoutMs: getChunkTimeoutMs(),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: { effort: getReasoningEffort(args.analysisLevel, args.auditMode) },
        max_output_tokens: getMaxOutputTokens(),
        text: { format: auditCrossDocumentResponseFormat },
        input: getCrossDocumentPrompt(args),
      },
      metadata: {
        files: args.files.length,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
    parsed = parseRequiredAuditModelJson(result.text, "audit-cross-document");
  } catch (error) {
    if (!isInvalidAuditModelResponse(error)) {
      throw error;
    }

    console.error("[audit] resposta invalida na comparacao entre documentos; etapa ignorada");
    return { findings: [] as AuditFinding[], comparisons: [] as string[] };
  }

  return {
    findings: (parsed?.findings ?? [])
      .map((finding, index) =>
        modelFindingToAuditFinding(finding, index + 1, finding.arquivo),
      )
      .filter((finding): finding is AuditFinding => Boolean(finding)),
    comparisons: (parsed?.comparisons ?? []).filter(
      (comparison): comparison is string => typeof comparison === "string" && Boolean(comparison.trim()),
    ),
  };
}

function getRefutationPrompt(args: {
  fileName: string;
  extracted: ExtractedPdf;
  findings: AuditFinding[];
}) {
  return `
Você é um revisor cético. Sua ÚNICA tarefa é tentar DERRUBAR cada achado abaixo, não confirmá-lo. Para cada achado, decida se a evidência citada realmente sustenta o conflito descrito, lendo o contexto do documento.

Marque "sustentado": false quando:
- a evidência não comprova o conflito (o achado interpretou mal o trecho);
- o "conflito" some ao ler a frase inteira em contexto (ex.: menção histórica, exemplo, citação de norma);
- o trecho é genérico/boilerplate e não indica erro real;
- na dúvida real sobre se é erro, prefira derrubar (false).

Marque "sustentado": true apenas quando o erro resiste a uma leitura crítica.

Responda APENAS JSON válido:
{
  "verdicts": [
    { "source_id": "ID do achado", "sustentado": true, "motivo": "por que resiste ou cai" }
  ]
}

ACHADOS A REFUTAR:
${buildFindingCandidateList(args.findings)}

CONTEXTO DO DOCUMENTO (${args.fileName}):
${buildDocumentContext(args.extracted)}
`.trim();
}

async function refuteFindingsWithModel(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
  findings: AuditFinding[];
  conversationId?: string | null;
  userEmail?: string | null;
}) {
  // só faz sentido refutar achados de IA; regra nunca é refutada
  const aiFindings = args.findings.filter((finding) => finding.origem === "ia");

  if (aiFindings.length === 0) {
    return args.findings;
  }

  const profile = getValidationExecutionProfile(args.auditMode, args.analysisLevel);

  try {
    const model = profile.model;
    const result = await executeAuditModelResponse({
      taskId: args.auditId,
      taskLabel: args.fileName,
      model,
      providerOverride: profile.provider,
      operation: "audit-refutation",
      timeoutMs: getChunkTimeoutMs(),
      request: {
        model,
        instructions: getAuditorPrompt(args.auditMode),
        reasoning: { effort: getReasoningEffort(args.analysisLevel, args.auditMode) },
        max_output_tokens: Math.max(getMaxOutputTokens(), 2600),
        text: { format: auditRefutationResponseFormat },
        input: getRefutationPrompt({
          fileName: args.fileName,
          extracted: args.extracted,
          findings: aiFindings,
        }),
      },
      metadata: {
        fileName: args.fileName,
        fileType: args.fileType,
        findings: aiFindings.length,
        analysisLevel: args.analysisLevel,
        auditMode: args.auditMode,
      },
      conversationId: args.conversationId,
      userEmail: args.userEmail,
    });
    const parsed = parseRequiredAuditModelJson(result.text, "audit-refutation");
    const refuted = new Set(
      (parsed?.verdicts ?? [])
        .filter((verdict) => verdict.source_id && verdict.sustentado === false)
        .map((verdict) => String(verdict.source_id)),
    );

    if (refuted.size === 0) {
      return args.findings;
    }

    const kept = args.findings.filter(
      (finding) => finding.origem !== "ia" || !refuted.has(finding.id),
    );
    console.log(
      `[audit] ${args.fileName}: refutação adversarial derrubou ${args.findings.length - kept.length} achado(s) de IA`,
    );
    return kept;
  } catch (error) {
    if (!isInvalidAuditModelResponse(error)) {
      throw error;
    }

    console.error(`[audit] ${args.fileName}: resposta inválida na refutação; etapa ignorada`);
    return args.findings;
  }
}

/**
 * Uma passada da análise que não completou. A auditoria segue (as regras
 * determinísticas valem sozinhas), mas o RESULTADO precisa dizer — senão o
 * veredito afirma sobre uma leitura que não aconteceu.
 */
export interface PassadaIncompleta {
  passada: string;
  motivo: string;
}

async function deepAnalyzeFile(args: {
  auditId?: string | null;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  userMessage: string;
  projectName: string;
  learningContext: string;
  auditTitle: string;
  gabarito?: AuditGabarito;
  file: UploadedAuditFile;
  conversationId?: string | null;
  userEmail?: string | null;
  /** Coletor: cada passada que abortar se registra aqui. */
  degradacoes: PassadaIncompleta[];
  /** Coletor: o mapa por capítulo que a leitura global deixa, por arquivo. */
  sinteses?: Map<string, { capitulo: string; resumo: string }[]>;
  /** Relata o progresso real, quando alguém está ouvindo. */
  onMarco?: EmitirMarco;
  /**
   * Só estes capítulos vão ao modelo. `undefined` = auditoria completa, que é o
   * caso da primeira vez e de toda base inelegível.
   */
  capitulosParaLer?: readonly { hash: string }[];
  /** Hashes dos capítulos inalterados — a global os lê resumidos. */
  hashesHerdados?: ReadonlySet<string>;
  /** Resumo por hash, de `runtime.sintese` do parecer anterior. */
  resumoPorHash?: ReadonlyMap<string, string>;
}) {
  const startedAt = Date.now();
  const marco = (m: MarcoDaAuditoria) => args.onMarco?.(m);
  marco({ passada: "regras", estado: "inicio" });
  const mandatoryGuardFindings = deriveMandatoryIdentityGuardFindings(
    args.file.extracted,
    args.file.file.name,
  );
  // Camada 1 (intra-documento) — sempre ativa, sem IA. Pega texto reaproveitado
  // de outro projeto: nome de obra/unidade divergente da obra dominante do arquivo.
  const withinDocumentIdentityFindings = runWithinDocumentIdentityRules(
    {
      fileName: args.file.file.name,
      fileType: args.file.fileType,
      extracted: args.file.extracted,
    },
    { gabaritoObra: args.gabarito?.obra },
  );
  if (withinDocumentIdentityFindings.length > 0) {
    console.log(
      `[audit] ${args.file.file.name}: ${withinDocumentIdentityFindings.length} identidade(s) divergente(s) no mesmo documento (regra determinística)`,
    );
  }
  // Camada 1 (coerência) — sempre ativa, sem IA. Contradições e reúso de texto
  // que atravessam capítulos distantes (hierarquia, escopo, linguagem rodoviária).
  const coherenceFindings = runDocumentCoherenceRules({
    fileName: args.file.file.name,
    fileType: args.file.fileType,
    extracted: args.file.extracted,
  });
  if (coherenceFindings.length > 0) {
    console.log(
      `[audit] ${args.file.file.name}: ${coherenceFindings.length} achado(s) de coerência documental (regra determinística)`,
    );
  }
  const useRuleBasedFindings = isRuleBasedAuditEnabled();
  const inferredIdentityFindings = useRuleBasedFindings
    ? deriveIdentityFindingsFromText(
        args.file.extracted,
        args.file.file.name,
      )
    : [];
  const ruleBasedReviewFindings = useRuleBasedFindings
    ? deriveRuleBasedReviewFindings(
        args.file.extracted,
        args.file.file.name,
      )
    : [];
  const hasInferredIdentityConflict = inferredIdentityFindings.length > 0;
  /*
   * Item 5 — no Profundo a leitura global já lê o DOCUMENTO INTEIRO (A1), então a
   * passada por blocos virava redundante e só reintroduzia o lixo de sumário.
   * Cortamos os blocos no Profundo; o Padrão (leitura global amostrada) ainda usa
   * blocos para cobrir o começo do documento.
   *
   * Na COBERTURA TOTAL essa conta muda: os blocos voltam para o Profundo e sem
   * teto, porque ler tudo de uma vez ≠ examinar capítulo a capítulo. O "lixo de
   * sumário" que motivou o corte é hoje tratado a montante — `isLowValueModelFinding`
   * suprime o meta-achado que reclama de auditar a partir do sumário, com teste
   * próprio —, então o motivo original do corte já não se sustenta sozinho.
   */
  const coberturaTotal = isCoberturaTotalEnabled();
  const chunkLimit =
    args.analysisLevel === "deep" && !coberturaTotal
      ? 0
      : hasInferredIdentityConflict && !coberturaTotal
        ? Math.min(4, getMaxChunksPerFile(args.analysisLevel))
        : getMaxChunksPerFile(args.analysisLevel);
  /*
   * O corte por capítulo é a VERDADE do documento e não muda — é ele que a
   * impressão digital hasheia lá no relatório, e é dela que vive o reuso entre
   * revisões. Na cobertura total, o que muda é só como esse corte é EMPACOTADO
   * para ir ao modelo: capítulos vizinhos viajam juntos até encher 28k, o que
   * derruba o custo em 3,3× sem tirar um caractere da leitura.
   */
  const capitulos = chunkPdfByChapter(args.file.extracted);
  const blocosDisponiveis = coberturaTotal
    ? agruparBlocosParaLeitura(capitulos, CHUNK_GROUP_CHARS)
    : capitulos;
  /*
   * O REUSO CORTA AQUI, e não no `chunkLimit`: o teto é orçamento, o plano é
   * conhecimento. Confundir os dois faria a economia parecer degradação.
   *
   * A unidade que vai ao modelo é o BLOCO, e um bloco pode agrupar vários
   * capítulos. Basta UM capítulo do bloco ter mudado para ele ser relido
   * inteiro: mandar meio bloco seria mandar texto sem o contexto que o cerca, e
   * o capítulo vizinho é justamente o contexto mais próximo que existe.
   */
  const hashesParaLer = args.capitulosParaLer
    ? new Set(args.capitulosParaLer.map((c) => c.hash))
    : null;
  const blocosDoPlano = hashesParaLer
    ? blocosDisponiveis.filter((bloco) =>
        capitulos.some(
          (cap, i) =>
            cap.startPage >= bloco.startPage &&
            cap.endPage <= bloco.endPage &&
            hashesParaLer.has(impressaoDosCapitulos([capitulos[i]])[0].hash),
        ),
      )
    : blocosDisponiveis;
  const chunks = blocosDoPlano.slice(0, chunkLimit);

  /*
   * TETO QUE CORTA COBERTURA NÃO PODE SER SILENCIOSO.
   *
   * `NEXODOC_MAX_CHUNKS_PER_FILE` é um botão de vazão da época em que o limite
   * era 8/24 por desenho — e ele continua VENCENDO na cobertura total. Num
   * memorial grande o bastante ele deixaria o fim do documento sem bloco, e a
   * auditoria terminaria "com sucesso" prometendo cobertura completa sobre um
   * documento lido pela metade. É o mesmo defeito que produziu as auditorias
   * parciais silenciosas entre jun e ago/2026, e a lição de lá é esta: quando a
   * leitura encolhe, quem lê o parecer precisa saber, e o veredito precisa
   * rebaixar sozinho.
   */
  if (coberturaTotal && chunks.length < blocosDisponiveis.length) {
    const motivo =
      `teto NEXODOC_MAX_CHUNKS_PER_FILE=${chunkLimit} cortou a leitura em ` +
      `${chunks.length} de ${blocosDisponiveis.length} blocos ` +
      `(${capitulos.length} capítulos): o fim do documento não foi lido por bloco.`;
    console.warn(`[audit] ${args.file.file.name}: ${motivo}`);
    args.degradacoes.push({ passada: "blocos", motivo });
  }
  const concurrency = getChunkConcurrency();

  console.log(
    `[audit] ${args.file.file.name}: ${args.file.extracted.pageCount} paginas, ${args.file.extracted.charCount} caracteres, leitura de identidade, leitura global e ${chunks.length} blocos, concorrencia ${concurrency}, regras locais ${useRuleBasedFindings ? "ativas" : "desligadas"}`,
  );

  /*
   * As regras determinísticas já rodaram todas até aqui — guardas de capa,
   * identidade intra-documento, coerência entre capítulos e as regras locais.
   * São instantâneas e sem IA, e é honesto fechar a passada com a contagem: o
   * número já existe, não é previsão.
   */
  marco({
    passada: "regras",
    estado: "fim",
    detalhe: `${
      mandatoryGuardFindings.length +
      withinDocumentIdentityFindings.length +
      coherenceFindings.length +
      inferredIdentityFindings.length +
      ruleBasedReviewFindings.length
    } achado(s) por regra`,
  });

  // Fase C — a identidade é da Camada 1 (guardas + regras determinísticas acima).
  // A passada de IA de identidade só roda sob flag explícito (benchmark).
  const shouldRunAiIdentityPass =
    isAiIdentityPassEnabled() && !hasInferredIdentityConflict;
  const identityStartedAt = Date.now();
  const identityFindings = shouldRunAiIdentityPass
    ? await analyzeIdentityWithModel({
        auditId: args.auditId,
        auditMode: args.auditMode,
        analysisLevel: args.analysisLevel,
        userMessage: args.userMessage,
        projectName: args.projectName,
        learningContext: args.learningContext,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        extracted: args.file.extracted,
        conversationId: args.conversationId,
        userEmail: args.userEmail,
      })
    : [];
  console.log(
    `[audit] ${args.file.file.name}: leitura de identidade por IA ${
      shouldRunAiIdentityPass ? "concluida" : "desligada (Camada 1 determinística é dona da identidade)"
    } em ${Math.round((Date.now() - identityStartedAt) / 1000)}s com ${identityFindings.length} achado(s)`,
  );

  const globalStartedAt = Date.now();
  const shouldRunGlobalPass =
    !hasInferredIdentityConflict || process.env.NEXODOC_ALWAYS_RUN_GLOBAL_AI === "true";
  if (shouldRunGlobalPass) {
    /*
     * A etapa longa. No Profundo é o documento INTEIRO numa ida só ao modelo;
     * no Padrão, trechos amostrados. Não há sinal interno para relatar — é
     * chamada atômica — então o que se manda é o tamanho real do que vai ser
     * lido e o TETO de tempo. É o orçamento que deixa a interface dizer
     * "passou do previsto" sem inventar uma barra de progresso.
     */
    marco({
      passada: "global",
      estado: "inicio",
      detalhe:
        args.analysisLevel === "deep"
          ? `documento inteiro — ${args.file.extracted.charCount.toLocaleString("pt-BR")} caracteres`
          : "trechos amostrados do documento",
      orcamentoMs: args.analysisLevel === "deep" ? getDeepGlobalTimeoutMs() : undefined,
    });
  }
  const sinteseDesteArquivo: { capitulo: string; resumo: string }[] = [];
  const globalFindings = shouldRunGlobalPass
    ? await analyzeFileGloballyWithModel({
        auditId: args.auditId,
        auditMode: args.auditMode,
        analysisLevel: args.analysisLevel,
        userMessage: args.userMessage,
        projectName: args.projectName,
        learningContext: args.learningContext,
        gabarito: args.gabarito,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        extracted: args.file.extracted,
        conversationId: args.conversationId,
        userEmail: args.userEmail,
        degradacoes: args.degradacoes,
        sintese: sinteseDesteArquivo,
        hashesHerdados: args.hashesHerdados,
        resumoPorHash: args.resumoPorHash,
      })
    : [];
  args.sinteses?.set(args.file.file.name, sinteseDesteArquivo);
  console.log(
    `[audit] ${args.file.file.name}: leitura global ${shouldRunGlobalPass ? "concluida" : "pulada"} em ${Math.round((Date.now() - globalStartedAt) / 1000)}s com ${globalFindings.length} achado(s)`,
  );
  if (shouldRunGlobalPass) {
    marco({
      passada: "global",
      estado: "fim",
      detalhe: `${globalFindings.length} achado(s)`,
    });
  }

  // Passada de coerência — só faz sentido quando o documento é MAIOR que a janela
  // da leitura global (senão a global já leu tudo e a coerência seria redundante,
  // dobrando o custo da chamada grande). Com a A1, o Profundo lê o doc inteiro,
  // então isto vira fallback só para documentos gigantes acima da janela.
  const shouldRunCoherencePass =
    isCoherencePassEnabled() &&
    args.analysisLevel === "deep" &&
    args.file.extracted.text.length > getGlobalContextChars(args.analysisLevel);
  const coherenceModelFindings = shouldRunCoherencePass
    ? await analyzeDocumentCoherenceWithModel({
        auditId: args.auditId,
        auditMode: args.auditMode,
        analysisLevel: args.analysisLevel,
        userMessage: args.userMessage,
        projectName: args.projectName,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        extracted: args.file.extracted,
        conversationId: args.conversationId,
        userEmail: args.userEmail,
      })
    : [];
  if (shouldRunCoherencePass) {
    console.log(
      `[audit] ${args.file.file.name}: passada de coerência (documento inteiro) com ${coherenceModelFindings.length} achado(s)`,
    );
  }

  // Blocos só existem no Padrão — no Profundo `chunkLimit` é 0 e a leitura
  // global já cobriu o documento inteiro. Anunciar a passada aqui seria
  // descrever trabalho que não vai acontecer.
  if (chunks.length > 0) {
    marco({ passada: "blocos", estado: "inicio", indice: 0, total: chunks.length });
  }
  let blocosFeitos = 0;
  const modelFindingGroups = await mapWithConcurrency(
    chunks,
    concurrency,
    async (chunk, index) => {
      const chunkStartedAt = Date.now();
      console.log(
        `[audit] ${args.file.file.name}: bloco ${index + 1}/${chunks.length} (${chunk.startPage}-${chunk.endPage}) iniciado`,
      );
      const findings = await analyzeChunkWithModel({
        auditId: args.auditId,
        auditMode: args.auditMode,
        analysisLevel: args.analysisLevel,
        userMessage: args.userMessage,
        projectName: args.projectName,
        learningContext: args.learningContext,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        chunk,
        conversationId: args.conversationId,
        userEmail: args.userEmail,
        degradacoes: args.degradacoes,
      });
      console.log(
        `[audit] ${args.file.file.name}: bloco ${index + 1}/${chunks.length} concluido em ${Math.round((Date.now() - chunkStartedAt) / 1000)}s com ${findings.length} achado(s)`,
      );
      // Contagem por CONCLUSÃO, não por índice: os blocos rodam em paralelo, e
      // "bloco 7 de 8" com o 3 ainda aberto mentiria sobre o que falta.
      blocosFeitos++;
      marco({
        passada: "blocos",
        estado: "inicio",
        indice: blocosFeitos,
        total: chunks.length,
      });
      return findings;
    },
  );
  const modelFindings = modelFindingGroups.flat();

  console.log(
    `[audit] ${args.file.file.name}: analise concluida em ${Math.round((Date.now() - startedAt) / 1000)}s com ${mandatoryGuardFindings.length + withinDocumentIdentityFindings.length + coherenceFindings.length + inferredIdentityFindings.length + ruleBasedReviewFindings.length + identityFindings.length + globalFindings.length + coherenceModelFindings.length + modelFindings.length} achado(s) antes de deduplicar`,
  );

  if (chunks.length > 0) {
    marco({
      passada: "blocos",
      estado: "fim",
      detalhe: `${modelFindings.length} achado(s)`,
      indice: chunks.length,
      total: chunks.length,
    });
  }

  // Fase B — trava anti-alucinação: achados de IA (identidade/global/blocos)
  // só sobrevivem se o trecho citado existir de fato no texto extraído.
  marco({ passada: "evidencia", estado: "inicio" });
  const aiFindings = [...identityFindings, ...globalFindings, ...coherenceModelFindings, ...modelFindings];
  const evidenceGate = filterGroundedFindings(aiFindings, args.file.extracted);
  if (evidenceGate.dropped.length > 0) {
    console.log(
      `[audit] ${args.file.file.name}: ${evidenceGate.dropped.length} achado(s) de IA descartado(s) por falta de evidência no texto (anti-alucinação)`,
    );
  }
  /*
   * A TAXA DE SUGESTAO FRACA vai para o log e para o marco, ao lado do descarte
   * por alucinacao. Ela nao muda o resultado — e instrumento: sem numero, mexer
   * no prompt do auditor e palpite caro, porque cada rodada custa tokens e nao
   * produz evidencia de melhora.
   */
  if (evidenceGate.sugestoesFracas > 0) {
    const total = evidenceGate.kept.filter((f) => f.origem !== "regra").length;
    console.log(
      `[audit] ${args.file.file.name}: ${evidenceGate.sugestoesFracas}/${total} achado(s) de IA com sugestao que nao instrui ("conferir" sem alvo)`,
    );
  }
  marco({
    passada: "evidencia",
    estado: "fim",
    detalhe:
      `${evidenceGate.dropped.length} descartado(s) por falta de evidência` +
      ` · ${evidenceGate.sugestoesFracas} sugestão(ões) sem alvo`,
  });
  if (evidenceGate.suppressed.length > 0) {
    console.log(
      `[audit] ${args.file.file.name}: ${evidenceGate.suppressed.length} achado(s) de IA suprimido(s) por ruído (meta-achado ou artefato de extração)`,
    );
  }

  // Item 3 — passada de refutação adversarial (só nível deep, atrás de flag).
  // Tenta derrubar cada achado de IA que passou pela ancoragem; regra é intocada.
  const refutedGate =
    isRefutationPassEnabled() && args.analysisLevel === "deep"
      ? await refuteFindingsWithModel({
          auditId: args.auditId,
          auditMode: args.auditMode,
          analysisLevel: args.analysisLevel,
          fileName: args.file.file.name,
          fileType: args.file.fileType,
          extracted: args.file.extracted,
          findings: evidenceGate.kept,
          conversationId: args.conversationId,
          userEmail: args.userEmail,
        })
      : evidenceGate.kept;

  return dedupeFindings([
    ...mandatoryGuardFindings,
    ...withinDocumentIdentityFindings,
    ...coherenceFindings,
    ...inferredIdentityFindings,
    ...ruleBasedReviewFindings,
    ...refutedGate,
  ]);
}

/**
 * A auditoria em si. O `onMarco` é opcional — sem ele nada muda para quem chama.
 *
 * Separada do `POST` para que a mesma execução sirva às duas formas de resposta:
 * o JSON único de sempre e o fluxo de eventos. Duplicar o motor para ter
 * progresso seria criar duas auditorias que precisariam concordar uma com a
 * outra para sempre.
 */
async function executarAuditoria(
  request: Request,
  formData: FormData,
  onMarco?: EmitirMarco,
) {
  const requestStartedAt = Date.now();
  let persistedAuditId: string | null = null;
  let requestedAuditMode: AuditMode = "memorial";
  let requestedAnalysisLevel: AnalysisLevel = "standard";
  const marco = (m: MarcoDaAuditoria) => onMarco?.(m);

  try {
    await refreshAiModelOverrideCache();
    console.log("[audit] requisicao recebida");
    /*
     * O PORTÃO ANTES DE TUDO.
     *
     * A autenticação só era exigida dentro do `if (projectId)` mais abaixo — e
     * o Nexo, que virou o único caminho, não manda projeto. Na prática, a rota
     * que mais gasta modelo do produto rodava sem exigir sessão, e gravava
     * parecer sem dono e sem escritório. É o chão onde nenhum achado atribuível
     * poderia nascer.
     *
     * O `catch` é próprio, e fica aqui em vez de cair no `catch` geral do fim:
     * aquele classifica falha de PROVEDOR e grava auditoria fracassada. Recusa
     * de acesso não é auditoria que falhou — não deve virar 500 nem deixar
     * rastro de uma execução que nunca começou.
     */
    let actor: Actor;
    try {
      actor = await requireActor();
    } catch (err) {
      const negado = accessDeniedResponse(err);
      if (negado) return withCors(negado, request);
      throw err;
    }

    const session = await auth();
    const sessionEmail = actor.email;
    const message = String(formData.get("message") ?? "").trim();
    const auditMode = parseAuditMode(formData.get("auditMode"));
    const analysisLevel = parseAnalysisLevel(formData.get("analysisLevel"));
    const auditEngine = parseAuditEngine(formData.get("auditEngine"));
    requestedAuditMode = auditMode;
    requestedAnalysisLevel = analysisLevel;
    const projectName = String(formData.get("projectName") ?? "").trim();
    const auditTitle = String(formData.get("auditTitle") ?? "").trim();
    const auditDescription = String(formData.get("auditDescription") ?? "").trim();
    const gabarito: AuditGabarito = {
      obra: String(formData.get("gabaritoObra") ?? "").trim() || undefined,
      prefeitura: String(formData.get("gabaritoPrefeitura") ?? "").trim() || undefined,
      municipio: String(formData.get("gabaritoMunicipio") ?? "").trim() || undefined,
      centroCusto: String(formData.get("gabaritoCentroCusto") ?? "").trim() || undefined,
      endereco: String(formData.get("gabaritoEndereco") ?? "").trim() || undefined,
    };
    const projectId = String(formData.get("projectId") ?? "").trim() || null;

    /*
     * SEM PROJETO NÃO AUDITA.
     *
     * O caminho anônimo existia porque o Nexo — que virou o único caminho — não
     * mandava `projectId`, e era ele que produzia parecer sem dono, sem
     * escritório e sem endereço. É o chão onde nenhum achado atribuível pode
     * nascer: a fila do Victor, o gate de emissão e a linhagem entre versões
     * são todos POR PROJETO.
     *
     * A auditoria antiga, gravada sem projeto, continua legível — isso é do
     * portão de LEITURA (`app/api/audits/[id]`), e não daqui. A regra é de
     * entrada, e olha para a frente.
     */
    if (!projectId) {
      return jsonError(
        "Informe o projeto desta auditoria: todo parecer pertence a um centro de custo.",
      );
    }

    const clientAuditId = String(formData.get("auditId") ?? "").trim();
    /*
     * A auditoria ANTERIOR deste memorial. O cliente ja a conhece — e ja a manda
     * para `/api/audit/delta`, que responde o que mudou de graca. Faltava mandar
     * para ca, onde a resposta pode virar economia em vez de so informacao.
     */
    const auditIdAnterior = String(formData.get("auditIdAnterior") ?? "").trim();
    const conversationIdRaw = formData.get("conversationId");
    const conversationId =
      typeof conversationIdRaw === "string" && conversationIdRaw.trim()
        ? conversationIdRaw.trim()
        : null;
    const requestMockMode = formData.get("mockMode") === "true";
    const fileTypes = formData.getAll("fileTypes").map((value) => String(value));
    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File);

    if (!message) {
      return jsonError("Informe uma solicitação para a auditoria.");
    }

    if (files.length === 0) {
      return jsonError("Envie pelo menos um PDF para análise.");
    }

    if (files.length > MAX_FILES) {
      return jsonError(`Envie no máximo ${MAX_FILES} PDFs por análise.`);
    }

    for (const file of files) {
      if (!isPdf(file)) {
        return jsonError(`O arquivo "${file.name}" não é um PDF válido.`);
      }

      if (file.size > MAX_FILE_SIZE) {
        return jsonError(`O arquivo "${file.name}" excede o limite de 25 MB.`);
      }
    }

    /*
     * Teto de gasto — barreira de ENTRADA, antes de qualquer token.
     *
     * Fica depois das validações de arquivo de propósito: recusar por limite
     * um PDF que nem era válido confundiria a causa. E fica antes de
     * `createPendingAudit` para não deixar registro de auditoria que nunca
     * começou.
     */
    const teto = await verificarTetoMensal({
      userId: session?.user?.id ?? null,
      userEmail: sessionEmail,
    });
    if (teto.estourou) {
      console.warn(
        `[audit] recusada por teto mensal: US$ ${teto.gastoUsd.toFixed(2)} de US$ ${(teto.tetoUsd ?? 0).toFixed(2)}`,
      );
      return jsonError(mensagemDeTetoEstourado(teto), 402);
    }

    const canUseClientMock = process.env.NODE_ENV !== "production" ||
      process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true";

    if (requestMockMode && !canUseClientMock && !isMockModeEnabled()) {
      return jsonError("Modo demo não está habilitado neste ambiente.", 403);
    }

    /*
     * QUEM pediu a auditoria.
     *
     * O ator já passou pelo portão acima, então "sem sessão" deixou de ser um
     * caso aqui. O que resta é resolver o `User` pelo e-mail: o portão devolve
     * o `userId` do VÍNCULO com o escritório, que é nulo enquanto o convidado
     * não tiver conta, e a auditoria quer o id de quem a rodou.
     */
    let auditActor: ActorIdentity | null = isDatabaseConfigured()
      ? await getUserActor(normalizeEmail(sessionEmail), actor.name ?? session?.user?.name ?? null).catch(
          // Falhar em identificar o autor não pode impedir a auditoria — o
          // trabalho vale mais que o crédito.
          () => null,
        )
      : null;

    if (!isDatabaseConfigured()) {
      return jsonError("DATABASE_URL nao configurada para vincular projeto.", 503);
    }

    /*
     * O `if (projectId)` que existia aqui deixou de ser condicional: o projeto
     * agora é exigido lá em cima, e este bloco vale sempre. Era ele que
     * guardava a autenticação da rota, e por isso o caminho sem projeto passava
     * sem sessão nenhuma.
     */
    try {
      await assertProjectAccess(projectId, auditActor ?? {
        id: actor.userId,
        email: actor.email,
        name: actor.name,
      });
    } catch {
      return jsonError("Projeto nao encontrado.", 404);
    }

    const useMockMode = isMockModeEnabled() || (requestMockMode && canUseClientMock);

    if (useMockMode) {
      await waitForMockAudit();
      return withCors(
        NextResponse.json({
          result: getMockAuditResult(auditMode),
          auditMode,
          mock: true,
        }),
        request,
      );
    }

    const activeLearnings = await listAuditLearnings({
      activeOnly: true,
      scope: auditMode,
    });
    const learningContext = formatAuditLearningsForPrompt(activeLearnings);

    const auditId = /^[A-Za-z0-9-]{8,80}$/.test(clientAuditId)
      ? clientAuditId
      : crypto.randomUUID();
    persistedAuditId = await createPendingAudit({
      auditId,
      auditMode,
      analysisLevel,
      auditTitle,
      projectName,
      auditDescription,
      projectId,
      actor: auditActor,
      files,
      fileTypes,
    });

    marco({ passada: "extracao", estado: "inicio" });
    const uploadedFiles = await Promise.all(
      files.map(async (file, index): Promise<UploadedAuditFile> => {
        const fileStartedAt = Date.now();
        console.log(`[audit] extraindo texto: ${file.name} (${file.size} bytes)`);
        const buffer = Buffer.from(await file.arrayBuffer());
        const extracted = await extractPdfText(buffer);
        console.log(
          `[audit] texto extraido: ${file.name}, ${extracted.pageCount} paginas, ${extracted.charCount} caracteres em ${Math.round((Date.now() - fileStartedAt) / 1000)}s`,
        );
        // O tamanho do documento só é FATO depois de extrair — é aqui, e não
        // antes, que se pode dizer quantas páginas a auditoria vai ler.
        marco({
          passada: "extracao",
          estado: "fim",
          detalhe: `${extracted.pageCount} páginas, ${extracted.charCount.toLocaleString("pt-BR")} caracteres`,
        });

        const fileType = fileTypes[index] ?? "não informado";

        if (extracted.charCount < MIN_TEXT_CHARS_FOR_DEEP_AUDIT) {
          throw new AuditInputError(getLowTextPdfMessage(file.name, fileType));
        }

        return {
          file,
          fileType,
          buffer,
          extracted,
        };
      }),
    );
    /*
     * QUEM É O AUDITOR DESTA CORRIDA — o hash que decide se um parecer anterior
     * ainda pode ser reaproveitado. Derivado da configuração real, para ninguém
     * precisar lembrar de subir constante. Ver [[versao-do-auditor.ts]].
     */
    const versaoAtualDoAuditor = versaoDoAuditor({
      prompt: getAuditorPrompt(auditMode),
      modeloGlobal: getPrimaryModelName(auditMode, analysisLevel, "global"),
      modeloBloco: getPrimaryModelName(auditMode, analysisLevel, "chunk"),
      modeloValidacao: getValidationModelName(auditMode, analysisLevel),
      esforco: getReasoningEffort(analysisLevel, auditMode),
      tamanhoDoBloco: CHUNK_GROUP_CHARS,
    });

    /*
     * O REUSO, decidido ANTES de gastar um token.
     *
     * O motor de decisão inteiro já existia em [[audit-reuso.ts]] e nunca tinha
     * sido chamado — a rota importava dali só a constante de versão. Ver
     * `docs/superpowers/specs/2026-08-17-reuso-da-auditoria-design.md`.
     */
    const arquivoPrincipal = uploadedFiles[0];
    const baseCarregada = auditIdAnterior
      ? await getPrisma()
          .audit.findFirst({
            // `projectId` na cláusula não é zelo: herdar achado de auditoria de
            // OUTRO centro de custo contaminaria a fila de um projeto alheio.
            where: { id: auditIdAnterior, projectId },
            select: { id: true, status: true, report: true, completedAt: true },
          })
          .catch(() => null)
      : null;

    const relatorioBase = (baseCarregada?.report ?? null) as AuditReport | null;
    const elegibilidade = avaliarBase({
      base: baseCarregada
        ? { auditId: baseCarregada.id, status: baseCarregada.status, report: relatorioBase }
        : null,
      arquivo: arquivoPrincipal.file.name,
      versaoAtual: versaoAtualDoAuditor,
    });

    const delta = elegibilidade.serve
      ? compararImpressoes(
          elegibilidade.impressao,
          impressaoDosCapitulos(chunkPdfByChapter(arquivoPrincipal.extracted)),
        )
      : null;

    /*
     * DOCUMENTO IDÊNTICO: recusa antes de gastar.
     *
     * Nada alterado, nada novo e o mesmo auditor — não há trabalho a fazer, e
     * cobrar uma auditoria para reconfirmar o parecer que já existe seria vender
     * o mesmo serviço duas vezes.
     *
     * O caso VIZINHO não é recusa: documento idêntico com auditor DIFERENTE relê
     * tudo, senão melhorar o prompt nunca alcançaria memorial já auditado. Ele
     * nem chega aqui — `avaliarBase` já o barrou com `versao-diferente`, e
     * `delta` fica nulo.
     */
    if (delta && delta.alterados.length === 0 && delta.novos.length === 0) {
      console.log(`[audit] recusada: documento idêntico à auditoria ${auditIdAnterior}`);
      return withCors(
        NextResponse.json(
          {
            error: `O documento é idêntico ao que foi auditado em ${formatarDataCurta(baseCarregada?.completedAt)}. Não há o que auditar.`,
            identico: true,
            auditIdAnterior,
          },
          { status: 409 },
        ),
        request,
      );
    }

    const plano =
      delta && elegibilidade.serve && relatorioBase
        ? planejarReuso({
            delta,
            capitulosAntes: elegibilidade.impressao,
            achadosAntes: relatorioBase.incongruencias ?? [],
            paginasAgora: arquivoPrincipal.extracted.pages,
            versaoAnterior: relatorioBase.runtime?.versao_auditor,
            versaoAtual: versaoAtualDoAuditor,
          })
        : null;

    console.log(
      plano
        ? `[audit] reuso: ${plano.capitulosParaLer.length} capítulo(s) para reler, ${plano.hashesHerdados.length} herdado(s), ${plano.achadosHerdados.length} achado(s) herdado(s)`
        : `[audit] sem reuso: ${elegibilidade.serve ? "delta indisponível" : fraseDaRecusa(elegibilidade.motivo)}`,
    );

    /** Resumo por hash, do parecer anterior — o que a global lê no lugar do texto. */
    const resumoPorHash = new Map(
      (relatorioBase?.runtime?.sintese ?? [])
        .filter((s) => s.arquivo === arquivoPrincipal.file.name)
        .flatMap((s) => s.capitulos.map((c) => [c.hash, c.resumo] as const)),
    );

    const allFindings: AuditFinding[] = [];
    // Passadas que não completaram. Vai para o relatório: sem isso, uma auditoria
    // degradada chega na tela com a mesma cara de uma completa.
    const degradacoes: PassadaIncompleta[] = [];
    // O mapa por capítulo que cada leitura global deixa, para a reauditoria
    // seguinte não precisar reler o documento inteiro.
    const sinteses = new Map<string, { capitulo: string; resumo: string }[]>();

    for (const file of uploadedFiles) {
      const findings = await deepAnalyzeFile({
        auditId,
        auditMode,
        analysisLevel,
        userMessage: message,
        projectName,
        learningContext,
        auditTitle,
        gabarito,
        file,
        conversationId,
        userEmail: sessionEmail,
        degradacoes,
        sinteses,
        onMarco,
        /*
         * O plano vale para o arquivo que foi comparado. Com mais de um arquivo,
         * só o primeiro tem base — os outros são lidos inteiros, que é o
         * conservador certo: reuso sem impressão comparável seria adivinhação.
         */
        ...(plano && file === arquivoPrincipal
          ? {
              capitulosParaLer: plano.capitulosParaLer,
              hashesHerdados: new Set(plano.hashesHerdados),
              resumoPorHash,
            }
          : {}),
      });
      allFindings.push(...findings);
    }

    /*
     * Os HERDADOS entram depois das passadas e FORA da validação: eles já foram
     * validados na corrida que os produziu, e o texto do capítulo não mudou.
     * Revalidá-los custa dinheiro e pode virar o veredito de um trecho idêntico.
     */
    const achadosHerdados = (plano?.achadosHerdados ?? []).map((f) => ({
      ...f,
      herdado_de: {
        auditId: auditIdAnterior,
        quando: formatarDataCurta(baseCarregada?.completedAt),
      },
    }));

    // Camada 1 — confronto determinístico de identidade entre documentos.
    // Sempre ativo, sem IA, com evidência verificável. É o que pega troca de
    // município/endereço/obra entre arquivos do mesmo projeto.
    // Com um arquivo só não há confronto — anunciar a passada seria teatro.
    if (uploadedFiles.length > 1) marco({ passada: "confronto", estado: "inicio" });
    const ruleComparison = runCrossDocumentRules(
      uploadedFiles.map((file) => ({
        fileName: file.file.name,
        fileType: file.fileType,
        extracted: file.extracted,
      })),
    );
    allFindings.push(...ruleComparison.findings);
    console.log(
      `[audit] confronto determinístico entre documentos: ${ruleComparison.findings.length} divergência(s) de identidade`,
    );
    if (uploadedFiles.length > 1) {
      marco({
        passada: "confronto",
        estado: "fim",
        detalhe: `${ruleComparison.findings.length} divergência(s)`,
      });
    }

    // Motor legado por IA: só quando explicitamente habilitado (benchmark).
    const modelComparison = isAiCrossDocumentEnabled()
      ? await analyzeCrossDocumentsWithModel({
          auditId,
          auditMode,
          analysisLevel,
          userMessage: message,
          projectName,
          learningContext,
          files: uploadedFiles,
          conversationId,
          userEmail: sessionEmail,
        })
      : { findings: [] as AuditFinding[], comparisons: [] as string[] };
    allFindings.push(...modelComparison.findings);

    const candidateFindings = compactRepeatedIdentityFindings(
      filterFalsePositiveIdentityFindings(dedupeFindings(allFindings)),
    );
    console.log(
      `[audit] validação semântica iniciada com ${candidateFindings.length} achado(s) candidato(s)`,
    );
    marco({
      passada: "validacao",
      estado: "inicio",
      detalhe: `${candidateFindings.length} achado(s) a revisar`,
      orcamentoMs: getValidationTimeoutMs(analysisLevel),
    });
    const validatedFindings = await validateFindingsWithModel({
      auditId,
      auditMode,
      analysisLevel,
      auditEngine,
      userMessage: message,
      projectName,
      learningContext,
      files: uploadedFiles,
      findings: candidateFindings,
      conversationId,
      userEmail: sessionEmail,
    });
    console.log(
      `[audit] validação semântica concluida com ${validatedFindings.length} achado(s) confirmado(s)`,
    );
    marco({
      passada: "validacao",
      estado: "fim",
      detalhe: `${validatedFindings.length} achado(s) confirmado(s)`,
    });
    marco({ passada: "parecer", estado: "inicio" });

    /*
     * A DISCIPLINA DE CADA ACHADO SAI DA PÁGINA DELE, e não da prosa.
     *
     * Está escrita no cabeçalho do capítulo em que o trecho mora — fato
     * objetivo, e por isso regra e não IA. A classificação da tela varria o
     * texto do achado inteiro, `evidencia` incluída: um achado do capítulo de
     * elétrica cuja frase citada mencionasse "bancada em granito" era arquivado
     * como arquitetura e sumia do filtro de quem revisava a elétrica.
     *
     * O mapa é por ARQUIVO porque a auditoria compara documentos, e a página 12
     * de um não é a página 12 do outro. O `mapaUnico` cobre o achado que não
     * carimba `arquivo`: com um documento só não há a quem confundir, e sem ele
     * a auditoria de arquivo único — a comum — não ganharia disciplina nenhuma.
     */
    const disciplinaPorArquivo = new Map(
      uploadedFiles.map((file) => [file.file.name, disciplinaPorPagina(file.extracted.pages)]),
    );
    const mapaUnico =
      uploadedFiles.length === 1
        ? disciplinaPorArquivo.get(uploadedFiles[0].file.name)
        : undefined;

    /*
     * Os herdados entram no MESMO funil de dedupe e ordenação dos novos — e é
     * aqui, não antes, porque `dedupeFindings` é quem impede que um achado
     * herdado e o seu gêmeo recém-produzido apareçam duas vezes no parecer. Um
     * capítulo promovido por falta de âncora é justamente o caso: os achados
     * dele voltam frescos do modelo enquanto a versão antiga já foi descartada
     * por `planejarReuso`, mas o dedupe é a rede que sustenta a promessa.
     */
    const findings = sortAuditFindings(
      compactRepeatedIdentityFindings(
        filterFalsePositiveIdentityFindings(
          dedupeFindings([...validatedFindings, ...achadosHerdados]),
        ),
      ),
    ).map(
      (finding, index) => {
        const mapa =
          (finding.arquivo ? disciplinaPorArquivo.get(finding.arquivo) : undefined) ?? mapaUnico;
        const disciplina =
          finding.disciplina ?? (mapa ? disciplinaDoAchado(finding.pagina, mapa) : undefined);
        /*
         * A PRIORIDADE PASSA A SER DERIVADA, e não mais o campo livre que o
         * modelo preenchia — dois achados idênticos em documentos diferentes
         * saíam com prioridades diferentes. A matriz cruza consequência e
         * certeza, que o achado já declara, e escreve a frase que explica a
         * conta.
         *
         * Ela CLASSIFICA e nada mais: nenhum achado é removido, filtrado ou
         * recolhido aqui. A regra da faixa (`lib/severidade.ts`) é o que impede
         * "apertar a severidade" de virar, de novo, esconder achado.
         */
        const severidade = severidadeDoAchado(finding);

        return {
          ...finding,
          id: `INC-${String(index + 1).padStart(3, "0")}`,
          prioridade: severidade.prioridade,
          severity_reason: severidade.motivo,
          // Ausente quando a página não tem cabeçalho: é o que preserva o
          // fallback da inferência em vez de afirmar "geral" sem base.
          ...(disciplina ? { disciplina } : {}),
        };
      },
    );
    console.log(
      `[audit] requisicao concluida em ${Math.round((Date.now() - requestStartedAt) / 1000)}s com ${findings.length} achado(s)`,
    );
    const combinedText = uploadedFiles.map((file) => file.extracted.text).join("\n");
    const inferred = inferProjectFields(combinedText, projectName);
    const inferredDocumentType = inferDocumentType(auditMode, combinedText);
    const dominantIdentity = uploadedFiles[0]
      ? getDominantIdentityCandidate(getIdentityCandidates(uploadedFiles[0].extracted))?.value
      : "";
    const hasCriticalDocumental = findings.some(
      (finding) => (finding.impacto ?? classifyFindingImpact(finding)) === "critico_documental",
    );
    const executiveSummary = buildExecutiveSummary(findings);
    const report: AuditReport = {
      arquivo: uploadedFiles.map((file) => file.file.name).join(", "),
      tipo_auditoria: auditMode,
      tipo_documento: inferredDocumentType,
      runtime: {
        // Quais passadas não completaram. O veredito lê isto para se rebaixar.
        passadas_incompletas: degradacoes,
        nivel_analise: analysisLevel,
        motor_auditoria: auditEngine,
        regras_locais_ativas: isRuleBasedAuditEnabled(),
        provedor_principal: getPrimaryExecutionProfile(auditMode, analysisLevel).provider,
        provedor_validacao: getValidationExecutionProfile(auditMode, analysisLevel).provider,
        modelo_principal: getPrimaryModelName(auditMode, analysisLevel),
        modelo_validacao: getValidationModelName(auditMode, analysisLevel),
        segunda_ia:
          auditEngine === "dual"
            ? {
                ativa: true,
                modelo: getValidationModelName(auditMode, analysisLevel),
                papel: "validacao_semantica",
                observacao:
                  "Modo comparativo: a segunda IA revisou, rebaixou ou removeu achados candidatos antes do relatório final.",
              }
            : undefined,
        modelos_operacionais: {
          identidade: getPrimaryModelName(auditMode, analysisLevel, "identity"),
          leitura_global: getPrimaryModelName(auditMode, analysisLevel, "global"),
          blocos: getPrimaryModelName(auditMode, analysisLevel, "chunk"),
          comparacao_arquivos: getPrimaryModelName(auditMode, analysisLevel, "crossDocument"),
          validacao: getValidationModelName(auditMode, analysisLevel),
        },
        esforco_raciocinio: getReasoningEffort(analysisLevel, auditMode),
        duracao_ms: Date.now() - requestStartedAt,
        arquivos: uploadedFiles.length,
        /*
         * A IMPRESSÃO DIGITAL POR CAPÍTULO — o que permite, na próxima
         * auditoria do mesmo memorial, dizer O QUE MUDOU.
         *
         * Vai no relatório (JSON schemaless) e não numa coluna: é dado DA
         * auditoria, acompanha o registro para onde ele for, e não custa
         * migração. São ~64 bytes de hash por capítulo.
         *
         * Guardado sempre, inclusive no profundo — que hoje nem fatia o
         * documento (lê inteiro). O corte por capítulo aqui serve para
         * COMPARAR, não para dividir o trabalho.
         */
        impressao: uploadedFiles.map((file) => ({
          arquivo: file.file.name,
          capitulos: impressaoDosCapitulos(chunkPdfByChapter(file.extracted)),
        })),
        /*
         * Sem isto a impressão digital não serve para reaproveitar achado: ela
         * diz que o TEXTO é o mesmo, não que o auditor que o leu é o mesmo.
         * Herdar achado produzido por um prompt anterior é servir leitura
         * vencida — a mesma regra do cache de leitura de selo.
         */
        versao_auditor: versaoAtualDoAuditor,
        /*
         * Preenchido só quando houve reuso. A AUSÊNCIA dele significa leitura
         * completa — nunca "não sei" —, e é por isso que ele não vira zeros.
         */
        ...(plano
          ? {
              reauditoria: {
                base_audit_id: auditIdAnterior,
                capitulos_lidos: plano.capitulosParaLer.length,
                capitulos_herdados: plano.hashesHerdados.length,
                achados_herdados: achadosHerdados.length,
                promovidos_sem_ancora: plano.promovidos.map((p) => p.titulo),
              },
            }
          : {}),
        /*
         * O modelo devolve o TÍTULO do capítulo; o reuso precisa do HASH, que é
         * o que sobrevive a capítulo inserido no meio. O casamento é aqui, e é
         * por título normalizado porque é o único elo que o modelo tem.
         *
         * Título que não casa com capítulo nenhum é DESCARTADO: síntese sem
         * hash não serve para reuso e ainda inflaria a contagem, fazendo o mapa
         * parecer mais completo do que é.
         */
        sintese: uploadedFiles.map((file) => {
          const capitulos = impressaoDosCapitulos(chunkPdfByChapter(file.extracted));
          const hashPorTitulo = new Map(
            capitulos.map((c) => [c.titulo.trim().toLowerCase(), c.hash]),
          );

          return {
            arquivo: file.file.name,
            capitulos: (sinteses.get(file.file.name) ?? [])
              .map((s) => ({
                hash: hashPorTitulo.get(s.capitulo.trim().toLowerCase()) ?? "",
                resumo: s.resumo,
              }))
              .filter((s) => s.hash),
          };
        }),
        gerado_em: new Date().toISOString(),
      },
      obra: isMissingProjectField(inferred.obra) ? dominantIdentity || "não identificada" : inferred.obra,
      codigo: inferred.codigo,
      municipio: inferred.municipio,
      volume: inferred.volume,
      orgao: inferred.orgao,
      data_documento: inferred.data,
      status_analise: "concluida",
      status_geral:
        findings.length === 0
          ? "sem achados críticos"
          : hasCriticalDocumental
            ? "revisão obrigatória antes de emissão"
            : "com pontos de revisão",
      total_incongruencias: findings.length,
      arquivos_analisados: uploadedFiles.map((file) => ({
        arquivo: file.file.name,
        tipo_documento: file.fileType,
        paginas: file.extracted.pageCount,
        caracteres_extraidos: file.extracted.charCount,
        /*
         * O nível REAL da corrida, não um rótulo fixo.
         *
         * Esta frase dizia "Auditoria profunda" em toda auditoria, inclusive nas
         * padrão — e ainda contava blocos recalculando o corte aqui, número que
         * no nível profundo não corresponde a trabalho nenhum (lá o documento é
         * lido inteiro, sem blocos). O relatório é a peça que sustenta uma
         * decisão de emitir: descrever nele um esforço que não houve é o pior
         * lugar do sistema para se estar errado.
         */
        resumo: isCoberturaTotalEnabled()
          ? `Auditoria completa: leitura de identidade, leitura do documento inteiro por IA e ${chunkPdfByChapter(file.extracted).length} blocos de leitura por capítulo.`
          : analysisLevel === "deep"
            ? "Auditoria profunda: leitura de identidade e leitura do documento inteiro por IA."
            : `Auditoria padrão: leitura de identidade, leitura global por IA e ${chunkPdfByChapter(file.extracted).length} blocos de leitura por capítulo.`,
      })),
      comparacoes: [...ruleComparison.comparisons, ...modelComparison.comparisons],
      incongruencias: findings,
      conclusao:
        findings.length === 0
          ? "nenhum achado crítico detectado dentro da auditoria profunda executada"
          : executiveSummary,
    };
    const result = makeTextReport(report);
    await persistCompletedAudit({
      auditId: persistedAuditId,
      uploadedFiles,
      report,
      result,
      elapsedMs: Date.now() - requestStartedAt,
      projectId,
      actor: auditActor,
    });

    return withCors(
      NextResponse.json({ result, report, auditMode, auditId: persistedAuditId }),
      request,
    );
  } catch (error) {
    const profile = getPrimaryExecutionProfile(requestedAuditMode, requestedAnalysisLevel);
    const failure = classifyProviderFailure(
      profile.provider,
      "audit",
      profile.model,
      error,
    );
    if (failure.category !== "unknown") {
      recordProviderFailure(failure);
    }
    console.error(`[audit] requisicao falhou (${failure.category})`);
    await persistFailedAudit(persistedAuditId, error, Date.now() - requestStartedAt);

    if (error instanceof AuditInputError) {
      return jsonError(error.message, error.status);
    }

    if (failure.category !== "unknown") {
      const status =
        failure.category === "authentication"
          ? 401
          : failure.category === "quota_billing"
            ? 402
            : failure.category === "rate_limit"
              ? 429
              : failure.category === "timeout"
                ? 504
                : 503;
      return jsonError(
        `${failure.message} Fluxo: auditoria ${requestedAnalysisLevel === "deep" ? "profunda" : "padrão"}.`,
        status,
      );
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a auditoria documental.",
      500,
    );
  }
}

/**
 * A rota. Responde JSON como sempre — ou um fluxo de eventos, se pedirem.
 *
 * O progresso é ADITIVO: quem não manda `stream=1` (a tela `/audit`, qualquer
 * integração de fora) recebe exatamente a mesma resposta de antes. Trocar o
 * contrato para todo mundo obrigaria a mexer em dois clientes ao mesmo tempo
 * para ganhar um recurso que só um deles usa.
 *
 * O fluxo sai na resposta do PRÓPRIO POST, e não num canal separado com um id:
 * um canal à parte exigiria estado compartilhado entre requisições, que quebra
 * assim que houver mais de uma instância servindo. Aqui os marcos viajam na
 * mesma conexão do trabalho que os produz — se a conexão cai, cai tudo junto,
 * que é a verdade.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  if (formData.get("stream") !== "1") {
    return executarAuditoria(request, formData);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let aberto = true;
      const enviar = (evento: string, dados: unknown) => {
        if (!aberto) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`),
          );
        } catch {
          // Cliente desistiu no meio: parar de escrever é o certo. O trabalho
          // em curso segue até o fim porque já foi pago.
          aberto = false;
        }
      };

      /*
       * BATIMENTO A CADA 15s.
       *
       * O fluxo só escrevia quando um marco chegava, e numa auditoria profunda o
       * silêncio entre marcos passa de dois minutos (`NEXODOC_CHUNK_TIMEOUT_MS`
       * sozinho vale 120s). Proxy nenhum segura conexão ociosa tanto tempo: o da
       * Render cortava, e o navegador mostrava "network error" enquanto a
       * análise SEGUIA rodando no servidor — o pior par possível, porque a
       * pessoa reenvia e paga o modelo de novo enquanto a primeira ainda anda.
       *
       * Linha de comentário SSE (`:`): o leitor do cliente descarta bloco sem
       * `event:`/`data:` (ver `lerFluxo`), e o EventSource padrão também. Só
       * serve para haver byte trafegando.
       */
      const batimento = setInterval(() => {
        if (!aberto) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          aberto = false;
        }
      }, 15000);

      try {
        const resposta = await executarAuditoria(request, formData, (m) =>
          enviar("marco", m),
        );
        const corpo = await resposta.json().catch(() => null);
        enviar(resposta.ok ? "done" : "error", corpo ?? { error: "Resposta inválida." });
      } catch (err) {
        enviar("error", {
          error: err instanceof Error ? err.message : "Falha na auditoria.",
        });
      } finally {
        clearInterval(batimento);
        aberto = false;
        try {
          controller.close();
        } catch {
          // já fechado pelo cliente
        }
      }
    },
  });

  return withCors(
    new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        /*
         * Proxy nenhum deve BUFFERIZAR isto. Um intermediário que segura a saída
         * até encher o buffer anula tanto os marcos quanto o batimento — a
         * conexão volta a parecer ociosa mesmo com o servidor escrevendo.
         */
        "X-Accel-Buffering": "no",
      },
    }),
    request,
  );
}
