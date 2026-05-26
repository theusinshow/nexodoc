import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;

function isRecentHistoryEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY === "true"
  );
}

function getLimit(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);

  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(50, Math.max(1, Math.floor(limit)));
}

export async function GET(request: Request) {
  if (!isRecentHistoryEnabled()) {
    return NextResponse.json(
      {
        audits: [],
        disabledReason:
          "Histórico público desabilitado. Configure NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true para habilitar em produção.",
      },
      { status: 403 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      audits: [],
      disabledReason: "DATABASE_URL não configurada.",
    });
  }

  const audits = await getPrisma().audit.findMany({
    take: getLimit(request),
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      projectName: true,
      description: true,
      auditMode: true,
      analysisLevel: true,
      status: true,
      result: true,
      report: true,
      error: true,
      elapsedMs: true,
      createdAt: true,
      files: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          fileName: true,
        },
      },
    },
  });

  return NextResponse.json({
    audits: audits.map((audit) => ({
      ...audit,
      createdAt: audit.createdAt.toISOString(),
      fileNames: audit.files.map((file) => file.fileName),
      files: undefined,
    })),
    generatedAt: new Date().toISOString(),
  });
}
