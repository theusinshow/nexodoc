import type { Prisma } from "@prisma/client";

import { estimateOpenAiCostUsd } from "@/lib/ai-precos";
import type { AiProvider } from "@/lib/ai-providers";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export { estimateOpenAiCostUsd, isModelPriceKnown } from "@/lib/ai-precos";

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

type RecordAiUsageArgs = {
  flow: "audit" | "audit-chat" | "nexo-agent" | "ld-extraction" | "volume-analysis" | "volume-suggestion" | "volume-conferencia";
  aiTaskId?: string | null;
  taskId?: string | null;
  taskLabel?: string | null;
  provider: AiProvider;
  model: string;
  operation: string;
  status?: "success" | "failed";
  response?: unknown;
  usage?: Partial<TokenUsage>;
  durationMs?: number;
  metadata?: Prisma.InputJsonValue;
  error?: unknown;
  userEmail?: string | null;
  /** Conversa do Nexo que originou a chamada (só o Nexo preenche). */
  conversationId?: string | null;
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : String(error ?? "").slice(0, 1000);
}

export async function recordAiUsage(args: RecordAiUsageArgs) {
  if (!isDatabaseConfigured()) {
    return;
  }

  // Os dois campos precisam viajar juntos: o endpoint do anel de consumo
  // (`/api/nexo/usage`) filtra por `conversationId` E `userEmail` (é a única
  // autorização que ele tem). Um evento com um e não o outro é gravado, mas
  // NUNCA aparece no anel — silenciosamente. Este aviso torna essa classe de
  // bug barulhenta em vez de invisível.
  if (args.conversationId && !args.userEmail) {
    console.warn(
      `[ai-usage] flow=${args.flow} operation=${args.operation} tem conversationId sem userEmail — este evento nunca vai aparecer no anel de consumo do Nexo (o filtro exige os dois).`,
    );
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
        aiTaskId: args.aiTaskId || null,
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
        conversationId: args.conversationId || null,
      },
    });
  } catch (error) {
    console.error("[ai-usage] falha ao registrar uso de IA", error);
  }
}
