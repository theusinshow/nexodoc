/**
 * O EXPURGO — apaga, grava a lápide e registra quem mandou.
 *
 * A CONFIRMAÇÃO É CONFERIDA AQUI, e não só na tela. O campo de digitação do
 * navegador é conveniência; a regra tem que valer para qualquer cliente que
 * chame esta rota, senão ela é decoração.
 */
import { NextResponse } from "next/server";

import { checkAdminRequest } from "@/lib/admin-gate";
import { confirmacaoConfere, palavraDeConfirmacao } from "@/lib/expurgo";
import { executarExpurgo } from "@/server/admin/expurgo";
import { lerAlcance } from "@/server/admin/alcance";
import { registrarAcao } from "@/lib/trilha-administrativa";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const portao = await checkAdminRequest(request);

  if (!portao.ok) {
    return NextResponse.json({ error: portao.message }, { status: portao.status });
  }

  const corpo = (await request.json().catch(() => null)) as {
    confirmacao?: unknown;
    rotulo?: unknown;
  } | null;
  const alcance = lerAlcance(corpo);

  if (!alcance) {
    return NextResponse.json({ error: "Alcance inválido." }, { status: 400 });
  }

  const rotulo = typeof corpo?.rotulo === "string" ? corpo.rotulo : undefined;
  const esperado = palavraDeConfirmacao(alcance, rotulo);
  const digitado = typeof corpo?.confirmacao === "string" ? corpo.confirmacao : "";

  if (!confirmacaoConfere(digitado, esperado)) {
    return NextResponse.json(
      { error: `Digite "${esperado}" para confirmar.` },
      { status: 400 },
    );
  }

  const apagado = await executarExpurgo(alcance, portao.email);

  const descricaoDoAlcance =
    alcance.tipo === "obra"
      ? `obra:${alcance.chave}`
      : alcance.tipo === "tudo"
        ? "tudo"
        : "selecao";

  await registrarAcao({
    quem: portao.email,
    acao: "expurgo",
    alcance: descricaoDoAlcance,
    resumo: { ...apagado, rotulo },
  });

  return NextResponse.json({ ok: true, apagado });
}
