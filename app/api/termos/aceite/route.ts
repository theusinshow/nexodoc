/**
 * O ACEITE DO TERMO DE USO, por pessoa.
 *
 * GET diz se quem pergunta já aceitou a versão vigente; POST registra o aceite
 * (data/hora e versão) em `User`. Não toca no motor de auditoria nem no acesso:
 * só lê a sessão que `requireActor` já resolve e grava dois campos de `User`.
 *
 * Sem banco, a resposta traz `semBanco: true` e o cliente guarda o aceite no
 * navegador (ver `lib/aceite-dos-termos.ts`) — vale por aparelho, não por pessoa.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { VERSAO_DOS_TERMOS } from "@/lib/aviso-de-responsabilidade";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ aceito: false, semBanco: true, versao: VERSAO_DOS_TERMOS });
    }
    const usuario = await getPrisma().user.findUnique({
      where: { email: actor.email.trim().toLowerCase() },
      select: { termsAcceptedAt: true, termsVersion: true },
    });
    return NextResponse.json({
      aceito: Boolean(usuario?.termsAcceptedAt) && usuario?.termsVersion === VERSAO_DOS_TERMOS,
      aceitoEm: usuario?.termsAcceptedAt?.toISOString() ?? null,
      semBanco: false,
      versao: VERSAO_DOS_TERMOS,
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function POST() {
  try {
    const actor = await requireActor();
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ ok: true, semBanco: true, versao: VERSAO_DOS_TERMOS });
    }
    const aceitoEm = new Date();
    const { count } = await getPrisma().user.updateMany({
      where: { email: actor.email.trim().toLowerCase() },
      data: { termsAcceptedAt: aceitoEm, termsVersion: VERSAO_DOS_TERMOS },
    });
    if (count === 0) {
      return NextResponse.json({ ok: false, erro: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      semBanco: false,
      aceitoEm: aceitoEm.toISOString(),
      versao: VERSAO_DOS_TERMOS,
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
