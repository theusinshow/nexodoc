import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getTemplateRegistry } from "@/server/templates/registry";
import { buildLdProposal, type SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  runNexoAgentTurn,
  runNexoAgentTurnStream,
  providerSupportsStreaming,
  type NexoAgentPrefeitura,
} from "@/server/nexo/agent/run-turn";
import { buildSlotRequestForTurn } from "@/server/nexo/agent/slot-request";
import { fatosDaConversa, type FatosDoMemorial } from "@/server/nexo/agent/fatos";

export const runtime = "nodejs";

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Turno do agente Nexo (Fase 2). Recebe a mensagem + o histórico + os selos já
 * lidos das pranchas. Deriva os FATOS determinísticos (buildLdProposal) e a
 * lista de prefeituras, e delega a interpretação ao cérebro (run-turn). A
 * geração NÃO acontece aqui — o cliente confirma e chama /api/nexo/ld|capa.
 */
export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  // Extraído para uma const própria: `session.user.email` narrowed no closure
  // do stream (abaixo) volta a "possibly undefined" pro TS através da borda de
  // função — esta const carrega o narrowing sem depender da árvore de escopo.
  const userEmail = session.user.email;

  let message: string;
  let history: ChatTurn[];
  let selos: SeloForLd[];
  let memorial: FatosDoMemorial | null;
  let conversationId: string | null;
  try {
    const body = (await req.json()) as {
      message?: unknown;
      history?: unknown;
      selos?: unknown;
      memorial?: unknown;
      conversationId?: unknown;
    };
    message = String(body.message ?? "").trim();
    if (!message) throw new Error("mensagem ausente");
    history = Array.isArray(body.history)
      ? (body.history as ChatTurn[])
          .filter((t) => t?.role === "user" || t?.role === "assistant")
          .map((t) => ({ role: t.role, content: String(t.content ?? "") }))
      : [];
    selos = Array.isArray(body.selos) ? (body.selos as SeloForLd[]) : [];
    memorial =
      body.memorial && typeof body.memorial === "object"
        ? (body.memorial as FatosDoMemorial)
        : null;
    conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : null;
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  /*
   * A recusa agora é sobre FATOS, não sobre selos. Um memorial não tem selo de
   * prancha: exigir selos impedia auditar memorial pelo chat, que é o caminho
   * principal do produto agora.
   */
  const fatos = fatosDaConversa(selos, memorial);
  if (!fatos.temFatos) {
    return NextResponse.json({
      turn: {
        reply:
          "Anexe as pranchas de uma disciplina (eu leio os selos e proponho a LD e a capa) " +
          "ou o memorial descritivo (eu audito contra a obra declarada).",
        proposals: [],
      },
    });
  }

  /*
   * Fatos determinísticos. Com pranchas, saem dos selos (mesma fonte da
   * geração). Só com memorial, saem da classificação — o agente precisa saber
   * sobre o que está falando, senão volta a inventar.
   */
  const proposal = fatos.temSelos ? buildLdProposal(selos) : null;
  const resumo = proposal
    ? {
        disciplina: proposal.resumo.disciplina,
        codigo: proposal.resumo.codigo,
        revisao: proposal.resumo.revisao,
        obra: proposal.resumo.obra,
        totalFolhas: proposal.resumo.totalFolhas,
        tituloSugerido: proposal.input.ldData.sectionTitle,
      }
    : {
        disciplina: "",
        codigo: memorial?.codigo ?? "",
        revisao: "",
        obra: fatos.gabarito.obra ?? "",
        totalFolhas: 0,
        tituloSugerido: "",
      };

  const registry = await getTemplateRegistry();
  const prefeituras: NexoAgentPrefeitura[] = registry.map((t) => ({
    id: t.id,
    nome: (t.grupo ?? t.nome) + (t.variante ? ` — ${t.variante}` : ""),
  }));

  // Pré-visualização determinística da LD: as folhas que vão para o documento,
  // já ordenadas. Deixa o engenheiro conferir antes de gerar (ex.: uma folha que
  // não chegou). Independe do que a IA propõe.
  const ldPreview = proposal
    ? {
        rows: proposal.input.rows.map((r) => ({
          sheet: r.sheet,
          file: r.file,
          description: r.description,
        })),
        totalFolhas: proposal.resumo.totalFolhas,
        referenceTotal: proposal.input.referenceTotal ?? null,
      }
    : null;

  // Pós-processamento determinístico: se ainda falta uma DECISÃO humana (ex.:
  // título da LD), anexa o slotRequest com pré-respostas (§3). A IA não decide
  // isto — o SlotResolver puro decide a partir dos params já propostos.
  const now = new Date();
  const slotContext = {
    selos,
    disciplina: resumo.disciplina,
    obra: resumo.obra,
    prefeituras,
    mesAtual: now.getMonth() + 1,
    anoAtual: now.getFullYear(),
  };

  const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream");

  // Caminho TRANSMITIDO: a prosa sai em deltas; propostas/slotRequest/ldPreview
  // só no `done` (dependem da cauda JSON, que chega no fim).
  if (wantsStream && providerSupportsStreaming()) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        try {
          for await (const event of runNexoAgentTurnStream(
            {
              message,
              history,
              resumo,
              prefeituras,
              conversationId,
              userEmail,
            },
            req.signal,
          )) {
            if (event.type === "delta") {
              send({ type: "delta", text: event.text });
            } else {
              send({
                type: "done",
                proposals: event.proposals,
                slotRequest: buildSlotRequestForTurn(event.proposals, slotContext) ?? null,
                ldPreview,
                usage: event.usage,
              });
            }
          }
        } catch (err) {
          // Abortar não é falha: o usuário apertou parar.
          if (!req.signal.aborted) {
            send({
              type: "error",
              error:
                err instanceof Error ? err.message : "Falha ao processar a conversa.",
            });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Sem isto, proxies com buffer seguram os deltas e o streaming some.
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Caminho de sempre (não-SSE / provider sem streaming): resposta única.
  try {
    const turn = await runNexoAgentTurn({
      message,
      history,
      resumo,
      prefeituras,
      conversationId,
      userEmail,
    });
    const slotRequest = buildSlotRequestForTurn(turn.proposals, slotContext);
    return NextResponse.json({ turn: { ...turn, slotRequest }, ldPreview });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Falha ao processar a conversa.",
      },
      { status: 502 },
    );
  }
}
