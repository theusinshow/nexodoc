import { NextResponse } from "next/server";
import {
  classifyProviderFailure,
  getAiConfiguration,
  getAuditExecutionProfile,
  getLastProviderFailures,
  getSecretFingerprint,
  recordProviderFailure,
} from "@/lib/ai-providers";
import {
  AI_MODEL_FLOW_DEFINITIONS,
  AI_MODEL_OPTIONS,
  disableAiModelConfig,
  listAiModelConfigs,
  refreshAiModelOverrideCache,
  upsertAiModelConfig,
  validateAiModelName,
} from "@/lib/ai-model-config";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { isDatabaseConfigured } from "@/lib/db";
import { carregarEscritorioComOrigem, salvarEscritorio } from "@/lib/escritorio-config";
import { carregarCotacaoComOrigem, salvarCotacao } from "@/lib/cambio-config";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, PATCH, POST, OPTIONS",
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

function getAdminAuthError(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return jsonError(request, "NEXODOC_ADMIN_TOKEN não configurado.", 500);
  }

  if (getBearerToken(request) !== adminToken) {
    return jsonError(request, "Acesso admin negado.", 401);
  }

  return null;
}

async function buildConfigPayload() {
  await refreshAiModelOverrideCache({ force: true });

  const ai = getAiConfiguration();
  const memorialStandard = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "standard",
  });
  const memorialDeep = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "deep",
  });
  const memorialDeepGlobal = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "deep",
    role: "global",
  });
  const memorialDeepValidation = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "deep",
    role: "validation",
  });
  const openAiKeyConfigured = getSecretFingerprint("OPENAI_API_KEY").configured;
  const savedModelConfigs = await listAiModelConfigs();
  const savedByFlowId = Object.fromEntries(savedModelConfigs.map((config) => [config.flowId, config]));
  const aiFlows = [
    {
      id: "audit-memorial-standard",
      label: "Auditoria normal de memorial",
      provider: memorialStandard.provider,
      model: memorialStandard.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-memorial-deep",
      label: "Auditoria profunda de memorial",
      provider: memorialDeep.provider,
      model: memorialDeep.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-memorial-deep-global",
      label: "Auditoria profunda de memorial - leitura global",
      provider: memorialDeepGlobal.provider,
      model: memorialDeepGlobal.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-memorial-deep-validation",
      label: "Auditoria profunda de memorial - validação",
      provider: memorialDeepValidation.provider,
      model: memorialDeepValidation.model,
      keyConfigured: openAiKeyConfigured,
    },
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
      id: "volume-suggestion",
      label: "Volumes - sugestão de montagem",
      provider: ai.volumeSuggestion.provider,
      model: ai.volumeSuggestion.model,
      keyConfigured: ai.volumeSuggestion.keyConfigured,
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
      id: "deepseek-provider",
      label: "DeepSeek - configuração",
      provider: ai.deepseek.provider,
      model: ai.deepseek.model,
      keyConfigured: ai.deepseek.keyConfigured,
      enabled: ai.deepseek.enabled,
      placeholderOnly: ai.deepseek.placeholderOnly,
      note: ai.deepseek.note,
    },
  ];

  return {
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? "",
      mockMode: process.env.NEXODOC_MOCK_MODE === "true",
      clientDemoAllowed:
        process.env.NODE_ENV !== "production" ||
        process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true",
      primaryProvider: ai.audit.provider,
      model: ai.auditChat.model,
      allowedOrigins: process.env.NEXODOC_ALLOWED_ORIGINS ?? "",
    },
    aiFlows,
    modelSettings: {
      databaseConfigured: isDatabaseConfigured(),
      options: AI_MODEL_OPTIONS,
      flows: AI_MODEL_FLOW_DEFINITIONS.map((definition) => {
        const runtimeFlow = aiFlows.find((flow) => flow.id === definition.id);
        const saved = savedByFlowId[definition.id];

        return {
          flowId: definition.id,
          label: definition.label,
          provider: runtimeFlow?.provider ?? "openai",
          effectiveModel: runtimeFlow?.model ?? "",
          overrideModel: saved?.isActive ? saved.model : "",
          hasOverride: Boolean(saved?.isActive),
          updatedAt: saved?.updatedAt,
          updatedBy: saved?.updatedBy,
          notes: saved?.notes ?? "",
        };
      }),
    },
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
      deepChunkMaxOutputTokens: Math.max(
        6000,
        Number(process.env.NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS ?? 6000),
      ),
    },
    secrets: {
      primaryApiKeyConfigured: ai.audit.keyConfigured,
      openaiApiKeyConfigured: getSecretFingerprint("OPENAI_API_KEY").configured,
      mimoApiKeyConfigured: ai.ldExtraction.fallback.keyConfigured,
      deepseekApiKeyConfigured: ai.deepseek.keyConfigured,
      openaiAdminKeyConfigured: ai.administrationUsage.keyConfigured,
      adminTokenConfigured: Boolean(process.env.NEXODOC_ADMIN_TOKEN),
    },
    escritorio: await carregarEscritorioComOrigem(),
    /*
     * O CÂMBIO NASCE AQUI, não em `/admin/usage`. Cotação é configuração: quem
     * a declara assume a responsabilidade pelo número, e isso não pertence à
     * tela que só lê o consumo.
     */
    cambio: await carregarCotacaoComOrigem(),
    secretFingerprints: {
      openaiApiKey: getSecretFingerprint("OPENAI_API_KEY"),
      deepseekApiKey: getSecretFingerprint("DEEPSEEK_API_KEY"),
      openaiAdminKey: getSecretFingerprint("OPENAI_ADMIN_KEY"),
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const authError = getAdminAuthError(request);

  if (authError) {
    return authError;
  }

  const payload = await buildConfigPayload();

  return withCors(
    NextResponse.json(payload),
    request,
  );
}

