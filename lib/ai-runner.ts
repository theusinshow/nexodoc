import type { Prisma } from "@prisma/client";
import type OpenAI from "openai";

import {
  classifyProviderFailure,
  getAiConfiguration,
  getDeepSeekApiKey,
  getDeepSeekBaseUrl,
  recordProviderFailure,
  type AiProvider,
  type AiProviderFlow,
} from "@/lib/ai-providers";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import {
  completeAiTask,
  createAiTask,
  failAiTask,
  startAiTask,
  type AiAgentName,
} from "@/lib/ai/tasks";
import { extractTokenUsage, recordAiUsage } from "@/lib/ai-usage";
import { getOpenAIClient } from "@/lib/openai";

type OpenAiResponseCreateParams = Parameters<OpenAI["responses"]["create"]>[0];

type ExecuteOpenAiResponseArgs = {
  flow: AiProviderFlow;
  model: string;
  operation: string;
  request: OpenAiResponseCreateParams;
  aiTaskId?: string | null;
  taskId?: string | null;
  taskLabel?: string | null;
  agent?: AiAgentName | string;
  projectId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  inputHash?: string | null;
  inputSummary?: string | null;
  maxAttempts?: number;
  userEmail?: string | null;
  metadata?: Prisma.InputJsonValue;
  timeoutMs?: number;
};

type ResponseWithOutputText = {
  output_text?: string | null;
};

type DeepSeekChatCompletion = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
};

function getDefaultTimeoutMs() {
  const value = Number(process.env.NEXODOC_AI_REQUEST_TIMEOUT_MS ?? 90_000);

  if (!Number.isFinite(value) || value <= 0) {
    return 90_000;
  }

  return Math.min(10 * 60_000, Math.max(5_000, Math.floor(value)));
}

function withFailureMetadata(
  metadata: Prisma.InputJsonValue | undefined,
  failureCategory: string,
) {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return {
      ...metadata,
      failureCategory,
    } satisfies Prisma.InputJsonValue;
  }

  return {
    failureCategory,
    metadata,
  } satisfies Prisma.InputJsonValue;
}

export function getProviderFailureStatus(category: string) {
  switch (category) {
    case "quota_billing":
      return 402;
    case "authentication":
      return 401;
    case "configuration":
      return 500;
    case "rate_limit":
      return 429;
    default:
      return 503;
  }
}

function extractOutputText(response: unknown) {
  const candidate = response as ResponseWithOutputText;

  return candidate.output_text?.trim() ?? "";
}

function getProviderForFlow(flow: AiProviderFlow): Exclude<AiProvider, "mimo"> {
  const configuration = getAiConfiguration();

  switch (flow) {
    case "audit":
      return configuration.audit.provider;
    case "audit-chat":
      return configuration.auditChat.provider;
    case "ld-extraction":
      return configuration.ldExtraction.primary.provider;
    case "volume-suggestion":
      return configuration.volumeSuggestion.provider;
    case "volume-analysis":
    default:
      return configuration.volumeAnalysis.provider;
  }
}

function getInputText(input: OpenAiResponseCreateParams["input"]): string {
  if (typeof input === "string") {
    return input;
  }

  if (!Array.isArray(input)) {
    return "";
  }

  return input
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      const candidate = item as {
        role?: string;
        content?: string | Array<{ type?: string; text?: string; image_url?: string }>;
      };
      const content = candidate.content;

      if (typeof content === "string") {
        return content;
      }

      if (!Array.isArray(content)) {
        return "";
      }

      return content
        .map((part) => {
          if (part.type === "input_text" || part.type === "text") {
            return part.text ?? "";
          }

          if (part.type === "input_image" || part.image_url) {
            return "[Imagem enviada ao fluxo original. DeepSeek recebera apenas o texto extraido disponivel.]";
          }

          return "";
        })
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function getDeepSeekMessages(request: OpenAiResponseCreateParams) {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (typeof request.instructions === "string" && request.instructions.trim()) {
    messages.push({ role: "system", content: request.instructions.trim() });
  }

  const input = getInputText(request.input).trim();

  if (input) {
    messages.push({ role: "user", content: input });
  }

  return messages.length > 0 ? messages : [{ role: "user" as const, content: "Responda objetivamente." }];
}

async function executeDeepSeekChatCompletion(args: ExecuteOpenAiResponseArgs, signal: AbortSignal) {
  const apiKey = getDeepSeekApiKey();

  if (!apiKey) {
    const error = new Error("DEEPSEEK_API_KEY não configurada.") as Error & { code?: string };
    error.code = "configuration";
    throw error;
  }

  const baseUrl = getDeepSeekBaseUrl().replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: getDeepSeekMessages(args.request),
      max_tokens: args.request.max_output_tokens,
      stream: false,
    }),
    signal,
  });
  const payload = (await response.json().catch(() => null)) as DeepSeekChatCompletion & {
    error?: { message?: string; code?: string; type?: string };
  } | null;

  if (!response.ok) {
    const error = new Error(payload?.error?.message || "DeepSeek recusou a chamada.") as Error & {
      status?: number;
      code?: string;
      type?: string;
    };
    error.status = response.status;
    error.code = payload?.error?.code;
    error.type = payload?.error?.type;
    throw error;
  }

  return payload ?? {};
}

