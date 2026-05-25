import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function jsonError(request: Request, message: string, status = 400) {
  return withCors(NextResponse.json({ error: message }, { status }), request);
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export function GET(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return jsonError(request, "NEXODOC_ADMIN_TOKEN não configurado.", 500);
  }

  if (getBearerToken(request) !== adminToken) {
    return jsonError(request, "Acesso admin negado.", 401);
  }

  return withCors(
    NextResponse.json({
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "",
        mockMode: process.env.NEXODOC_MOCK_MODE === "true",
        clientDemoAllowed:
          process.env.NODE_ENV !== "production" ||
          process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true",
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        allowedOrigins: process.env.NEXODOC_ALLOWED_ORIGINS ?? "",
      },
      limits: {
        maxFiles: 5,
        maxFileSizeMb: 25,
        maxChunksPerFile: Number(process.env.NEXODOC_MAX_CHUNKS_PER_FILE ?? 24),
        chunkConcurrency: Number(process.env.NEXODOC_CHUNK_CONCURRENCY ?? 5),
        chunkTimeoutMs: Number(process.env.NEXODOC_CHUNK_TIMEOUT_MS ?? 120000),
        deepChunkMaxOutputTokens: Number(
          process.env.NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS ?? 1800,
        ),
      },
      secrets: {
        openaiApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
        openaiAdminKeyConfigured: Boolean(process.env.OPENAI_ADMIN_KEY),
        adminTokenConfigured: Boolean(process.env.NEXODOC_ADMIN_TOKEN),
      },
      generatedAt: new Date().toISOString(),
    }),
    request,
  );
}