export async function PATCH(request: Request) {
  const authError = getAdminAuthError(request);

  if (authError) {
    return authError;
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    flowId?: string;
    model?: string;
    notes?: string;
    escritorio?: unknown;
    cambio?: unknown;
  } | null;

  /*
   * OS DADOS DO ESCRITÓRIO não são um fluxo de IA: entram antes da exigência de
   * `flowId`, que é a chave dos overrides de modelo.
   */
  if (body?.action === "escritorio") {
    if (!isDatabaseConfigured()) {
      return jsonError(
        request,
        "DATABASE_URL não configurada; não é possível salvar os dados do escritório.",
        500,
      );
    }
    try {
      await salvarEscritorio({ dados: body.escritorio, updatedBy: "admin" });
      return withCors(
        NextResponse.json({ ok: true, action: "escritorio", config: await buildConfigPayload() }),
        request,
      );
    } catch (error) {
      return jsonError(
        request,
        error instanceof Error ? error.message : "Não foi possível salvar os dados do escritório.",
        400,
      );
    }
  }

  if (body?.action === "cambio") {
    if (!isDatabaseConfigured()) {
      return jsonError(
        request,
        "DATABASE_URL não configurada; não é possível salvar a cotação.",
        500,
      );
    }
    try {
      await salvarCotacao({ valor: body.cambio, declaradaPor: "admin" });
      return withCors(
        NextResponse.json({ ok: true, action: "cambio", config: await buildConfigPayload() }),
        request,
      );
    } catch (error) {
      return jsonError(
        request,
        error instanceof Error ? error.message : "Não foi possível salvar a cotação.",
        400,
      );
    }
  }

  const action = body?.action === "reset" ? "reset" : "save";
  const flowId = String(body?.flowId ?? "").trim();

  if (!isDatabaseConfigured()) {
    return jsonError(request, "DATABASE_URL não configurada; não é possível salvar modelos no painel.", 500);
  }

  if (!flowId) {
    return jsonError(request, "Fluxo de IA não informado.", 400);
  }

  try {
    if (action === "reset") {
      await disableAiModelConfig(flowId, "admin");
    } else {
      const model = String(body?.model ?? "").trim();
      const modelError = validateAiModelName(model);

      if (modelError) {
        return jsonError(request, modelError, 400);
      }

      await upsertAiModelConfig({
        flowId,
        model,
        notes: body?.notes,
        updatedBy: "admin",
      });
    }

    return withCors(
      NextResponse.json({
        ok: true,
        action,
        flowId,
        config: await buildConfigPayload(),
      }),
      request,
    );
  } catch (error) {
    return jsonError(
      request,
      error instanceof Error ? error.message : "Não foi possível salvar o modelo.",
      400,
    );
  }
}

export async function POST(request: Request) {
  const authError = getAdminAuthError(request);

  if (authError) {
    return authError;
  }

  await refreshAiModelOverrideCache({ force: true });
  const ai = getAiConfiguration();

  if (!ai.auditChat.keyConfigured) {
    return jsonError(
      request,
      ai.auditChat.provider === "deepseek"
        ? "DEEPSEEK_API_KEY não configurada."
        : "OPENAI_API_KEY não configurada.",
      500,
    );
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
        provider: ai.auditChat.provider,
        model,
        durationMs: result.durationMs,
        output: result.text.slice(0, 120),
        testedAt: new Date().toISOString(),
      }),
      request,
    );
  } catch (error) {
    const rawError = error as ProviderErrorShape;
    const failure = classifyProviderFailure(ai.auditChat.provider, "audit-chat", ai.auditChat.model, error);
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
          keyFingerprint: getSecretFingerprint(
            ai.auditChat.provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY",
          ),
          testedAt: new Date().toISOString(),
        },
        { status: failure.category === "authentication" ? 401 : 503 },
      ),
      request,
    );
  }
}
