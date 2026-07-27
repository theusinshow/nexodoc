import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { aggregateUsage, type UsageRow } from "@/server/nexo/usage/aggregate";

export const runtime = "nodejs";

/** Resposta de "não há nada a mostrar" — o anel some, sem erro na tela. */
const VAZIO = { porModelo: [], porTarefa: [], totalTokens: 0, totalCostUsd: null };

/**
 * Consumo de IA de UMA conversa do Nexo, agregado por modelo e por tarefa.
 *
 * O `conversationId` é um UUID gerado no cliente: ele IDENTIFICA, não autentica.
 * Por isso a consulta filtra SEMPRE também pelo e-mail da sessão — sem isso,
 * adivinhar um id exporia o consumo de outra pessoa.
 */
export async function GET(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim();
  const userEmail = session.user.email;
  if (!conversationId || !userEmail || !isDatabaseConfigured()) {
    return NextResponse.json(VAZIO);
  }

  try {
    const events = (await getPrisma().aiUsageEvent.findMany({
      where: { conversationId, userEmail },
      select: {
        flow: true,
        model: true,
        totalTokens: true,
        estimatedCostUsd: true,
      },
    })) satisfies UsageRow[];

    return NextResponse.json(aggregateUsage(events));
  } catch (error) {
    // Informação acessória: falhar aqui não pode atrapalhar a conversa.
    console.error("[nexo-usage] falha ao agregar consumo", error);
    return NextResponse.json(VAZIO);
  }
}
