import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type FeedbackVerdict =
  | "CONFIRMED"
  | "FALSE_POSITIVE"
  | "WRONG_SEVERITY"
  | "MISSING_FINDING";

type AuditQualitySource = {
  analysisLevel: string;
  totalFindings: number;
  elapsedMs: number | null;
  report: Prisma.JsonValue | null;
  feedback: Array<{ verdict: FeedbackVerdict }>;
};

type QualityBucket = {
  key: string;
  label: string;
  completedAudits: number;
  reviewedAudits: number;
  generatedFindings: number;
  elapsedMs: number;
  durationSamples: number;
  confirmed: number;
  falsePositive: number;
  wrongSeverity: number;
  missingFinding: number;
};

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.NEXODOC_ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin) {
    return allowedOrigins?.[0] ?? "*";
  }

  if (!allowedOrigins || allowedOrigins.length === 0) {
    return origin;
  }

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function withCors(response: NextResponse, request: Request) {
  response.headers.set("Access-Control-Allow-Origin", getAllowedOrigin(request));
  response.headers.set("Vary", "Origin");

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

function jsonError(request: Request, message: string, status = 400) {
  return withCors(NextResponse.json({ error: message }, { status }), request);
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function createBucket(key: string, label: string): QualityBucket {
  return {
    key,
    label,
    completedAudits: 0,
    reviewedAudits: 0,
    generatedFindings: 0,
    elapsedMs: 0,
    durationSamples: 0,
    confirmed: 0,
    falsePositive: 0,
    wrongSeverity: 0,
    missingFinding: 0,
  };
}

function getAnalysisLevelLabel(level: string) {
  return level === "deep" ? "Profundo" : "Padrão";
}

function getAuditModel(report: Prisma.JsonValue | null) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return "Sem modelo registrado";
  }

  const runtime = report.runtime;

  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    return "Sem modelo registrado";
  }

  return typeof runtime.modelo_principal === "string"
    ? runtime.modelo_principal
    : "Sem modelo registrado";
}

function addAudit(bucket: QualityBucket, audit: AuditQualitySource) {
  bucket.completedAudits += 1;
  bucket.generatedFindings += audit.totalFindings;

  if (audit.elapsedMs) {
    bucket.elapsedMs += audit.elapsedMs;
    bucket.durationSamples += 1;
  }

  if (audit.feedback.length > 0) {
    bucket.reviewedAudits += 1;
  }

  for (const entry of audit.feedback) {
    if (entry.verdict === "CONFIRMED") {
      bucket.confirmed += 1;
    } else if (entry.verdict === "FALSE_POSITIVE") {
      bucket.falsePositive += 1;
    } else if (entry.verdict === "WRONG_SEVERITY") {
      bucket.wrongSeverity += 1;
    } else if (entry.verdict === "MISSING_FINDING") {
      bucket.missingFinding += 1;
    }
  }
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function finishBucket(bucket: QualityBucket) {
  const reviewedOutputs =
    bucket.confirmed + bucket.falsePositive + bucket.wrongSeverity;
  const totalFeedback =
    reviewedOutputs + bucket.missingFinding;

  return {
    ...bucket,
    totalFeedback,
    confirmationRate:
      reviewedOutputs > 0
        ? roundMetric((bucket.confirmed / reviewedOutputs) * 100)
        : null,
    falsePositiveRate:
      reviewedOutputs > 0
        ? roundMetric((bucket.falsePositive / reviewedOutputs) * 100)
        : null,
    reviewCoverage:
      bucket.completedAudits > 0
        ? roundMetric((bucket.reviewedAudits / bucket.completedAudits) * 100)
        : null,
    averageDurationMs:
      bucket.durationSamples > 0
        ? Math.round(bucket.elapsedMs / bucket.durationSamples)
        : null,
    averageFindings:
      bucket.completedAudits > 0
        ? roundMetric(bucket.generatedFindings / bucket.completedAudits)
        : null,
  };
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return jsonError(request, "NEXODOC_ADMIN_TOKEN não configurado.", 500);
  }

  if (getBearerToken(request) !== adminToken) {
    return jsonError(request, "Acesso admin negado.", 401);
  }

  if (!isDatabaseConfigured()) {
    return jsonError(request, "DATABASE_URL não configurada.", 500);
  }

  const audits = (await getPrisma().audit.findMany({
    where: {
      status: "COMPLETED",
    },
    select: {
      analysisLevel: true,
      totalFindings: true,
      elapsedMs: true,
      report: true,
      feedback: {
        select: {
          verdict: true,
        },
      },
    },
  })) as AuditQualitySource[];

  const overview = createBucket("all", "Todas");
  const levels = new Map<string, QualityBucket>([
    ["standard", createBucket("standard", "Padrão")],
    ["deep", createBucket("deep", "Profundo")],
  ]);
  const models = new Map<string, QualityBucket>();

  for (const audit of audits) {
    const level = audit.analysisLevel === "deep" ? "deep" : "standard";
    const model = getAuditModel(audit.report);
    const modelBucket =
      models.get(model) ?? createBucket(model, model);

    addAudit(overview, audit);
    addAudit(levels.get(level) ?? createBucket(level, getAnalysisLevelLabel(level)), audit);
    addAudit(modelBucket, audit);
    models.set(model, modelBucket);
  }

  return withCors(
    NextResponse.json({
      overview: finishBucket(overview),
      levels: [...levels.values()].map(finishBucket),
      models: [...models.values()]
        .map(finishBucket)
        .sort((first, second) => second.completedAudits - first.completedAudits),
      generatedAt: new Date().toISOString(),
    }),
    request,
  );
}
