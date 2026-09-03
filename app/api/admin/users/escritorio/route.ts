/**
 * LIBERAR alguém no escritório, e tirar de volta.
 *
 * Arquivo próprio, e não mais um campo no `PATCH` de `/api/admin/users`, porque
 * são duas coisas distintas: aquele mexe na CONTA (papel de plataforma, ativa ou
 * não), este mexe no VÍNCULO com a organização. Misturar os dois num corpo só
 * faria a rota ter que adivinhar a intenção de quem chamou.
 *
 * A regra é a mesma de [[app/api/organizacao/membros/route.ts]] — nasce
 * `INVITED`, sem conta, e o primeiro login ativa. O que muda é a porta: lá quem
 * convida é a coordenação do escritório; aqui é o operador da plataforma, pelo
 * painel, e por isso o portão é `checkAdminRequest`.
 */
import { NextResponse } from "next/server";

import { checkAdminRequest } from "@/lib/admin-gate";
import { registrarAcao } from "@/lib/trilha-administrativa";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

/*
 * Uma organização (a PROSUL), semeada na migration com id fixo. Quando houver a
 * segunda, este valor vira parâmetro do corpo — e a tela ganha um seletor. Está
 * escrito aqui porque uma constante silenciosa seria pior do que uma declarada.
 */
const ORG = "org-prosul";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const portao = await checkAdminRequest(request);
  if (!portao.ok) return jsonError(portao.message, portao.status);

  const corpo = (await request.json().catch(() => null)) as {
    email?: unknown;
    acao?: unknown;
    role?: unknown;
  } | null;

  const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const acao = corpo?.acao;

  if (!email || !email.includes("@")) {
    return jsonError("Informe um e-mail válido.", 400);
  }

  if (acao === "remover") {
    /*
     * Remover o vínculo NÃO apaga a conta: a pessoa continua entrando, e
     * continua sem ver projeto do escritório. Apagar a conta é a outra tela, e
     * é outra decisão.
     */
    await getPrisma().organizationMember.deleteMany({
      where: { organizationId: ORG, email },
    });

    await registrarAcao({
      quem: portao.email,
      acao: "escritorio",
      alcance: email,
      resumo: { acao: "remover", organizationId: ORG },
    });

    return NextResponse.json({ escritorio: null });
  }

  if (acao !== "liberar" && acao !== "papel") {
    return jsonError("Ação inválida.", 400);
  }

  const role = corpo?.role === "ADMIN" ? "ADMIN" : "MEMBER";

  if (acao === "papel") {
    const existente = await getPrisma().organizationMember.findFirst({
      where: { organizationId: ORG, email },
      select: { id: true },
    });

    if (!existente) {
      return jsonError("Essa pessoa não faz parte do escritório.", 404);
    }

    const membro = await getPrisma().organizationMember.update({
      where: { id: existente.id },
      data: { role },
      select: { role: true, status: true, organizationId: true },
    });

    await registrarAcao({
      quem: portao.email,
      acao: "escritorio",
      alcance: email,
      resumo: { acao: "papel", role },
    });

    return NextResponse.json({ escritorio: membro });
  }

  const membro = await getPrisma().organizationMember.upsert({
    where: { organizationId_email: { organizationId: ORG, email } },
    create: { organizationId: ORG, email, role, status: "INVITED" },
    /*
     * Liberar de novo quem já está dentro só ajusta o papel. Devolver alguém
     * ativo para `INVITED` seria tirar o acesso de quem já trabalha, sem que
     * ninguém tivesse pedido isso.
     */
    update: { role },
    select: { role: true, status: true, organizationId: true },
  });

  await registrarAcao({
    quem: portao.email,
    acao: "escritorio",
    alcance: email,
    resumo: { acao: "liberar", role, status: membro.status },
  });

  return NextResponse.json({ escritorio: membro }, { status: 201 });
}
