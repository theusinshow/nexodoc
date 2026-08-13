import type { Prisma } from "@prisma/client";

import { getAiConfiguration } from "@/lib/ai-providers";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import { executeOpenAiResponse } from "@/lib/ai-runner";

type CallOpenAIOptions = {
  operation?: string;
  taskId?: string | null;
  taskLabel?: string | null;
  metadata?: Prisma.InputJsonValue;
  userEmail?: string | null;
};

export function isAIConfigured(): boolean {
  return getAiConfiguration().volumeAnalysis.keyConfigured;
}

export function getVolumeAnalysisModel() {
  return getAiConfiguration().volumeAnalysis.model;
}

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: CallOpenAIOptions = {},
): Promise<{ text: string; model: string; response: unknown; durationMs: number }> {
  await refreshAiModelOverrideCache();

  const configuration = getAiConfiguration().volumeAnalysis;

  if (!isAIConfigured()) {
    throw new Error(
      "OpenAI nao configurada. Defina OPENAI_API_KEY.",
    );
  }

  const model = getVolumeAnalysisModel();
  const result = await executeOpenAiResponse({
    flow: "volume-analysis",
    model,
    operation: options.operation ?? "volume-analysis",
    taskId: options.taskId,
    taskLabel: options.taskLabel,
    metadata: options.metadata,
    userEmail: options.userEmail,
    request: {
      model,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 2000,
      reasoning: { effort: "low" },
    },
  });

  return {
    text: result.text,
    model,
    response: result.response,
    durationMs: result.durationMs,
  };
}
