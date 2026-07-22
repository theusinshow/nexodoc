import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getTemplateRegistry } from "@/server/templates/registry";
import { buildLdProposal, type SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  runNexoAgentTurn,
  type NexoAgentPrefeitura,
} from "@/server/nexo/agent/run-turn";

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

  let message: string;
  let history: ChatTurn[];
  let selos: SeloForLd[];
  try {
    const body = (await req.json()) as {
      message?: unknown;
      history?: unknown;
      selos?: unknown;
    };
    message = String(body.message ?? "").trim();
    if (!message) throw new Error("mensagem ausente");
    history = Array.isArray(body.history)
      ? (body.history as ChatTurn[])
          .filter((t) => t?.role === "user" || t?.role === "assistant")
          .map((t) => ({ role: t.role, content: String(t.content ?? "") }))
      : [];
    selos = Array.isArray(body.selos) ? (body.selos as SeloForLd[]) : [];
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  // Sem selos não há fatos: guarda determinística (afirma o próximo passo).
  if (selos.length === 0) {
    return NextResponse.json({
      turn: {
        reply:
          "Primeiro anexe as pranchas de uma disciplina e toque em “Ler pranchas”. " +
          "Assim eu leio os selos e proponho a LD e a capa.",
        proposals: [],
      },
    });
  }

  // Fatos determinísticos a partir dos selos (mesma fonte da geração).
  const proposal = buildLdProposal(selos);
  const resumo = {
    disciplina: proposal.resumo.disciplina,
    codigo: proposal.resumo.codigo,
    revisao: proposal.resumo.revisao,
    obra: proposal.resumo.obra,
    totalFolhas: proposal.resumo.totalFolhas,
    tituloSugerido: proposal.input.ldData.sectionTitle,
  };

  const registry = await getTemplateRegistry();
  const prefeituras: NexoAgentPrefeitura[] = registry.map((t) => ({
    id: t.id,
    nome: (t.grupo ?? t.nome) + (t.variante ? ` — ${t.variante}` : ""),
  }));

  // Pré-visualização determinística da LD: as folhas que vão para o documento,
  // já ordenadas. Deixa o engenheiro conferir antes de gerar (ex.: uma folha que
  // não chegou). Independe do que a IA propõe.
  const ldPreview = {
    rows: proposal.input.rows.map((r) => ({
      sheet: r.sheet,
      file: r.file,
      description: r.description,
    })),
    totalFolhas: proposal.resumo.totalFolhas,
    referenceTotal: proposal.input.referenceTotal ?? null,
  };

  try {
    const turn = await runNexoAgentTurn({ message, history, resumo, prefeituras });
    return NextResponse.json({ turn, ldPreview });
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
