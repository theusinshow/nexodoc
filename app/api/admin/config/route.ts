import { NextResponse } from "next/server";
import {
  classifyProviderFailure,
  getAiConfiguration,
  getLastProviderFailures,
  getSecretFingerprint,
  recordProviderFailure,
} from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

type ProviderErrorShape = {
  status?: number;
  code?: string;
  type?: string;
  name?: string;
  message?: string;
};

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
          id: "audit-standard-identity",
          label: "Auditoria padrão - identidade",
          provider: ai.audit.provider,
          model: ai.audit.models.standard.identity,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-standard-global",
          label: "Auditoria padrão - leitura global",
          provider: ai.audit.provider,
          model: ai.audit.models.standard.global,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-standard-chunk",
          label: "Auditoria padrão - blocos",
          provider: ai.audit.provider,
          model: ai.audit.models.standard.chunk,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-standard-cross-document",
          label: "Auditoria padrão - comparação entre arquivos",
          provider: ai.audit.provider,
          model: ai.audit.models.standard.crossDocument,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-standard-validation",
          label: "Auditoria padrão - validação",
          provider: ai.audit.provider,
          model: ai.audit.models.standard.validation,
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
          id: "audit-deep-identity",
          label: "Auditoria profunda - identidade",
          provider: ai.audit.provider,
          model: ai.audit.models.deep.identity,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-deep-global",
          label: "Auditoria profunda - leitura global",
          provider: ai.audit.provider,
          model: ai.audit.models.deep.global,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-deep-chunk",
          label: "Auditoria profunda - blocos",
          provider: ai.audit.provider,
          model: ai.audit.models.deep.chunk,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-deep-cross-document",
          label: "Auditoria profunda - comparação entre arquivos",
          provider: ai.audit.provider,
          model: ai.audit.models.deep.crossDocument,
          keyConfigured: ai.audit.keyConfigured,
        },
        {
          id: "audit-deep-validation",
          label: "Auditoria profunda - validação",
          provider: ai.audit.provider,
          model: ai.audit.models.deep.validation,
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
          id: "volume-analysis",
          label: "Volumes - validação da montagem",
          provider: ai.volumeAnalysis.provider,
          model: ai.volumeAnalysis.model,
          keyConfigured: ai.volumeAnalysis.keyConfigured,
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
        {
          id: "deepseek-placeholder",
          label: "DeepSeek - placeholder",
          provider: ai.deepseek.provider,
          model: ai.deepseek.model,
          keyConfigured: ai.deepseek.keyConfigured,
          enabled: ai.deepseek.enabled,
          placeholderOnly: ai.deepseek.placeholderOnly,
          note: ai.deepseek.note,
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
        deepseekApiKeyConfigured: ai.deepseek.keyConfigured,
        openaiAdminKeyConfigured: ai.administrationUsage.keyConfigured,
        adminTokenConfigured: Boolean(process.env.NEXODOC_ADMIN_TOKEN),
      },
      secretFingerprints: {
        openaiApiKey: getSecretFingerprint("OPENAI_API_KEY"),
        deepseekApiKey: getSecretFingerprint("DEEPSEEK_API_KEY"),
        openaiAdminKey: getSecretFingerprint("OPENAI_ADMIN_KEY"),
      },
      generatedAt: new Date().toISOString(),
    }),
    request,
  );
}

export async function POST(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return jsonError(request, "NEXODOC_ADMIN_TOKEN não configurado.", 500);
  }

  if (getBearerToken(request) !== adminToken) {
    return jsonError(request, "Acesso admin negado.", 401);
  }

  const ai = getAiConfiguration();

  if (!ai.auditChat.keyConfigured) {
    return jsonError(request, "OPENAI_API_KEY não configurada.", 500);
  }

  try {
    const model = ai.auditChat.model;
    const result = await executeOpenAiResponse({
      flow: "audit-chat",
      model,
      operation: "admin-config-connectivity-test",
      timeoutMs: 20_000,
      metadata: {
        source: "admin-config",
      },
      request: {
        model,
        instructions: "Responda apenas OK.",
        input: "Teste de conectividade do NexoDoc. Responda OK.",
        max_output_tokens: 16,
        reasoning: { effort: "none" },
      },
    });

    return withCors(
      NextResponse.json({
        ok: true,
        provider: "openai",
        model,
        durationMs: result.durationMs,
        output: result.text.slice(0, 120),
        testedAt: new Date().toISOString(),
      }),
      request,
    );
  } catch (error) {
    const rawError = error as ProviderErrorShape;
    const failure = classifyProviderFailure("openai", "audit-chat", ai.auditChat.model, error);
    recordProviderFailure(failure);

    return withCors(
      NextResponse.json(
        {
          ok: false,
          provider: failure.provider,
          model: failure.model,
          category: failure.category,
          message: failure.message,
          rawStatus: rawError.status,
          rawCode: rawError.code,
          rawType: rawError.type,
          rawName: rawError.name,
          rawMessage: rawError.message?.slice(0, 500),
          keyFingerprint: getSecretFingerprint("OPENAI_API_KEY"),
          testedAt: new Date().toISOString(),
        },
        { status: failure.category === "authentication" ? 401 : 503 },
      ),
      request,
    );
  }
}
