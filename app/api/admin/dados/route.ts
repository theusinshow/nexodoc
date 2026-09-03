/**
 * O que a tela de Dados lista: as conversas do servidor, com a obra resolvida.
 *
 * Sem o `data` de cada uma — ver [[server/admin/expurgo.ts]]. Esta tela mostra
 * TODAS as conversas de TODOS os donos, e o JSON de cada uma traria dezenas de
 * megabytes para desenhar uma lista.
 */
import { NextResponse } from "next/server";

import { checkAdminRequest } from "@/lib/admin-gate";
import { listarConversas } from "@/server/admin/expurgo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const portao = await checkAdminRequest(request);

  if (!portao.ok) {
    return NextResponse.json({ error: portao.message }, { status: portao.status });
  }

  return NextResponse.json({
    conversas: await listarConversas(),
    generatedAt: new Date().toISOString(),
  });
}
