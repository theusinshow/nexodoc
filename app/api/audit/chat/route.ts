/**
 * O CHAT PÓS-PARECER — reescrito em 25/08/2026.
 *
 * A versão anterior estava MORTA desde que as telas standalone foram
 * aposentadas, e mesmo viva só enxergava o JSON compactado do parecer: o prompt
 * dela mandava literalmente "não diga que releu o PDF". Agora a rota carrega o
 * texto guardado da auditoria (`AuditText`) e roda um laço de ferramentas —
 * quem responde ONDE ESTÁ é o código, não o modelo.
 *
 * A rota é fina de propósito: o cérebro mora em `server/audit/chat/`, espelhando
 * a separação que `server/nexo/agent/` já usa.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { auditByIdWhereForActor } from "@/lib/audit-access";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import {
  classifyProviderFailure,
  getAiConfiguration,
  getAuditExecutionProfile,
  type AiProvider,
} from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import type { AuditReport } from "@/lib/audit-report";
import type { Actor } from "@/lib/actor";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { carregarMemoriaDoDocumento } from "@/lib/memoria-do-documento";
import { aplicarAchadoNoParecer, montarContexto } from "@/server/audit/chat/ferramentas";
import { historicoDaObra } from "@/server/audit/chat/historico";
import { runChatTurn } from "@/server/audit/chat/run-chat-turn";
import { linhaSse, respostaDoModelo } from "./serializacao";

export const runtime = "nodejs";

const VALID_ID = /^[A-Za-z0-9-]{8,80}$/;

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

function withCors<T extends Response>(response: T, request?: Request): T {
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

/**
 * O chat responde SOBRE UM RELATÓRIO QUE JÁ EXISTE, e agora com o documento ao
 * alcance. Isso não pede deliberação, pede resposta rápida — o padrão saiu de
 * `medium` para `low` em 11/08/2026, pelo mesmo motivo que o agente Nexo já
 * nascia em `low`.
 *
 * Suba para `medium` em `NEXODOC_CHAT_REASONING_EFFORT` se ele começar a errar a
 * escolha da ferramenta — o sintoma é resposta rápida e errada, não lenta.
 */
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

  return "low";
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

/**
 * O achado nascido na conversa é gravado no `Audit.report`.
 *
 * Best-effort de propósito: o cliente também funde o achado no IndexedDB (o
 * parecer persiste em DOIS lugares), então falhar aqui não faz o engenheiro
 * perder o achado da tela. Mas o log tem de existir — sem banco o achado some
 * no próximo F5 e ninguém saberia por quê.
 */
async function gravarAchadoNoParecer(auditId: string, report: AuditReport, actor: Actor) {
  if (!isDatabaseConfigured()) return;

  try {
    const prisma = getPrisma();
    await prisma.audit.updateMany({
      where: auditByIdWhereForActor(auditId, actor),
      data: {
        report: report as never,
        totalFindings: report.total_incongruencias,
      },
    });
  } catch (error) {
    console.error("[audit-chat] falha ao gravar o achado nascido no chat", error);
  }
}

