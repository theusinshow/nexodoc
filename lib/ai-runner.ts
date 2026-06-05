import type { Prisma } from "@prisma/client";
import type OpenAI from "openai";

import {
  classifyProviderFailure,
  recordProviderFailure,
  type AiProviderFlow,
} from "@/lib/ai-providers";
import {
  completeAiTask,
  createAiTask,
  failAiTask,
  startAiTask,
  type AiAgentName,
} from "@/lib/ai/tasks";
import { recordAiUsage } from "@/lib/ai-usage";
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

export async function executeOpenAiResponse(args: ExecuteOpenAiResponseArgs) {
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
          provider: "openai",
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

  await startAiTask(aiTaskId, { provider: "openai", model: args.model });

  try {
    const response = await getOpenAIClient().responses.create(args.request, {
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    await recordAiUsage({
      flow: args.flow,
      aiTaskId,
      taskId: args.taskId,
      taskLabel: args.taskLabel,
      provider: "openai",
      model: args.model,
      operation: args.operation,
      response,
      durationMs,
      metadata: args.metadata,
      userEmail: args.userEmail,
    });
    await completeAiTask(aiTaskId, {
      outputSummary: extractOutputText(response).slice(0, 2000),
    });

    return {
      response,
      text: extractOutputText(response),
      durationMs,
      model: args.model,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failure = classifyProviderFailure("openai", args.flow, args.model, error);

    recordProviderFailure(failure);
    await recordAiUsage({
      flow: args.flow,
      aiTaskId,
      taskId: args.taskId,
      taskLabel: args.taskLabel,
      provider: "openai",
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
