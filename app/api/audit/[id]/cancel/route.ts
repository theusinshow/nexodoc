import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function withCors(response: NextResponse, request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.NEXODOC_ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigin = !origin
    ? allowedOrigins?.[0] ?? "*"
    : !allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");
  return response;
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return withCors(NextResponse.json({ canceled: false }), request);
  }

  const { id } = await params;

  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) {
    return withCors(
      NextResponse.json({ error: "Identificador de auditoria inválido." }, { status: 400 }),
      request,
    );
  }

  const updated = await getPrisma().audit.updateMany({
    where: { id, status: "PROCESSING" },
    data: {
      status: "CANCELED",
      error: "Auditoria cancelada pelo usuário.",
      completedAt: new Date(),
    },
  });

  return withCors(NextResponse.json({ canceled: updated.count > 0 }), request);
}
