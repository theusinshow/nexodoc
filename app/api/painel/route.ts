/**
 * O que o painel da raiz precisa saber, numa chamada só.
 *
 * Uma rota, e não três (`/api/trabalho/meu` + `/api/projects` +
 * `/api/audits/recent`): a tela precisa dos projetos JÁ CRUZADOS com os achados
 * e os artefatos, e cruzar isso no navegador exigiria carregar a lista inteira
 * de projetos do escritório para descartar quase toda.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { isDatabaseConfigured } from "@/lib/db";
import { painelDe } from "@/lib/painel";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();

    /*
     * Sem banco, painel VAZIO e não erro — mesma decisão de
     * `/api/trabalho/meu`: a tela não deve gritar por uma seção que ela sabe
     * não ter como preencher. O orbe continua funcionando, que é o que importa.
     */
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        projetos: [],
        recentes: [],
        trabalho: { ondeParou: null, projetos: [] },
      });
    }

    return NextResponse.json(
      await painelDe({
        email: actor.email,
        userId: actor.userId,
        organizationId: actor.organizationId,
      }),
    );
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
