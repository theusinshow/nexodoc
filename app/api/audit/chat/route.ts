import { NextResponse } from "next/server";

import type { AuditReport } from "@/lib/audit-report";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gpt-5.4-mini";
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

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
  response.headers.set("Access-Control-Allow-Origin", request ? getAllowedOrigin(request) : "*");
  response.headers.set("Vary", "Origin");

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

function jsonError(message: string, status = 400, request?: Request) {
  return withCors(NextResponse.json({ error: message }, { status }), request);
}

function extractResponseText(response: unknown) {
  const candidate = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof candidate.output_text === "string") {
    return candidate.output_text.trim();
  }

  return (
    candidate.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text)
      .filter((item): item is string => Boolean(item))
      .join("\n")
      .trim() ?? ""
  );
}

function getReasoningEffort() {
  const effort = process.env.NEXODOC_CHAT_REASONING_EFFORT;

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

  return "medium";
}

function compactReport(report: AuditReport) {
  return {
    projeto: {
      arquivo: report.arquivo,
      obra: report.obra,
      codigo: report.codigo,
      municipio: report.municipio,
      data: report.data_documento,
      status: report.status_geral,
      conclusao: report.conclusao,
    },
    arquivos: report.arquivos_analisados,
    comparacoes: report.comparacoes,
    achados: report.incongruencias.map((finding) => ({
      id: finding.id,
      prioridade: finding.prioridade,
      impacto: finding.impacto,
      arquivo: finding.arquivo,
      pagina: finding.pagina,
      capitulo: finding.capitulo,
      local: finding.local,
      tipo: finding.tipo,
      descricao: finding.descricao,
      evidencia: finding.evidencia,
      termo_busca: finding.termo_busca,
      conflito: finding.conflito,
      acao: finding.sugestao_correcao,
      categoria: finding.categoria,
      referencia: finding.referencia_comparada,
      confianca: finding.confianca,
    })),
  };
}

function getChatPrompt(args: {
  question: string;
  report: AuditReport;
  history: ChatTurn[];
}) {
  return `
Você é o assistente de pós-auditoria do NexoDoc. Responda a pergunta do usuário usando somente o relatório estruturado abaixo.

Regras:
- Explique o "porquê" dos achados quando solicitado.
- Cite IDs dos achados, páginas prováveis, evidências e termos de busca quando forem relevantes.
- Diferencie erro crítico documental, ponto técnico/contratual e revisão editorial.
- Se o usuário pedir algo que não está no relatório, diga que a evidência não consta na auditoria atual e sugira qual documento ou trecho validar.
- Não diga que releu o PDF. Nesta conversa você está interpretando o relatório já gerado.
- Seja direto, técnico e útil para um escritório de engenharia.

Histórico recente:
${args.history.map((turn) => `${turn.role}: ${turn.content.slice(0, 1200)}`).join("\n\n") || "Sem histórico."}

Pergunta do usuário:
${args.question}

Relatório estruturado:
${JSON.stringify(compactReport(args.report), null, 2)}
`.trim();
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      report?: AuditReport;
      history?: ChatTurn[];
    };
    const question = String(body.question ?? "").trim();

    if (!question) {
      return jsonError("Informe uma pergunta sobre a auditoria.", 400, request);
    }

    if (!body.report || !Array.isArray(body.report.incongruencias)) {
      return jsonError("Relatório da auditoria não informado.", 400, request);
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter((turn) => turn.role === "user" || turn.role === "assistant")
          .slice(-6)
      : [];
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      instructions: "Você responde perguntas pós-auditoria documental com base estrita no relatório fornecido.",
      reasoning: { effort: getReasoningEffort() },
      max_output_tokens: Number(process.env.NEXODOC_CHAT_MAX_OUTPUT_TOKENS ?? 1400),
      input: getChatPrompt({ question, report: body.report, history }),
    });
    const answer = extractResponseText(response);

    if (!answer) {
      throw new Error("Resposta vazia do modelo.");
    }

    return withCors(NextResponse.json({ answer }), request);
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return jsonError("OPENAI_API_KEY não configurada no backend.", 500, request);
    }

    return jsonError(
      error instanceof Error ? error.message : "Não foi possível responder sobre a auditoria.",
      500,
      request,
    );
  }
}