export async function POST(request: Request) {
  /*
   * O PORTÃO. Esta rota não pedia NADA -- nem sessão.
   */
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  let executionProfile: { provider: AiProvider; model: string } = getAiConfiguration().auditChat;

  let body: {
    question?: string;
    report?: AuditReport;
    history?: ChatTurn[];
    auditId?: string;
    projectId?: string | null;
  };

  try {
    await refreshAiModelOverrideCache();
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Corpo da requisição inválido.", 400, request);
  }

  const question = String(body.question ?? "").trim();
  if (!question) {
    return jsonError("Informe uma pergunta sobre a auditoria.", 400, request);
  }
  if (!body.report || !Array.isArray(body.report.incongruencias)) {
    return jsonError("Relatório da auditoria não informado.", 400, request);
  }

  const auditId = String(body.auditId ?? "").trim();
  if (auditId && !VALID_ID.test(auditId)) {
    return jsonError("Identificador de auditoria inválido.", 400, request);
  }

  /*
   * O ID DO NAVEGADOR NÃO É AUTORIDADE. Primeiro resolvemos a auditoria dentro
   * do escritório; só então seu texto, projeto e parecer podem entrar no turno.
   * Sem `auditId`, o chat continua funcionando sobre o parecer local, mas não
   * ganha acesso ao acervo apenas porque recebeu um `projectId` no corpo.
   */
  let projectIdAutorizado: string | null = null;
  if (auditId && isDatabaseConfigured()) {
    const audit = await getPrisma().audit.findFirst({
      where: auditByIdWhereForActor(auditId, actor),
      select: { id: true, projectId: true },
    });

    if (!audit) {
      return jsonError("Auditoria não encontrada.", 404, request);
    }

    projectIdAutorizado = audit.projectId;
  }
  const history = Array.isArray(body.history)
    ? body.history.filter((t) => t.role === "user" || t.role === "assistant").slice(-6)
    : [];

  const analysisLevel = body.report.runtime?.nivel_analise === "deep" ? "deep" : "standard";
  if (body.report.tipo_auditoria !== "volume") {
    executionProfile = getAuditExecutionProfile({ auditMode: "memorial", analysisLevel });
  }
  const model = executionProfile.model;

  /*
   * O texto guardado. Vetor vazio = parecer antigo: o laço entra em modo
   * degradado e o modelo é instruído a DIZER que não tem o documento.
   */
  const memorias = auditId ? await carregarMemoriaDoDocumento(auditId) : [];
  // Cópia do parecer: o laço acrescenta o achado novo ao contexto do turno, e
  // mutar o objeto que veio do cliente confunde quem grava.
  const ctx = montarContexto({ ...body.report }, memorias);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(linhaSse(payload)));

      try {
        for await (const evento of runChatTurn({
          ctx,
          pergunta: question,
          historico: history,
          historicoDaObra: () =>
            historicoDaObra({
              auditId,
              organizationId: actor.organizationId,
              projectId: projectIdAutorizado,
            }),
          /*
           * O encaminhamento é resolvido no CLIENTE. `runNexoAgentTurn` precisa
           * de `resumo`, `prefeituras`, `escritorio`, `tomosSugeridos` e
           * `decisoes`, montados em 180 linhas de `app/api/nexo/agent/route.ts`
           * que esta rota não tem — duplicá-las criaria duas fontes para a
           * mesma verdade. Aqui só avisamos que o turno é de geração.
           */
          encaminhar: async (pedido) => {
            send({ type: "encaminhar", pedido });
            return null;
          },
          aoRegistrar: async (achado) => {
            const atualizado = aplicarAchadoNoParecer(body.report!, achado);
            body.report = atualizado;
            if (auditId) await gravarAchadoNoParecer(auditId, atualizado, actor);
          },
          executar: async ({ input, tools, volta }) => {
            const ai = await executeOpenAiResponse({
              flow: "audit-chat",
              providerOverride: executionProfile.provider,
              taskId: auditId || undefined,
              taskLabel: body.report?.obra || body.report?.arquivo || "Pós-auditoria",
              model,
              operation: "audit-chat-turn",
              metadata: {
                volta,
                comMemoria: memorias.length > 0,
                findings: body.report?.incongruencias.length ?? 0,
                historyTurns: history.length,
                analysisLevel,
              },
              request: {
                model,
                instructions:
                  "Você é o auditor sênior do NexoDoc respondendo sobre um parecer já emitido, " +
                  "com o documento ao alcance por ferramentas.",
                reasoning: { effort: getReasoningEffort() },
                max_output_tokens: Number(process.env.NEXODOC_CHAT_MAX_OUTPUT_TOKENS ?? 1400),
                input: input as never,
                ...(tools.length > 0 ? { tools } : {}),
              },
            });
            return respostaDoModelo(ai);
          },
        })) {
          if (evento.type === "achado") {
            // O achado sai COM o parecer inteiro: o cliente funde os dois de uma
            // vez e regrava no IndexedDB sem precisar recompor a lista.
            send({ type: "achado", achado: evento.achado, report: body.report });
          } else if (evento.type !== "proposta") {
            send(evento);
          }
        }
      } catch (error) {
        const failure = classifyProviderFailure(
          executionProfile.provider,
          "audit-chat",
          model,
          error,
        );
        console.error(`[audit-chat] falha (${failure.category})`);
        /*
         * O erro viaja DENTRO do SSE, com status 200: o fluxo já começou, e
         * trocar o status a essa altura não chega ao cliente.
         */
        send({
          type: "error",
          error:
            failure.category !== "unknown"
              ? failure.message
              : error instanceof Error
                ? error.message
                : "Não foi possível responder sobre a auditoria.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return withCors(
    new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Sem isto, proxies com buffer seguram os eventos e o progresso some.
        "X-Accel-Buffering": "no",
      },
    }),
    request,
  );
}
