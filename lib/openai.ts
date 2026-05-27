import OpenAI from "openai";

import { getOpenAiApiKey } from "@/lib/ai-providers";

let client: OpenAI | null = null;
let clientApiKey: string | null = null;

export function getOpenAIClient() {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  if (!client || clientApiKey !== apiKey) {
    client = new OpenAI({ apiKey });
    clientApiKey = apiKey;
  }

  return client;
}