function extractDeepSeekText(response: unknown) {
  const candidate = response as DeepSeekChatCompletion;

  return candidate.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function executeOpenAiResponse(args: ExecuteOpenAiResponseArgs) {
  await refreshAiModelOverrideCache();

  const provider = getProviderForFlow(args.flow);
  const timeoutMs = args.timeoutMs ?? getDefaultTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const aiTaskId =
    args.aiTaskId ??
    (args.agent
      ? await createAiTask({
          flow: args.flow,
          agent: args.agent,
          operation: args.operation,
          provider,
          model: args.model,
          projectId: args.projectId,
          userEmail: args.userEmail,
          relatedType: args.relatedType,
          relatedId: args.relatedId,
          inputHash: args.inputHash,
          inputSummary: args.inputSummary,
          metadata: args.metadata,
          maxAttempts: args.maxAttempts,
        })
      : null);

  await startAiTask(aiTaskId, { provider, model: args.model });

  try {
    const response =
      provider === "deepseek"
        ? await executeDeepSeekChatCompletion(args, controller.signal)
        : await getOpenAIClient().responses.create(args.request, {
            signal: controller.signal,
          });
    const durationMs = Date.now() - startedAt;
    const outputText =
      provider === "deepseek" ? extractDeepSeekText(response) : extractOutputText(response);

    // Prova de vida da IA: uma linha por chamada, dizendo qual provider/modelo
    // atendeu e quantos tokens foram cobrados. Se aqui não aparecer, a IA não rodou.
    const usage = extractTokenUsage(response);
    console.log(
      `[ai] flow=${args.flow} op=${args.operation} provider=${provider} model=${args.model} status=OK in=${usage.inputTokens} out=${usage.outputTokens} total=${usage.totalTokens} ${durationMs}ms`,
    );

    await recordAiUsage({
      flow: args.flow,
      aiTaskId,
      taskId: args.taskId,
      taskLabel: args.taskLabel,
      provider,
      model: args.model,
      operation: args.operation,
      response,
      durationMs,
      metadata: args.metadata,
      userEmail: args.userEmail,
    });
    await completeAiTask(aiTaskId, {
      outputSummary: outputText.slice(0, 2000),
    });

    return {
      response,
      text: outputText,
      durationMs,
      model: args.model,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failure = classifyProviderFailure(provider, args.flow, args.model, error);

    // Se a IA falhou, o achado some silenciosamente na camada da auditoria — este
    // log é a única pista de que a chamada existiu e por que morreu.
    console.error(
      `[ai] flow=${args.flow} op=${args.operation} provider=${provider} model=${args.model} status=FAILED categoria=${failure.category} ${durationMs}ms :: ${String((error as { message?: string })?.message ?? error).slice(0, 200)}`,
    );

    recordProviderFailure(failure);
    await recordAiUsage({
      flow: args.flow,
      aiTaskId,
      taskId: args.taskId,
      taskLabel: args.taskLabel,
      provider,
      model: args.model,
      operation: args.operation,
      status: "failed",
      durationMs,
      metadata: withFailureMetadata(args.metadata, failure.category),
      error,
      userEmail: args.userEmail,
    });
    await failAiTask(aiTaskId, {
      error,
      metadata: withFailureMetadata(args.metadata, failure.category),
    });

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
