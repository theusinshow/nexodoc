/**
 * O que exige ação SUA.
 *
 * Não existe "enviados por mim" aqui, e é decisão: a home é o que pede trabalho
 * de você. O que você delegou não pede — e transformá-la em caixa de saída a
 * encheria de informação que ninguém precisa ver todo dia. Quem quiser conferir
 * o que mandou abre a auditoria, que é onde a pergunta nasce.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { isDatabaseConfigured } from "@/lib/db";
import { pendenciasDe } from "@/lib/fila-de-achados";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();

    /*
     * Sem banco a resposta é uma fila VAZIA, e não um erro: a home não deve
     * gritar por causa de uma seção que ela sabe não ter como preencher.
     */
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ pendencias: [] });
    }

    return NextResponse.json({
      pendencias: await pendenciasDe(actor.email, actor.organizationId),
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
