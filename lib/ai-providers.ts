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

const DEFAULT_AUDIT_STANDARD_MODEL = "gpt-5.5";
const DEFAULT_AUDIT_DEEP_MODEL = "gpt-5.5";
const DEFAULT_LD_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_LD_MIMO_MODEL = "mimo-v2.5";
const DEFAULT_VOLUME_ANALYSIS_MODEL = "gpt-5.5";
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

function getPrimaryAiProvider(): "openai" | "deepseek" {
  const provider = (
    getBackendValue("NEXODOC_AI_PROVIDER") ||
    getBackendValue("NEXODOC_PRIMARY_AI_PROVIDER")
  ).toLowerCase();

  if (provider === "deepseek") {
    return "deepseek";
  }

  return "openai";
}

function getProviderKeyConfigured(provider: "openai" | "deepseek") {
  return provider === "deepseek"
    ? isConfigured("DEEPSEEK_API_KEY")
    : isConfigured("OPENAI_API_KEY");
}

function getDeepSeekModel(names: string[]) {
  return firstBackendValue(names) || getBackendValue("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL;
}

function getProviderModel(
  provider: "openai" | "deepseek",
  openAiModel: string,
  deepSeekModelNames: string[] = [],
) {
  return provider === "deepseek"
    ? getDeepSeekModel(deepSeekModelNames)
    : openAiModel;
}

function getProviderRoleModel(args: {
  provider: "openai" | "deepseek";
  baseModel: string;
  openAiModelNames: string[];
  deepSeekModelNames: string[];
}) {
  if (args.provider === "deepseek") {
    return getDeepSeekModel(args.deepSeekModelNames) || args.baseModel;
  }

  return firstBackendValue(args.openAiModelNames) || args.baseModel;
}

export function getAiConfiguration() {
  const primaryProvider = getPrimaryAiProvider();
  const auditStandardModel =
    getProviderModel(
      primaryProvider,
      getBackendValue("OPENAI_STANDARD_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL,
      ["DEEPSEEK_AUDIT_STANDARD_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    );
  const auditDeepModel =
    getProviderModel(
      primaryProvider,
      getBackendValue("OPENAI_DEEP_MODEL") ||
        getBackendValue("OPENAI_MODEL") ||
        DEFAULT_AUDIT_DEEP_MODEL,
      ["DEEPSEEK_AUDIT_DEEP_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    );
  const auditStandardValidationModel =
    getProviderModel(
      primaryProvider,
      getBackendValue("OPENAI_STANDARD_VALIDATION_MODEL") || auditStandardModel,
      [
        "DEEPSEEK_AUDIT_STANDARD_VALIDATION_MODEL",
        "DEEPSEEK_AUDIT_VALIDATION_MODEL",
        "DEEPSEEK_AUDIT_MODEL",
      ],
    );
  const auditDeepValidationModel =
    getProviderModel(
      primaryProvider,
      getBackendValue("OPENAI_DEEP_VALIDATION_MODEL") ||
        getBackendValue("OPENAI_VALIDATION_MODEL") ||
        auditDeepModel,
      [
        "DEEPSEEK_AUDIT_DEEP_VALIDATION_MODEL",
        "DEEPSEEK_AUDIT_VALIDATION_MODEL",
        "DEEPSEEK_AUDIT_MODEL",
      ],
    );
  const standardRoleModels = {
    identity: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_IDENTITY_MODEL",
        "NEXODOC_AUDIT_IDENTITY_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_IDENTITY_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
    global: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_GLOBAL_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
    chunk: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_CHUNK_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
    crossDocument: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_CROSS_DOCUMENT_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
  };
  const deepRoleModels = {
    identity: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_IDENTITY_MODEL",
        "NEXODOC_AUDIT_IDENTITY_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_IDENTITY_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
    global: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_GLOBAL_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
    chunk: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_CHUNK_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
    crossDocument: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_CROSS_DOCUMENT_MODEL", "DEEPSEEK_AUDIT_MODEL"],
    }),
  };

  return {
    audit: {
      provider: primaryProvider,
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
      keyConfigured: getProviderKeyConfigured(primaryProvider),
    },
    auditChat: {
      provider: primaryProvider,
      model: getProviderModel(
        primaryProvider,
        getBackendValue("OPENAI_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL,
        ["DEEPSEEK_AUDIT_CHAT_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      ),
      keyConfigured: getProviderKeyConfigured(primaryProvider),
    },
    administrationUsage: {
      provider: "openai" as const,
      purpose: "usage_costs",
      keyConfigured: isConfigured("OPENAI_ADMIN_KEY"),
    },
    volumeAnalysis: {
      provider: primaryProvider,
      model: getProviderModel(
        primaryProvider,
        getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") || DEFAULT_VOLUME_ANALYSIS_MODEL,
        ["DEEPSEEK_VOLUME_ANALYSIS_MODEL"],
      ),
      keyConfigured: getProviderKeyConfigured(primaryProvider),
    },
    volumeSuggestion: {
      provider: primaryProvider,
      model: getProviderModel(
        primaryProvider,
        getBackendValue("NEXODOC_VOLUME_SUGGESTION_MODEL") ||
          getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") ||
          DEFAULT_VOLUME_SUGGESTION_MODEL,
        ["DEEPSEEK_VOLUME_SUGGESTION_MODEL", "DEEPSEEK_VOLUME_ANALYSIS_MODEL"],
      ),
      keyConfigured: getProviderKeyConfigured(primaryProvider),
    },
    ldExtraction: {
      primary: {
        provider: primaryProvider,
        model: getProviderModel(
          primaryProvider,
          getBackendValue("NEXODOC_LD_OPENAI_MODEL") || DEFAULT_LD_OPENAI_MODEL,
          ["DEEPSEEK_LD_MODEL"],
        ),
        keyConfigured: getProviderKeyConfigured(primaryProvider),
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
      placeholderOnly: false,
      note:
        primaryProvider === "deepseek"
          ? "DeepSeek configurado como provider principal."
          : "DeepSeek disponivel; defina NEXODOC_AI_PROVIDER=deepseek para usar como principal.",
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
