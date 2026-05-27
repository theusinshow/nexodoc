import { NextResponse } from "next/server";
import { getAiConfiguration, getLastProviderFailures } from "@/lib/ai-providers";

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

  const ai = getAiConfiguration();

  return withCors(
    NextResponse.json({
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "",
        mockMode: process.env.NEXODOC_MOCK_MODE === "true",
        clientDemoAllowed:
          process.env.NODE_ENV !== "production" ||
          process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true",
        model: ai.auditChat.model,
        allowedOrigins: process.env.NEXODOC_ALLOWED_ORIGINS ?? "",
      },
      aiFlows: [
        {
          id: "audit-standard",
          label: "Auditoria padrão",
          provider: ai.audit.provider,
          model: ai.audit.standardModel,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-deep",
          label: "Auditoria profunda",
          provider: ai.audit.provider,
          model: ai.audit.deepModel,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-chat",
          label: "Chat pós-auditoria",
          provider: ai.auditChat.provider,
          model: ai.auditChat.model,
          keyConfigured: ai.auditChat.keyConfigured,
        },
        {
          id: "ld-primary",
          label: "LD - leitura principal",
          provider: ai.ldExtraction.primary.provider,
          model: ai.ldExtraction.primary.model,
          keyConfigured: ai.ldExtraction.primary.keyConfigured,
        },
        {
          id: "ld-fallback",
          label: "LD - fallback",
          provider: ai.ldExtraction.fallback.provider,
          model: ai.ldExtraction.fallback.model,
          keyConfigured: ai.ldExtraction.fallback.keyConfigured,
        },
      ],
      aiHealth: {
        externalConnectivityChecked: false,
        note: "Validação somente de configuração; nenhuma chamada externa ou consumo de tokens foi executado.",
        lastFailures: getLastProviderFailures(),
        statusStorage: "Memória da instância atual; reiniciar o servidor limpa os incidentes.",
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
        openaiApiKeyConfigured: ai.audit.keyConfigured,
        mimoApiKeyConfigured: ai.ldExtraction.fallback.keyConfigured,
        openaiAdminKeyConfigured: ai.administrationUsage.keyConfigured,
        adminTokenConfigured: Boolean(process.env.NEXODOC_ADMIN_TOKEN),
      },
      generatedAt: new Date().toISOString(),
    }),
    request,
  );
}
