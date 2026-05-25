import { NextResponse } from "next/server";

import { deleteAuditLearning, updateAuditLearning } from "@/lib/audit-learnings";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
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

function withCors(response: NextResponse, request?: Request) {
  response.headers.set("Access-Control-Allow-Origin", request ? getAllowedOrigin(request) : "*");
  response.headers.set("Vary", "Origin");

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

function jsonError(message: string, status = 400, request?: Request) {
  return withCors(NextResponse.json({ error: message }, { status }), request);
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const learning = await updateAuditLearning(id, {
      title: body.title === undefined ? undefined : String(body.title),
      content: body.content === undefined ? undefined : String(body.content),
      type: body.type as never,
      scope: body.scope as never,
      status: body.status as never,
    });

    if (!learning) {
      return jsonError("Aprendizado não encontrado.", 404, request);
    }

    return withCors(NextResponse.json({ learning }), request);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Não foi possível atualizar o aprendizado.",
      400,
      request,
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleted = await deleteAuditLearning(id);

  if (!deleted) {
    return jsonError("Aprendizado não encontrado.", 404, request);
  }

  return withCors(NextResponse.json({ ok: true }), request);
}
