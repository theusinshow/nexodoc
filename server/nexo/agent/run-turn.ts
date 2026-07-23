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
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { getAiConfiguration } from "@/lib/ai-providers";
import type { NexoAgentTurn } from "@/modules/nexo/types";
import { normalizeProposals } from "./normalize";

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

/** Fatia o primeiro objeto JSON do texto (tolerante a cercas ```json e prosa). */
function parseFirstJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
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
    "templateId"/"prefeitura" (mesma escolha da capa) e "numTomos".
  - "montar volume"/"monta o volume"/"junta tudo num volume" ->
    { "kind": "volume" } (sem campos).
  - "auditar"/"auditoria"/"revisar o memorial" -> { "kind": "auditoria" } com
    "nivel": "standard" (padrão) ou "deep" (só se ele pedir análise profunda).
- Para a capa, escolha o templateId da lista de prefeituras casando pelo NOME DA
  CIDADE que o engenheiro citou (ex.: "Chapecó" -> o template de Chapecó). Se ele
  não disse qual e há mais de uma, escolha a mais provável e peça confirmação.
  A separatriz usa a MESMA escolha de prefeitura/tomos da capa.
- Se faltar prefeitura para a capa/separatriz, proponha só a LD e comente no texto.
- TÍTULO DA LD: é DECISÃO do engenheiro — NÃO adivinhe. Deixe "tituloLd": "" e
  PERGUNTE no texto qual título ele quer na LD. A CAPA não tem título manual
  (obra e disciplina são automáticos) — não peça título de capa.
- VOLUME (só capa): se o engenheiro disser o volume ("volume 3", "vol 2", "no
  volume 4"), coloque só o NÚMERO arábico no campo "volume" (ex.: "3"). Se ele
  não disser, deixe "volume": "" (o sistema deriva do nome do arquivo).
- TOMOS: se ele disser "dividir em N tomos" / "N tomos", use numTomos=N (divide
  as folhas em N; LD e capa juntas). Se não mencionar, use numTomos=1.
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

Responda SOMENTE com um JSON válido nesta forma (sem texto fora do JSON):
{
  "reply": "texto curto afirmando os fatos e pedindo a confirmação/decisão",
  "proposals": [
    { "kind": "ld", "resumo": "LD <disciplina> · <código> · N folhas",
      "tituloLd": "", "numTomos": 1 },
    { "kind": "capa", "resumo": "Capa <prefeitura>", "templateId": "<id>",
      "volume": "", "numTomos": 1 },
    { "kind": "separatriz", "resumo": "Separatriz <prefeitura>",
      "templateId": "<id>", "numTomos": 1 },
    { "kind": "auditoria", "resumo": "Auditoria <disciplina>",
      "nivel": "standard" },
    { "kind": "conferencia", "resumo": "Conferência <disciplina>" },
    { "kind": "volume", "resumo": "Volume <disciplina>" }
  ]
}
Inclua no array proposals apenas os artefatos pedidos (0+; só os que o engenheiro
pediu neste turno).
`.trim();
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
    metadata: {
      disciplina: input.resumo.disciplina,
      folhas: input.resumo.totalFolhas,
      prefeituras: input.prefeituras.length,
    },
    request: {
      model,
      instructions:
        "Você é o Nexo: interpreta o pedido e propõe parâmetros de LD/capa. " +
        "Nunca gera documentos. Responde SEMPRE com um único JSON válido.",
      reasoning: { effort: getReasoningEffort() },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      input: buildPrompt(input),
    },
  });

  const text = ai.text || extractResponseText(ai.response);
  const parsed = parseFirstJsonObject(text) as {
    reply?: unknown;
    proposals?: unknown;
  } | null;

  if (!parsed) {
    return { reply: text || "Não consegui interpretar o pedido.", proposals: [] };
  }

  const reply =
    String(parsed.reply ?? "").trim() ||
    "Segue a proposta abaixo — confira e confirme.";
  return {
    reply,
    proposals: normalizeProposals(parsed.proposals, {
      disciplina: input.resumo.disciplina,
      prefeituras: input.prefeituras,
    }),
  };
}
