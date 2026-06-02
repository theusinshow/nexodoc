import { getAiConfiguration } from "@/lib/ai-providers";
import { getOpenAIClient } from "@/lib/openai";

export function isAIConfigured(): boolean {
  return getAiConfiguration().volumeAnalysis.keyConfigured;
}

export function getVolumeAnalysisModel() {
  return getAiConfiguration().volumeAnalysis.model;
}

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; model: string; response: unknown; durationMs: number }> {
  if (!isAIConfigured()) {
    throw new Error("OpenAI nao configurada. Defina OPENAI_API_KEY.");
  }

  const model = getVolumeAnalysisModel();
  const startedAt = Date.now();
  const response = await getOpenAIClient().responses.create({
    model,
    instructions: systemPrompt,
    input: userPrompt,
    max_output_tokens: 2000,
    reasoning: { effort: "low" },
  });

  return {
    text: response.output_text?.trim() ?? "",
    model,
    response,
    durationMs: Date.now() - startedAt,
  };
}
