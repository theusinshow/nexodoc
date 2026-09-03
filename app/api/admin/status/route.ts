/**
 * O VEREDITO, sozinho — para o trilho que o mostra em toda tela.
 *
 * Existe para NÃO chamar `/api/admin/overview` a cada navegação: aquela rota
 * faz dez contagens e monta duas listas para desenhar a visão geral, e o trilho
 * só precisa de uma linha de texto. A coleta é compartilhada
 * ([[lib/fatos-do-sistema.ts]]), então as duas nunca discordam.
 */
import { NextResponse } from "next/server";

import { checkAdminRequest } from "@/lib/admin-gate";
import { coletarStatusDoSistema } from "@/lib/fatos-do-sistema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const portao = await checkAdminRequest(request);

  if (!portao.ok) {
    return NextResponse.json({ error: portao.message }, { status: portao.status });
  }

  return NextResponse.json({
    status: await coletarStatusDoSistema(),
    generatedAt: new Date().toISOString(),
  });
}
