import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { aggregateUsage, type UsageRow } from "@/server/nexo/usage/aggregate";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

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

  /*
   * O PORTAO, DEPOIS da sessao.
   *
   * A checagem acima continua porque ela ESTREITA o tipo: o codigo abaixo le
   * `session.user` direto, e remove-la faria o TypeScript recusar cada leitura.
   * Mas ela nunca bastou -- responde "tem sessao?", e sessao sem escritorio
   * passava, deixando a rota util para quem nao pertence a lugar nenhum.
   *
   * As duas recusas independentes estao em [[lib/actor.ts]].
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
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
