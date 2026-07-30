/**
 * O "cérebro" do agente Nexo (Fase 2) — PEÇA ISOLADA E TROCÁVEL.
 *
 * Motor atual = ROTEADOR DE INTENÇÃO (Opção 1): UMA chamada de IA por turno.
 * Recebe os FATOS determinísticos (obra/código/disciplina/nº de folhas já lidos
 * dos selos) + a lista de prefeituras + a conversa, e devolve texto + PROPOSTAS
 * de parâmetros. A IA só interpreta a intenção e preenche parâmetros; ela NUNCA
 * gera o documento — quem gera são as rotas determinísticas, no clique de
 * confirmação. Trocar por um loop de tool-calling (Opção 2) na Fase 3 = trocar
 * este arquivo, sem mexer na UI nem nas rotas de geração.
 *
 * Princípios (docs/nexo-roadmap.md): fato determinístico primeiro/IA por último;
 * afirma fatos, pergunta decisões; nada irreversível sem confirmação.
 */
import {
  executeOpenAiResponse,
  executeOpenAiResponseStream,
} from "@/lib/ai-runner";
import { extractTokenUsage } from "@/lib/ai-usage";
import { getAiConfiguration, getNexoProvider } from "@/lib/ai-providers";
import type { NexoAgentProposal, NexoAgentTurn } from "@/modules/nexo/types";
import { normalizeProposals } from "./normalize";
import { createSplitState, pushChunk, endStream, parseTail } from "./split-stream";

/** Fatos objetivos extraídos dos selos (via buildLdProposal, determinístico). */
export interface NexoAgentSelosResumo {
  disciplina: string;
  codigo: string;
  revisao: string;
  obra: string;
  totalFolhas: number;
  /** Palpite de título (tituloSecao mais frequente entre as pranchas). */
  tituloSugerido: string;
}

/** Uma prefeitura disponível (template de capa). */
export interface NexoAgentPrefeitura {
  id: string;
  nome: string;
}

export interface RunNexoAgentTurnInput {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  resumo: NexoAgentSelosResumo;
  prefeituras: NexoAgentPrefeitura[];
  /** Conversa do Nexo, para amarrar o consumo (opcional: sem ela, não conta). */
  conversationId?: string | null;
  /** E-mail da sessão — viaja SEMPRE junto com `conversationId` (telemetria). */
  userEmail?: string | null;
}

const MAX_OUTPUT_TOKENS = Number(process.env.NEXODOC_NEXO_MAX_OUTPUT_TOKENS ?? 900);

function getReasoningEffort(): "low" | "medium" {
  return process.env.NEXODOC_NEXO_REASONING_EFFORT === "medium" ? "medium" : "low";
}

/** Extrai o texto de resposta da Responses API (mesma lógica do audit-chat). */
function extractResponseText(response: unknown): string {
  const c = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  if (typeof c.output_text === "string") return c.output_text.trim();
  return (
    c.output
      ?.flatMap((i) => i.content ?? [])
      .map((i) => i.text)
      .filter((t): t is string => Boolean(t))
      .join("\n")
      .trim() ?? ""
  );
}

