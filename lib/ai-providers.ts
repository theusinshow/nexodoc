import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AiProvider = "openai" | "mimo" | "deepseek";
export type AiProviderFlow = "audit" | "audit-chat" | "ld-extraction" | "volume-analysis" | "volume-suggestion";
export type AuditAnalysisLevel = "standard" | "deep";
export type AuditModelRole = "identity" | "global" | "chunk" | "crossDocument";
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
const DEFAULT_LD_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_LD_MIMO_MODEL = "mimo-v2.5";
const DEFAULT_VOLUME_ANALYSIS_MODEL = "gpt-5.4-mini";
const DEFAULT_VOLUME_SUGGESTION_MODEL = "gpt-5.4-mini";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

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

function firstBackendValue(names: string[]) {
  for (const name of names) {
    const value = getBackendValue(name);

    if (value) {
      return value;
    }
  }

  return "";
}

function isConfigured(name: string) {
  return Boolean(getBackendValue(name));
}

export function getOpenAiApiKey() {
  return getBackendValue("OPENAI_API_KEY");
}

export function getSecretFingerprint(name: string) {
  const value = getBackendValue(name);

  if (!value) {
    return {
      configured: false,
      length: 0,
      prefix: "",
      suffix: "",
    };
  }

  return {
    configured: true,
    length: value.length,
    prefix: value.slice(0, 7),
    suffix: value.slice(-4),
  };
}

export function getMimoApiKey() {
  return getBackendValue("MIMO_API_KEY");
}

export function getDeepSeekApiKey() {
  return getBackendValue("DEEPSEEK_API_KEY");
}

export function getDeepSeekBaseUrl() {
  return getBackendValue("DEEPSEEK_BASE_URL") || "https://api.deepseek.com";
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
  const auditStandardValidationModel =
    getBackendValue("OPENAI_STANDARD_VALIDATION_MODEL") || auditStandardModel;
  const auditDeepValidationModel =
    getBackendValue("OPENAI_DEEP_VALIDATION_MODEL") ||
    getBackendValue("OPENAI_VALIDATION_MODEL") ||
    auditDeepModel;
  const standardRoleModels = {
    identity:
      firstBackendValue([
        "NEXODOC_AUDIT_STANDARD_IDENTITY_MODEL",
        "NEXODOC_AUDIT_IDENTITY_MODEL",
      ]) || auditStandardModel,
    global:
      firstBackendValue([
        "NEXODOC_AUDIT_STANDARD_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ]) || auditStandardModel,
    chunk:
      firstBackendValue([
        "NEXODOC_AUDIT_STANDARD_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ]) || auditStandardModel,
    crossDocument:
      firstBackendValue([
        "NEXODOC_AUDIT_STANDARD_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ]) || auditStandardModel,
  };
  const deepRoleModels = {
    identity:
      firstBackendValue([
        "NEXODOC_AUDIT_DEEP_IDENTITY_MODEL",
        "NEXODOC_AUDIT_IDENTITY_MODEL",
      ]) || auditDeepModel,
    global:
      firstBackendValue([
        "NEXODOC_AUDIT_DEEP_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ]) || auditDeepModel,
    chunk:
      firstBackendValue([
        "NEXODOC_AUDIT_DEEP_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ]) || auditDeepModel,
    crossDocument:
      firstBackendValue([
        "NEXODOC_AUDIT_DEEP_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ]) || auditDeepModel,
  };

  return {
    audit: {
      provider: "openai" as const,
      standardModel: auditStandardModel,
      standardValidationModel: auditStandardValidationModel,
      deepModel: auditDeepModel,
      deepValidationModel: auditDeepValidationModel,
      standardRoleModels,
      deepRoleModels,
      models: {
        standard: {
          primary: auditStandardModel,
          validation: auditStandardValidationModel,
          ...standardRoleModels,
        },
        deep: {
          primary: auditDeepModel,
          validation: auditDeepValidationModel,
          ...deepRoleModels,
        },
      },
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
    volumeAnalysis: {
      provider: "openai" as const,
      model: getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") || DEFAULT_VOLUME_ANALYSIS_MODEL,
      keyConfigured: isConfigured("OPENAI_API_KEY"),
    },
    volumeSuggestion: {
      provider: "openai" as const,
      model:
        getBackendValue("NEXODOC_VOLUME_SUGGESTION_MODEL") ||
        getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") ||
        DEFAULT_VOLUME_SUGGESTION_MODEL,
      keyConfigured: isConfigured("OPENAI_API_KEY"),
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
    deepseek: {
      provider: "deepseek" as const,
      enabled: getBackendValue("NEXODOC_ENABLE_DEEPSEEK") === "true",
      model: getBackendValue("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL,
      baseUrl: getDeepSeekBaseUrl(),
      keyConfigured: isConfigured("DEEPSEEK_API_KEY"),
      placeholderOnly: true,
      note: "Placeholder de provider. Ainda nao e usado pelos fluxos sem implementar runner/roteador especifico.",
    },
  };
}

export function getAuditModel(analysisLevel: AuditAnalysisLevel) {
  const configuration = getAiConfiguration().audit;
  return analysisLevel === "deep" ? configuration.deepModel : configuration.standardModel;
}

export function getAuditTaskModel(analysisLevel: AuditAnalysisLevel, role: AuditModelRole) {
  const configuration = getAiConfiguration().audit;
  const models =
    analysisLevel === "deep"
      ? configuration.deepRoleModels
      : configuration.standardRoleModels;

  return models[role];
}

export function getAuditValidationModel(analysisLevel: AuditAnalysisLevel) {
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
  const name =
    provider === "openai" ? "OpenAI" : provider === "mimo" ? "MiMo" : "DeepSeek";

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
