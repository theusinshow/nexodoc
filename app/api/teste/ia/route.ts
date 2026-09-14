/**
 * A FILA DE FALHAS da IA simulada — só existe no servidor da bateria.
 *
 * Um cenário da bateria pede "a próxima leitura global aborta" e o simulador
 * obedece. Fora do modo simulado a rota responde 404, como se não existisse:
 * em produção ela não pode nem ser descoberta. O portão de sessão fica mesmo
 * assim (`prova:rotas` exige), e as jornadas estão logadas.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import {
  comportamentoValido,
  enfileirar,
  iaSimuladaLigada,
  limparFila,
  verFila,
} from "@/lib/ia-simulada";

export const runtime = "nodejs";

async function portao() {
  if (!iaSimuladaLigada()) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  try {
    await requireActor();
    return null;
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function GET() {
  const barrado = await portao();
  if (barrado) return barrado;
  return NextResponse.json({ fila: verFila() });
}

export async function POST(request: Request) {
  const barrado = await portao();
  if (barrado) return barrado;

  const corpo = (await request.json().catch(() => null)) as {
    operation?: unknown;
    comportamento?: unknown;
  } | null;
  const operation = typeof corpo?.operation === "string" ? corpo.operation.trim() : "";
  const comportamento = typeof corpo?.comportamento === "string" ? corpo.comportamento : "";

  if (!operation || !comportamentoValido(comportamento)) {
    return NextResponse.json(
      { error: "Envie { operation, comportamento } com um comportamento conhecido." },
      { status: 400 },
    );
  }

  enfileirar(operation, comportamento);
  return NextResponse.json({ fila: verFila() });
}

export async function DELETE() {
  const barrado = await portao();
  if (barrado) return barrado;
  limparFila();
  return NextResponse.json({ fila: [] });
}
