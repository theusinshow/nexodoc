import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AiProvider = "openai" | "mimo";
export type AiProviderFlow = "audit" | "audit-chat" | "ld-extraction";
export type ProviderFailureCategory =
  | "quota_billing"
  | "authentication"
  | "timeout"
  | "rate_limit"
  | "invalid_response"
  | "configuration"
  | "model_unavailable"
  | "unknown";

export type SafeProviderFailure = {
  provider: AiProvider;
  flow: AiProviderFlow;
  model: string;
  category: ProviderFailureCategory;
  message: string;
  occurredAt: string;
};

type ProviderErrorShape = {
  status?: number;
  code?: string;
  type?: string;
  name?: string;
  message?: string;
};

const DEFAULT_AUDIT_STANDARD_MODEL = "gpt-5.4-mini";
const DEFAULT_AUDIT_DEEP_MODEL = "gpt-5.4";
const DEFAULT_LD_OPENAI_MODEL = "gpt-5.4";
const DEFAULT_LD_MIMO_MODEL = "mimo-v2.5";

const statusStore = globalThis as typeof globalThis & {
  __nexodocAiLastFailures?: Partial<Record<`${AiProviderFlow}:${AiProvider}`, SafeProviderFailure>>;
};

function readLocalEnvironmentValue(name: string) {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return undefined;
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));

  return line?.replace(`${name}=`, "").trim();
}

function getBackendValue(name: string) {
  const localValue = readLocalEnvironmentValue(name);

  return localValue !== undefined ? localValue : process.env[name]?.trim() || "";
}

function isConfigured(name: string) {
  return Boolean(getBackendValue(name));
}

export function getOpenAiApiKey() {
  return getBackendValue("OPENAI_API_KEY");
}

export function getMimoApiKey() {
  return getBackendValue("MIMO_API_KEY");
}

export function getOpenAiAdminKey() {
  return getBackendValue("OPENAI_ADMIN_KEY");
}

export function getAiConfiguration() {
  const auditStandardModel =
    getBackendValue("OPENAI_STANDARD_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL;
  const auditDeepModel =
    getBackendValue("OPENAI_DEEP_MODEL") ||
    getBackendValue("OPENAI_MODEL") ||
    DEFAULT_AUDIT_DEEP_MODEL;

  return {
    audit: {
      provider: "openai" as const,
      standardModel: auditStandardModel,
      standardValidationModel:
        getBackendValue("OPENAI_STANDARD_VALIDATION_MODEL") || auditStandardModel,
      deepModel: auditDeepModel,
      deepValidationModel:
        getBackendValue("OPENAI_DEEP_VALIDATION_MODEL") ||
        getBackendValue("OPENAI_VALIDATION_MODEL") ||
        auditDeepModel,
      keyConfigured: isConfigured("OPENAI_API_KEY"),
    },
    auditChat: {
      provider: "openai" as const,
      model: getBackendValue("OPENAI_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL,
      keyConfigured: isConfigured("OPENAI_API_KEY"),
    },
    administrationUsage: {
      provider: "openai" as const,
      purpose: "usage_costs",
      keyConfigured: isConfigured("OPENAI_ADMIN_KEY"),
    },
    ldExtraction: {
      primary: {
        provider: "openai" as const,
        model: getBackendValue("NEXODOC_LD_OPENAI_MODEL") || DEFAULT_LD_OPENAI_MODEL,
        keyConfigured: isConfigured("OPENAI_API_KEY"),
      },
      fallback: {
        provider: "mimo" as const,
        model: getBackendValue("MIMO_MODEL") || DEFAULT_LD_MIMO_MODEL,
        keyConfigured: isConfigured("MIMO_API_KEY"),
      },
    },
  };
}

export function getAuditModel(analysisLevel: "standard" | "deep") {
  const configuration = getAiConfiguration().audit;
  return analysisLevel === "deep" ? configuration.deepModel : configuration.standardModel;
}

export function getAuditValidationModel(analysisLevel: "standard" | "deep") {
  const configuration = getAiConfiguration().audit;
  return analysisLevel === "deep"
    ? configuration.deepValidationModel
    : configuration.standardValidationModel;
}

export function classifyProviderFailure(
  provider: AiProvider,
  flow: AiProviderFlow,
  model: string,
  error: unknown,
) {
  const candidate = error as ProviderErrorShape;
  const status = candidate.status;
  const rawCode = `${candidate.code ?? ""} ${candidate.type ?? ""}`.toLowerCase();
  const rawMessage = `${candidate.message ?? ""}`.toLowerCase();
  let category: ProviderFailureCategory = "unknown";

  if (rawCode.includes("insufficient_quota") || rawMessage.includes("insufficient_quota") || rawMessage.includes("billing")) {
    category = "quota_billing";
  } else if (status === 401 || status === 403 || rawCode.includes("invalid_api_key") || rawMessage.includes("api key")) {
    category = "authentication";
  } else if (candidate.name === "AbortError" || rawMessage.includes("timeout") || rawMessage.includes("tempo limite")) {
    category = "timeout";
  } else if (status === 429) {
    category = "rate_limit";
  } else if (rawCode === "invalid_response" || rawMessage.includes("resposta inválida")) {
    category = "invalid_response";
  } else if (rawCode === "configuration" || rawMessage.includes("não configurada")) {
    category = "configuration";
  } else if (status === 404 || rawMessage.includes("model") || rawMessage.includes("modelo")) {
    category = "model_unavailable";
  }

  return {
    provider,
    flow,
    model,
    category,
    message: getSafeProviderMessage(provider, category),
    occurredAt: new Date().toISOString(),
  } satisfies SafeProviderFailure;
}

export function getSafeProviderMessage(provider: AiProvider, category: ProviderFailureCategory) {
  const name = provider === "openai" ? "OpenAI" : "MiMo";

  switch (category) {
    case "quota_billing":
      return `${name} recusou a chamada por quota ou billing.`;
    case "authentication":
      return `${name} recusou a credencial configurada.`;
    case "timeout":
      return `${name} excedeu o tempo limite da chamada.`;
    case "rate_limit":
      return `${name} limitou temporariamente as requisições.`;
    case "invalid_response":
      return `${name} retornou uma resposta inválida para extração.`;
    case "configuration":
      return `A chave de ${name} não está configurada no backend.`;
    case "model_unavailable":
      return `O modelo configurado para ${name} não está disponível.`;
    default:
      return `A chamada ao provedor ${name} falhou.`;
  }
}

export function recordProviderFailure(failure: SafeProviderFailure) {
  statusStore.__nexodocAiLastFailures ??= {};
  statusStore.__nexodocAiLastFailures[`${failure.flow}:${failure.provider}`] = failure;
}

export function getLastProviderFailures() {
  return Object.values(statusStore.__nexodocAiLastFailures ?? {});
}

export function createInvalidProviderResponseError() {
  const error = new Error("Resposta inválida do provedor.") as Error & { code?: string };
  error.code = "invalid_response";
  return error;
}
