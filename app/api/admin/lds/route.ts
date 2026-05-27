import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getArrayLength(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.length : 0;
}

export async function GET(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) return jsonError("NEXODOC_ADMIN_TOKEN não configurado.", 500);
  if (getBearerToken(request) !== adminToken) return jsonError("Acesso admin negado.", 401);
  if (!isDatabaseConfigured()) return jsonError("DATABASE_URL não configurada.", 500);

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const user = url.searchParams.get("user")?.trim();
  const where: Prisma.LdDraftWhereInput = {};
  const conditions: Prisma.LdDraftWhereInput[] = [];

  if (query) {
    conditions.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { projectCode: { contains: query, mode: "insensitive" } },
        { workName: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (status && status !== "all" && ["DRAFT", "GENERATED", "ARCHIVED"].includes(status)) {
    where.status = status as "DRAFT" | "GENERATED" | "ARCHIVED";
  }

  if (user) {
    conditions.push({
      OR: [
        { userEmail: { contains: user, mode: "insensitive" } },
        { userName: { contains: user, mode: "insensitive" } },
      ],
    });
  }

  if (conditions.length) {
    where.AND = conditions;
  }

  const drafts = await getPrisma().ldDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: {
        select: { events: true },
      },
    },
  });

  return NextResponse.json({
    lds: drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      projectCode: draft.projectCode,
      workName: draft.workName,
      userEmail: draft.userEmail,
      userName: draft.userName,
      status: draft.status,
      activeStep: draft.activeStep,
      rowCount: getArrayLength(draft.rows),
      tomoCount: getArrayLength(draft.tomos),
      eventCount: draft._count.events,
      updatedAt: draft.updatedAt.toISOString(),
      generatedAt: draft.generatedAt?.toISOString() ?? null,
    })),
    generatedAt: new Date().toISOString(),
  });
}