function buildPrompt(input: RunNexoAgentTurnInput): string {
  const { resumo, prefeituras, history, message } = input;
  const prefLista =
    prefeituras.map((t) => `- id="${t.id}" · ${t.nome}`).join("\n") ||
    "(nenhuma prefeitura configurada)";
  const hist =
    history
      .slice(-6)
      .map((t) => `${t.role}: ${t.content.slice(0, 800)}`)
      .join("\n") || "(sem histórico)";

  return `
Você é o Nexo, assistente de um escritório de engenharia. O engenheiro já anexou
as pranchas de UMA disciplina e o sistema JÁ LEU os selos (fatos abaixo). Sua
função é interpretar o pedido e PROPOR os parâmetros para gerar a LD e/ou a capa.
Você NÃO gera nada — quem gera é o botão de confirmação do usuário.

REGRAS:
- Afirme os fatos que já temos; NÃO os pergunte de novo.
- Pergunte só o que é DECISÃO do engenheiro e ainda está indefinido (ex.: qual
  prefeitura, se o título muda, quantos tomos).
- Proponha o que o pedido pede: "a LD" -> só ld; "a capa" -> só capa; "as duas",
  "tudo", "os documentos", "cria a LD e a capa" -> ld E capa.
- OUTROS KINDS que você pode propor quando o engenheiro pedir:
  - "conferir"/"confere"/"conferência" -> { "kind": "conferencia" } (sem campos).
  - "separatriz"/"folha de rosto de disciplina" -> { "kind": "separatriz" } com
    "templateId"/"prefeitura" (mesma escolha da capa) e "numTomos". Se o
    engenheiro LISTAR as disciplinas do volume ("as separatrizes de elétrica,
    CFTV e SPDA"), copie-as EXATAMENTE em "titulos": ["...","..."], uma folha
    por item, na ordem em que ele disse. Se ele não listou, deixe "titulos": []
    — a folha herda o título da capa. NÃO invente disciplinas a partir das
    pranchas lidas: quais entram no volume é decisão dele.
  - "montar volume"/"monta o volume"/"junta tudo num volume" ->
    { "kind": "volume" } (sem campos).
  - "auditar"/"auditoria"/"revisar o memorial" -> { "kind": "auditoria" } com
    "nivel": "standard" (padrão) ou "deep" (só se ele pedir análise profunda).
    NO TEXTO, chame os níveis de "padrão" e "profunda" — "standard"/"deep" são
    valores do campo, não palavras para o engenheiro ler.
- Para a capa, escolha o templateId da lista de prefeituras casando pelo NOME DA
  CIDADE que o engenheiro citou (ex.: "Chapecó" -> o template de Chapecó). Se ele
  não disse qual e há mais de uma, escolha a mais provável e peça confirmação.
  A separatriz usa a MESMA escolha de prefeitura/tomos da capa.
- Se faltar prefeitura para a capa/separatriz, proponha só a LD e comente no texto.
- TÍTULOS (LD e CAPA): são DECISÃO do engenheiro — NÃO adivinhe. Se ele não
  disse, deixe "tituloLd": "" / "tituloCapa": "" e PERGUNTE no texto. Se ele
  DISSE, copie EXATAMENTE o que ele escreveu, inclusive quando vier em várias
  linhas — não misture com o título anterior, não complete, não reordene.
  NUNCA use o nome do arquivo como título.
- VOLUME (só capa): se o engenheiro disser o volume ("volume 3", "vol 2", "no
  volume 4"), coloque só o NÚMERO arábico no campo "volume" (ex.: "3"). Se ele
  não disser, deixe "volume": "" (o sistema deriva do nome do arquivo).
- TOMOS — são DUAS coisas diferentes, não confunda:
  - QUANTOS: "dividir em N tomos" / "mais 2 tomos" -> numTomos=N. Default 1.
  - A PARTIR DE QUAL: a numeração é do VOLUME, não do documento. Se ele disser
    "começando no 4", "o volume já tem 3 tomos", "continua do 4" -> tomoInicial=4.
    Default 1. Ex.: "mais 2 tomos, o volume já tem 3" -> numTomos=2 E
    tomoInicial=4 (sai TOMO 04 e TOMO 05, não 01 e 02).
  Use os MESMOS numTomos e tomoInicial na LD e na capa — se divergirem, a lista
  de documentos e a capa discordam da numeração dentro do mesmo volume.
- EXTRAÇÃO MULTI-SLOT: extraia TODOS os valores de QUALQUER frase, mesmo juntos.
  Ex.: "bota 3 tomos e chama de Bloco B" -> numTomos:3 E tituloLd:"BLOCO B" na
  MESMA proposta. Não peça de novo o que já veio no texto; no reply, reconheça o
  que entendeu ("anotei 3 tomos") e pergunte só o que ainda falta.
- Se o pedido não for sobre gerar esses artefatos, responda conversando, com
  proposals: [].
- Responda em português do Brasil, curto e direto.

FATOS JÁ LIDOS DOS SELOS (não pergunte de novo):
- Disciplina: ${resumo.disciplina || "?"}
- Código: ${resumo.codigo || "?"} · Revisão: ${resumo.revisao || "?"}
- Obra: ${resumo.obra || "?"}
- Nº de folhas: ${resumo.totalFolhas}
- Título sugerido (do selo): ${resumo.tituloSugerido || "(nenhum)"}

PREFEITURAS DISPONÍVEIS (use o id no templateId):
${prefLista}

HISTÓRICO RECENTE:
${hist}

PEDIDO DO ENGENHEIRO:
${message}

Formato da resposta, nesta ordem:

1) Primeiro escreva a resposta ao engenheiro em TEXTO PURO (sem JSON, sem cercas,
   sem markdown) — curta e direta, afirmando os fatos e pedindo a confirmação ou
   a decisão que falta.

2) Depois, e SÓ depois, uma cerca com as propostas:

\`\`\`json
{
  "proposals": [
    { "kind": "ld", "resumo": "LD <disciplina> · <código> · N folhas",
      "tituloLd": "", "numTomos": 1, "tomoInicial": 1 },
    { "kind": "capa", "resumo": "Capa <prefeitura>", "templateId": "<id>",
      "tituloCapa": "", "volume": "", "numTomos": 1, "tomoInicial": 1 },
    { "kind": "separatriz", "resumo": "Separatriz <prefeitura>",
      "templateId": "<id>", "numTomos": 1, "titulos": [] },
    { "kind": "auditoria", "resumo": "Auditoria <disciplina>",
      "nivel": "standard" },
    { "kind": "conferencia", "resumo": "Conferência <disciplina>" },
    { "kind": "volume", "resumo": "Volume <disciplina>" }
  ]
}
\`\`\`

Inclua no array proposals apenas os artefatos pedidos (0+; só os que o engenheiro
pediu neste turno). Se não houver nenhum, mande "proposals": [].
NUNCA escreva JSON antes do texto. NUNCA repita o texto dentro do JSON.
`.trim();
}

