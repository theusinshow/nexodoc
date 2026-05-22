import OpenAI from "openai";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let client: OpenAI | null = null;
let clientApiKey: string | null = null;

function getLocalEnvValue(name: string) {
  if (process.env.NODE_ENV === "production") {
    return "";
  }

  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return "";
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));

  return line?.replace(`${name}=`, "").trim() ?? "";
}

export function getOpenAIClient() {
  const apiKey =
    getLocalEnvValue("OPENAI_API_KEY") || process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  if (!client || clientApiKey !== apiKey) {
    client = new OpenAI({ apiKey });
    clientApiKey = apiKey;
  }

  return client;
}
