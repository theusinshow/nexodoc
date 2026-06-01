import type { Prisma } from "@prisma/client";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

type RecordAiUsageArgs = {
  flow: "audit" | "audit-chat" | "ld-extraction";
  taskId?: string | null;
  taskLabel?: string | null;
  provider: "openai" | "mimo";
  model: string;
  operation: string;
  status?: "success" | "failed";
  response?: unknown;
  usage?: Partial<TokenUsage>;
  durationMs?: number;
  metadata?: Prisma.InputJsonValue;
  error?: unknown;
  userEmail?: string | null;
};

const MODEL_PRICES_USD_PER_MILLION: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function extractTokenUsage(response: unknown): TokenUsage {
  const candidate = response as {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      input_tokens_details?: { cached_tokens?: number };
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const usage = candidate?.usage ?? {};
  const inputTokens = numberValue(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = numberValue(usage.output_tokens ?? usage.completion_tokens);
  const cachedTokens = numberValue(
    usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens,
  );
  const totalTokens = numberValue(usage.total_tokens) || inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens,
  };
}

function estimateOpenAiCostUsd(model: string, usage: TokenUsage) {
  const price = MODEL_PRICES_USD_PER_MILLION[model];

  if (!price) {
    return null;
  }

  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedTokens);

  return (
    (uncachedInput * price.input +
      usage.cachedTokens * price.cachedInput +
      usage.outputTokens * price.output) /
    1_000_000
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : String(error ?? "").slice(0, 1000);
}

export async function recordAiUsage(args: RecordAiUsageArgs) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const responseUsage = extractTokenUsage(args.response);
  const usage = {
    inputTokens: args.usage?.inputTokens ?? responseUsage.inputTokens,
    outputTokens: args.usage?.outputTokens ?? responseUsage.outputTokens,
    cachedTokens: args.usage?.cachedTokens ?? responseUsage.cachedTokens,
    totalTokens: args.usage?.totalTokens ?? responseUsage.totalTokens,
  };
  const estimatedCostUsd =
    args.provider === "openai" ? estimateOpenAiCostUsd(args.model, usage) : null;

  try {
    await getPrisma().aiUsageEvent.create({
      data: {
        flow: args.flow,
        taskId: args.taskId || null,
        taskLabel: args.taskLabel || null,
        provider: args.provider,
        model: args.model,
        operation: args.operation,
        status: args.status ?? "success",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd,
        durationMs: args.durationMs,
        metadata: args.metadata ?? undefined,
        error: args.error ? getErrorMessage(args.error) : null,
        userEmail: args.userEmail || null,
      },
    });
  } catch (error) {
    console.error("[ai-usage] falha ao registrar uso de IA", error);
  }
}
