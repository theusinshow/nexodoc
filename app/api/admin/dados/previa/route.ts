/**
 * A PRÉVIA — o que o expurgo vai levar, contado no banco.
 *
 * Não estima. Roda a MESMA resolução de alcance que a execução vai rodar, no
 * mesmo banco, e devolve contagens de verdade. Uma prévia por outro caminho
 * seria pior que nenhuma: daria confiança calibrada num número que não é o que
 * vai acontecer.
 *
 * `POST` e não `GET` porque o alcance "seleção" carrega uma lista de ids que não
 * cabe honestamente numa query string. Não muda nada no servidor.
 */
import { NextResponse } from "next/server";

import { checkAdminRequest } from "@/lib/admin-gate";
import { previaDoExpurgo } from "@/server/admin/expurgo";
import { lerAlcance } from "@/server/admin/alcance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const portao = await checkAdminRequest(request);

  if (!portao.ok) {
    return NextResponse.json({ error: portao.message }, { status: portao.status });
  }

  const corpo = await request.json().catch(() => null);
  const alcance = lerAlcance(corpo);

  if (!alcance) {
    return NextResponse.json({ error: "Alcance inválido." }, { status: 400 });
  }

  return NextResponse.json({ previa: await previaDoExpurgo(alcance) });
}