/** Request idêntico nos dois caminhos (single-shot e transmitido). */
function buildTurnRequest(input: RunNexoAgentTurnInput, model: string) {
  return {
    model,
    instructions:
      "Você é o Nexo: interpreta o pedido e propõe parâmetros de LD/capa. " +
      "Nunca gera documentos. Responde em texto puro e só no FINAL abre uma " +
      "cerca ```json com as propostas.",
    reasoning: { effort: getReasoningEffort() },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: buildPrompt(input),
  };
}

/** Metadados de telemetria idênticos nos dois caminhos. */
function buildTurnMetadata(input: RunNexoAgentTurnInput) {
  return {
    disciplina: input.resumo.disciplina,
    folhas: input.resumo.totalFolhas,
    prefeituras: input.prefeituras.length,
  };
}

/**
 * Roda um turno do agente. Nunca lança para erro de IA: em falha de parse,
 * degrada para o texto puro sem propostas (o usuário ainda vê a resposta).
 */
export async function runNexoAgentTurn(
  input: RunNexoAgentTurnInput,
): Promise<NexoAgentTurn> {
  const model = getAiConfiguration().nexoAgent.model;
  const ai = await executeOpenAiResponse({
    flow: "nexo-agent",
    model,
    operation: "nexo-agent-turn",
    metadata: buildTurnMetadata(input),
    request: buildTurnRequest(input, model),
    conversationId: input.conversationId,
    userEmail: input.userEmail,
  });

  const usage = extractTokenUsage(ai.response).totalTokens;
  const text = ai.text || extractResponseText(ai.response);

  const parsed = parseTail(text);
  const prosa = text.split(/```/)[0]?.trim() ?? "";
  const reply =
    (parsed.reply ?? "").trim() ||
    prosa ||
    "Segue a proposta abaixo — confira e confirme.";
  return {
    reply,
    proposals: normalizeProposals(parsed.proposals, {
      disciplina: input.resumo.disciplina,
      prefeituras: input.prefeituras,
    }),
    usage,
  };
}

export type NexoTurnEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      reply: string;
      proposals: NexoAgentProposal[];
      usage: number;
    };

/** O provider resolvido para o flow do Nexo consegue transmitir? */
export function providerSupportsStreaming(): boolean {
  return getNexoProvider() === "openai";
}

/**
 * Turno TRANSMITIDO. A prosa sai em deltas conforme chega; as propostas só no
 * fim (vêm na cauda JSON). Em qualquer falha de formato, degrada: se não houver
 * cauda, o turno termina com o texto que apareceu e zero propostas.
 */
export async function* runNexoAgentTurnStream(
  input: RunNexoAgentTurnInput,
  signal?: AbortSignal,
): AsyncGenerator<NexoTurnEvent, void, unknown> {
  const model = getAiConfiguration().nexoAgent.model;
  const state = createSplitState();
  let visible = "";
  let usage = 0;

  const stream = executeOpenAiResponseStream(
    {
      flow: "nexo-agent",
      model,
      operation: "nexo-agent-turn",
      metadata: buildTurnMetadata(input),
      request: buildTurnRequest(input, model),
      conversationId: input.conversationId,
      userEmail: input.userEmail,
    },
    signal,
  );

  for await (const event of stream) {
    if (event.type === "delta") {
      const chunk = pushChunk(state, event.text);
      if (chunk) {
        visible += chunk;
        yield { type: "delta", text: chunk };
      }
    } else {
      usage = event.usage;
    }
  }

  const { trailing, tail } = endStream(state);
  if (trailing) {
    visible += trailing;
    yield { type: "delta", text: trailing };
  }

  const parsed = parseTail(tail);
  // Rede de segurança: modelo mandou o JSON antigo inteiro (prosa vazia).
  const reply =
    visible.trim() ||
    (parsed.reply ?? "").trim() ||
    "Segue a proposta abaixo — confira e confirme.";
  if (!visible.trim() && reply) {
    yield { type: "delta", text: reply };
  }

  yield {
    type: "done",
    reply,
    proposals: normalizeProposals(parsed.proposals, {
      disciplina: input.resumo.disciplina,
      prefeituras: input.prefeituras,
    }),
    usage,
  };
}
