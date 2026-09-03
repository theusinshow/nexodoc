import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@prisma/client";

import { checkAdminRequest } from "@/lib/admin-gate";
import { registrarAcao } from "@/lib/trilha-administrativa";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * A regra mora em [[../../../../lib/admin-gate.ts]]. Aqui fica só a tradução
 * para o formato de erro desta rota — antes, a checagem estava copiada aqui e
 * em mais seis lugares, e só exigia o token: sessão não era pedida.
 *
 * Devolve também QUEM passou: promover alguém a admin sem registrar quem
 * promoveu é a mudança de permissão mais séria do sistema acontecendo anônima.
 */
async function portaoDoAdmin(request: Request) {
  const veredito = await checkAdminRequest(request);

  return veredito.ok
    ? { email: veredito.email, erro: null }
    : { email: "", erro: jsonError(veredito.message, veredito.status) };
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown, email: string) {
  return typeof value === "string" && value.trim() ? value.trim() : email;
}

function parseRole(value: unknown): UserRole {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function getFilters(request: Request): Prisma.UserWhereInput {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const role = url.searchParams.get("role")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const where: Prisma.UserWhereInput = {};
  const conditions: Prisma.UserWhereInput[] = [];

  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (role === "ADMIN" || role === "USER") {
    where.role = role;
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  if (conditions.length) {
    where.AND = conditions;
  }

  return where;
}

/**
 * O VINCULO COM O ESCRITORIO, ao lado da conta.
 *
 * Sao dois eixos, e e bom que sejam: "tem conta no sistema" nao e "e do
 * escritorio". Conta desativada nao entra em lugar nenhum; membro removido da
 * PROSUL continua com conta e continua sem ver projeto dela.
 *
 * Esta tela mostra os dois porque e daqui que o mantenedor libera alguem -- e
 * ver so um deles foi o que fez o primeiro teste de verdade terminar num 403
 * correto e sem saida visivel.
 */
async function vinculoDoEscritorio(email: string) {
  const membro = await getPrisma().organizationMember.findFirst({
    where: { email },
    select: { role: true, status: true, organizationId: true },
  });

  return membro
    ? { role: membro.role, status: membro.status, organizationId: membro.organizationId }
    : null;
}

async function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { audits: number; sessions: number };
}) {
  const prisma = getPrisma();
  const [ldDraftCount, ldGeneratedCount, escritorio] = await Promise.all([
    prisma.ldDraft.count({ where: { userEmail: user.email } }),
    prisma.ldDraft.count({ where: { userEmail: user.email, status: "GENERATED" } }),
    vinculoDoEscritorio(user.email),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    escritorio,
    auditCount: user._count?.audits ?? 0,
    sessionCount: user._count?.sessions ?? 0,
    ldDraftCount,
    ldGeneratedCount,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { erro } = await portaoDoAdmin(request);
  if (erro) return erro;

  const users = await getPrisma().user.findMany({
    where: getFilters(request),
    orderBy: [{ role: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      _count: {
        select: {
          audits: true,
          sessions: true,
        },
      },
    },
  });

  return NextResponse.json({
    users: await Promise.all(users.map(serializeUser)),
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const { email: quem, erro } = await portaoDoAdmin(request);
  if (erro) return erro;

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; name?: unknown; role?: unknown; isActive?: unknown }
    | null;
  const email = normalizeEmail(body?.email);

  if (!email || !email.includes("@")) {
    return jsonError("Informe um e-mail válido.", 400);
  }

  const user = await getPrisma().user.upsert({
    where: { email },
    create: {
      email,
      name: normalizeName(body?.name, email),
      passwordHash: "admin-created",
      role: parseRole(body?.role),
      isActive: body?.isActive === false ? false : true,
    },
    update: {
      name: normalizeName(body?.name, email),
      role: parseRole(body?.role),
      isActive: body?.isActive === false ? false : true,
    },
    include: {
      _count: {
        select: {
          audits: true,
          sessions: true,
        },
      },
    },
  });

  await registrarAcao({
    quem,
    acao: "usuario",
    alcance: email,
    resumo: { criadoOuAtualizado: true, role: user.role, isActive: user.isActive },
  });

  return NextResponse.json({
    user: await serializeUser(user),
  });
}

export async function PATCH(request: Request) {
  const { email: quem, erro } = await portaoDoAdmin(request);
  if (erro) return erro;

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; name?: unknown; role?: unknown; isActive?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return jsonError("Informe o usuário.", 400);
  }

  const current = await getPrisma().user.findUnique({ where: { id } });

  if (!current) {
    return jsonError("Usuário não encontrado.", 404);
  }

  /*
   * Atualização PARCIAL: só muda o que foi enviado.
   *
   * Antes, `role: parseRole(body?.role)` devolvia "USER" para campo ausente e
   * `isActive` virava `true` por omissão — então um PATCH que só corrigia o
   * NOME rebaixava o admin e reativava uma conta desativada, sem ninguém pedir.
   * A tela mandava tudo junto e mascarava isso; qualquer outro cliente da API
   * cairia na armadilha.
   */
  const novoPapel = body?.role === undefined ? current.role : parseRole(body.role);
  const novoAtivo = body?.isActive === undefined ? current.isActive : body.isActive !== false;

  /*
   * O ÚLTIMO admin ativo não pode se apagar.
   *
   * Rebaixar ou desativar o único admin deixa o sistema sem ninguém capaz de
   * administrá-lo — e a recuperação depende de mexer em variável de ambiente ou
   * direto no banco, que é justamente o que um painel existe para evitar.
   */
  const vaiPerderAdmin =
    current.role === "ADMIN" && current.isActive && (novoPapel !== "ADMIN" || !novoAtivo);

  if (vaiPerderAdmin) {
    const adminsAtivos = await getPrisma().user.count({
      where: { role: "ADMIN", isActive: true },
    });

    if (adminsAtivos <= 1) {
      return jsonError(
        "Este é o último admin ativo. Promova outro usuário antes de rebaixar ou desativar este.",
        409,
      );
    }
  }

  await registrarAcao({
    quem,
    acao: "usuario",
    alcance: current.email,
    resumo: {
      de: { role: current.role, isActive: current.isActive },
      para: { role: novoPapel, isActive: novoAtivo },
    },
  });

  const user = await getPrisma().user.update({
    where: { id },
    data: {
      name: normalizeName(body?.name, current.email),
      role: novoPapel,
      isActive: novoAtivo,
    },
    include: {
      _count: {
        select: {
          audits: true,
          sessions: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: await serializeUser(user),
  });
}
