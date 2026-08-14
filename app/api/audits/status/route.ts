import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

function isRecentHistoryEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY === "true"
  );
}

export async function GET() {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  const configured = isDatabaseConfigured();
  const publicHistoryEnabled = isRecentHistoryEnabled();

  if (!configured) {
    return NextResponse.json({
      configured,
      connected: false,
      publicHistoryEnabled,
      message: "DATABASE_URL não configurada. As auditorias funcionam, mas não persistem histórico.",
    });
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;

    return NextResponse.json({
      configured,
      connected: true,
      publicHistoryEnabled,
      message: "Histórico persistente ativo.",
    });
  } catch {
    return NextResponse.json({
      configured,
      connected: false,
      publicHistoryEnabled,
      message: "DATABASE_URL configurada, mas o banco não respondeu.",
    });
  }
}
