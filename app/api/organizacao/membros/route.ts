/**
 * Quem faz parte do escritório.
 *
 * Era a única tabela do schema que nenhuma linha do aplicativo escrevia: sem
 * isto, `OrganizationMember` só é preenchido por script de migração, e não há
 * como a PROSUL acrescentar alguém.
 *
 * O CONVITE NASCE SEM CONTA, e é o ponto: `status: INVITED`, `userId` nulo,
 * porque a pessoa pode nunca ter entrado. É o que vai permitir ATRIBUIR um
 * achado ao Victor antes de ele ter logado pela primeira vez — modelar o
 * responsável como `User` tornaria isso impossível, e o primeiro dia de uso é
 * exatamente quando a coordenação quer distribuir trabalho.
 *
 * A ativação acontece no primeiro login, em [[lib/access-control.ts]].
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ membros: [] });
    }

    const membros = await getPrisma().organizationMember.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, email: true, name: true, role: true, status: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
    });

    return NextResponse.json({ membros });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();

    /*
     * Convidar é ato de coordenação, pela mesma razão que cadastrar projeto é:
     * quem entra no escritório passa a ver todos os projetos dele.
     */
    if (actor.orgRole === "MEMBER" && !actor.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Só a coordenação do escritório convida." },
        { status: 403 },
      );
    }

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }

    const corpo = (await request.json().catch(() => null)) as {
      email?: unknown;
      name?: unknown;
      role?: unknown;
    } | null;
    const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    const membro = await getPrisma().organizationMember.upsert({
      where: { organizationId_email: { organizationId: actor.organizationId, email } },
      create: {
        organizationId: actor.organizationId,
        email,
        name: typeof corpo?.name === "string" && corpo.name.trim() ? corpo.name.trim() : null,
        role: corpo?.role === "ADMIN" ? "ADMIN" : "MEMBER",
        status: "INVITED",
      },
      /*
       * Reconvite NÃO rebaixa nem desativa quem já está dentro. Convidar de novo
       * costuma ser tentativa de corrigir o nome, e desligar alguém por engano
       * ao arrumar uma grafia seria um jeito silencioso de tirar acesso.
       */
      update: {
        name:
          typeof corpo?.name === "string" && corpo.name.trim() ? corpo.name.trim() : undefined,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return NextResponse.json({ membro }, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
