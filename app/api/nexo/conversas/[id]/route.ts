import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

/**
 * UMA conversa do Nexo no servidor — abrir e apagar.
 *
 * Como na rota irmã, o `id` identifica mas não autentica: as duas operações
 * filtram pelo e-mail da sessão. Pedir um id que existe mas é de outra pessoa
 * responde 404, e não 403, de propósito — 403 confirmaria que o id existe.
 */

async function guarda() {
  if (!isNexoEnabled()) {
    return { erro: NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 }) };
  }
  /*
   * O PORTAO no lugar da checagem de sessao.
   *
   * Aqui deu para trocar de vez, e nao somar: a guarda so precisava do e-mail,
   * e o ator ja o traz garantido. `requireActor` recusa quem nao e membro ativo
   * de escritorio -- pergunta que "tem sessao?" nunca fez.
   */
  try {
    const actor = await requireActor();
    return { userEmail: actor.email };
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return { erro: negado };
    throw err;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guarda();
  if (g.erro) return g.erro;
  const { id } = await ctx.params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "sem servidor" }, { status: 404 });
  }

  try {
    const linha = await getPrisma().nexoConversation.findFirst({
      where: { id, userEmail: g.userEmail },
      select: { data: true },
    });
    if (!linha) return NextResponse.json({ error: "não encontrada" }, { status: 404 });
    return NextResponse.json(linha.data);
  } catch (error) {
    console.error("[nexo-conversas] falha ao ler", error);
    return NextResponse.json({ error: "falha ao ler do servidor" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guarda();
  if (g.erro) return g.erro;
  const { id } = await ctx.params;
  // Sem banco não há o que apagar no servidor, e o cliente já apagou o local.
  if (!isDatabaseConfigured()) return NextResponse.json({ ok: true });

  try {
    // `deleteMany` com o e-mail no filtro: `delete` por id apagaria a conversa
    // de outra pessoa antes de qualquer checagem.
    const { count } = await getPrisma().nexoConversation.deleteMany({
      where: { id, userEmail: g.userEmail },
    });
    return NextResponse.json({ ok: true, apagadas: count });
  } catch (error) {
    console.error("[nexo-conversas] falha ao apagar", error);
    return NextResponse.json({ error: "falha ao apagar no servidor" }, { status: 500 });
  }
}
