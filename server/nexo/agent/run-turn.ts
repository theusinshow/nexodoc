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
import type { NexoAgentProposal, NexoAgentTurn } from "@/modules/nexo/types";

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

function clampTomos(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

/**
 * Normaliza a saída crua do modelo em NexoAgentProposal[] confiável: descarta
 * kinds inválidos, mapeia a prefeitura para um templateId real, e preenche
 * defaults determinísticos (título do selo, tomos=1) quando a IA omite.
 */
function normalizeProposals(
  raw: unknown,
  input: RunNexoAgentTurnInput,
): NexoAgentProposal[] {
  if (!Array.isArray(raw)) return [];
  const firstTemplateId = input.prefeituras[0]?.id ?? "";

  const out: NexoAgentProposal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const kind = p.kind;

    if (kind === "ld") {
      out.push({
        kind: "ld",
        resumo: String(p.resumo ?? "").trim() || `LD ${input.resumo.disciplina}`,
        params: {
          // Título é decisão do engenheiro: nunca adivinhar (fica vazio).
          tituloLd: String(p.tituloLd ?? "").trim(),
          numTomos: clampTomos(p.numTomos),
        },
      });
    } else if (kind === "capa") {
      // A IA pode devolver templateId direto ou o nome da prefeitura; mapear.
      const wantedId = String(p.templateId ?? "").trim();
      const wantedNome = String(p.prefeitura ?? "").trim().toLowerCase();
      const match =
        input.prefeituras.find((t) => t.id === wantedId) ??
        (wantedNome
          ? input.prefeituras.find((t) =>
              t.nome.toLowerCase().includes(wantedNome),
            )
          : undefined);
      const templateId = match?.id ?? (wantedId || firstTemplateId);
      if (!templateId) continue; // sem prefeitura configurada, não propõe capa
      const volumeRaw = String(p.volume ?? "").trim();
      out.push({
        kind: "capa",
        resumo:
          String(p.resumo ?? "").trim() ||
          `Capa ${match?.nome ?? input.resumo.disciplina}`,
        params: {
          templateId,
          // Título é decisão do engenheiro: nunca adivinhar (fica vazio).
          tituloCapa: String(p.tituloCapa ?? "").trim(),
          // só dígitos; senão "" (deriva do nome do arquivo no builder)
          volume: /^\d+$/.test(volumeRaw) ? volumeRaw : "",
          numTomos: clampTomos(p.numTomos),
        },
      });
    }
  }
  return out;
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
- Se o pedido menciona LD, capa, ou "as duas / tudo", proponha o que couber.
- Para a capa, escolha o templateId da lista de prefeituras. Se o engenheiro não
  disse qual e há mais de uma, escolha a mais provável e peça confirmação no texto.
- Se faltar prefeitura para a capa, proponha só a LD e comente no texto.
- TÍTULO: é DECISÃO do engenheiro — NÃO adivinhe. Deixe SEMPRE vazio
  ("tituloLd": "", "tituloCapa": "") e PERGUNTE no texto qual título ele quer
  para a LD e para a capa (ex.: "Qual título você quer na LD e na capa?").
- VOLUME (só capa): se o engenheiro disser o volume ("volume 3", "vol 2", "no
  volume 4"), coloque só o NÚMERO arábico no campo "volume" (ex.: "3"). Se ele
  não disser, deixe "volume": "" (o sistema deriva do nome do arquivo).
- TOMOS: se ele disser "N tomos" / "divide em N", use numTomos=N (LD e capa
  juntas). Senão numTomos=1.
- Se o pedido não for sobre gerar LD/capa, responda conversando, com proposals: [].
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
      "tituloLd": "<título>", "numTomos": 1 },
    { "kind": "capa", "resumo": "Capa <prefeitura>", "templateId": "<id>",
      "tituloCapa": "<título>", "volume": "", "numTomos": 1 }
  ]
}
Inclua no array proposals apenas os artefatos pedidos (pode ser 0, 1 ou 2).
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
  return { reply, proposals: normalizeProposals(parsed.proposals, input) };
}
