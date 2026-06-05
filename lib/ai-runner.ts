import type { Prisma } from "@prisma/client";
import type OpenAI from "openai";

import {
  classifyProviderFailure,
  recordProviderFailure,
  type AiProviderFlow,
} from "@/lib/ai-providers";
import { recordAiUsage } from "@/lib/ai-usage";
import { getOpenAIClient } from "@/lib/openai";

type OpenAiResponseCreateParams = Parameters<OpenAI["responses"]["create"]>[0];

type ExecuteOpenAiResponseArgs = {
  flow: AiProviderFlow;
  model: string;
  operation: string;
  request: OpenAiResponseCreateParams;
  taskId?: string | null;
  taskLabel?: string | null;
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

  try {
    const response = await getOpenAIClient().responses.create(args.request, {
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    await recordAiUsage({
      flow: args.flow,
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

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
