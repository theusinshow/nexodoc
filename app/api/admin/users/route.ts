import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@prisma/client";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function ensureAdmin(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return jsonError("NEXODOC_ADMIN_TOKEN não configurado.", 500);
  }

  if (getBearerToken(request) !== adminToken) {
    return jsonError("Acesso admin negado.", 401);
  }

  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL não configurada.", 500);
  }

  return null;
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
  const [ldDraftCount, ldGeneratedCount] = await Promise.all([
    prisma.ldDraft.count({ where: { userEmail: user.email } }),
    prisma.ldDraft.count({ where: { userEmail: user.email, status: "GENERATED" } }),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    auditCount: user._count?.audits ?? 0,
    sessionCount: user._count?.sessions ?? 0,
    ldDraftCount,
    ldGeneratedCount,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const adminError = ensureAdmin(request);
  if (adminError) return adminError;

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
  const adminError = ensureAdmin(request);
  if (adminError) return adminError;

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

  return NextResponse.json({
    user: await serializeUser(user),
  });
}

export async function PATCH(request: Request) {
  const adminError = ensureAdmin(request);
  if (adminError) return adminError;

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

  const user = await getPrisma().user.update({
    where: { id },
    data: {
      name: normalizeName(body?.name, current.email),
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

  return NextResponse.json({
    user: await serializeUser(user),
  });
}
