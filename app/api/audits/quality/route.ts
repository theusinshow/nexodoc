import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function isQualityEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY === "true"
  );
}

export async function GET() {
  if (!isQualityEnabled() || !isDatabaseConfigured()) {
    return NextResponse.json({ enabled: false, total: 0, confirmed: 0, falsePositive: 0, wrongSeverity: 0, missingFinding: 0 });
  }

  const grouped = await getPrisma().auditFeedback.groupBy({
    by: ["verdict"],
    _count: { _all: true },
  });
  const totals = Object.fromEntries(grouped.map((entry) => [entry.verdict, entry._count._all]));
  const confirmed = totals.CONFIRMED ?? 0;
  const falsePositive = totals.FALSE_POSITIVE ?? 0;
  const wrongSeverity = totals.WRONG_SEVERITY ?? 0;
  const missingFinding = totals.MISSING_FINDING ?? 0;

  return NextResponse.json({
    enabled: true,
    total: confirmed + falsePositive + wrongSeverity + missingFinding,
    confirmed,
    falsePositive,
    wrongSeverity,
    missingFinding,
  });
}
