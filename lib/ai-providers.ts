import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getCachedAiModelOverride } from "@/lib/ai-model-config";

export type AiProvider = "openai" | "mimo" | "deepseek";
export type AiProviderFlow = "audit" | "audit-chat" | "nexo-agent" | "ld-extraction" | "volume-analysis" | "volume-suggestion" | "volume-conferencia";
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
/**
 * LEITURA DE SELO — o padrão é o mini, e isso é decisão, não economia cega.
 *
 * É **uma chamada com visão por prancha**, e um volume real tem dezenas. O
 * modelo aqui só COPIA campo de carimbo; quem julga o que foi lido é regra
 * determinística (`server/nexo/selo-identity-core.ts`). Modelo maior não
 * melhora o veredito, só multiplica tempo e custo.
 *
 * O padrão era `gpt-5.5` enquanto o uso de verdade rodava em `gpt-5.4-mini`
 * pelo `.env.local`. Quem subiu para produção sem repetir a variável ganhou o
 * modelo grande sem pedir, e o sintoma foi "está demorando muito para escanear
 * as pranchas" — o software funcionando, só que lento e caro. Padrão que não
 * é o valor validado em uso é armadilha.
 */
const DEFAULT_LD_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_LD_MIMO_MODEL = "mimo-v2.5";
const DEFAULT_VOLUME_ANALYSIS_MODEL = "gpt-5.5";
const DEFAULT_VOLUME_SUGGESTION_MODEL = "gpt-5.4-mini";
/**
 * A conferência do volume montado lê um recorte de carimbo por página, e são
 * MUITAS páginas. Um modelo mini dá conta de copiar campo de carimbo, e o
 * flow é configurável no painel — trocar por `nano` é um clique, sem código.
 */
const DEFAULT_VOLUME_CONFERENCIA_MODEL = "gpt-5.4-mini";
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

// Provider por fluxo: permite, por exemplo, auditoria no OpenAI e LD/Volumes na
// DeepSeek. Cai no provider global (NEXODOC_AI_PROVIDER) quando não sobrescrito.
function getFlowProvider(
  flow: "audit" | "volume" | "ld",
  fallback: "openai" | "deepseek",
): "openai" | "deepseek" {
  const key =
    flow === "audit"
      ? "NEXODOC_AUDIT_PROVIDER"
      : flow === "volume"
        ? "NEXODOC_VOLUME_PROVIDER"
        : "NEXODOC_LD_PROVIDER";
  const value = getBackendValue(key).toLowerCase();

  if (value === "deepseek") {
    return "deepseek";
  }

  if (value === "openai") {
    return "openai";
  }

  return fallback;
}

/**
 * Provider do agente Nexo (carro-chefe). Default OPENAI (o provider "fiel") —
 * NÃO herda o global barato, porque o agente precisa de JSON confiável para
 * propor os parâmetros. Override explícito via NEXODOC_NEXO_PROVIDER=deepseek.
 */
export function getNexoProvider(): "openai" | "deepseek" {
  return getBackendValue("NEXODOC_NEXO_PROVIDER").toLowerCase() === "deepseek"
    ? "deepseek"
    : "openai";
}

/**
 * Provider da CONFERÊNCIA DO VOLUME MONTADO. Default OPENAI — NÃO herda
 * `NEXODOC_VOLUME_PROVIDER`, pelo mesmo motivo de `getNexoProvider`.
 *
 * O grupo "volume" é documentado no README como o barato (`analise/sugestao de
 * volumes`, tipicamente DeepSeek), e essas duas tarefas são de TEXTO. A
 * conferência não é: ela lê um recorte de carimbo, e visão é REQUISITO, não
 * preferência. Herdar o grupo barato fez a conferência morrer em toda página no
 * primeiro projeto real — 15 de 18 páginas com "precisa de um modelo com
 * visão", que é uma configuração razoável derrubando um recurso inteiro.
 *
 * Quem quiser mesmo apontar para outro provider tem o override explícito, e aí
 * o portão da rota avisa em vez de devolver leitura vazia.
 */
export function getConferenciaVolumeProvider(): "openai" | "deepseek" {
  return getBackendValue("NEXODOC_VOLUME_CONFERENCIA_PROVIDER").toLowerCase() === "deepseek"
    ? "deepseek"
    : "openai";
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
  flowId?: string,
) {
  const override = flowId ? getCachedAiModelOverride(flowId) : "";

  if (override) {
    return override;
  }

  return provider === "deepseek"
    ? getDeepSeekModel(deepSeekModelNames)
    : openAiModel;
}

function getProviderRoleModel(args: {
  provider: "openai" | "deepseek";
  baseModel: string;
  openAiModelNames: string[];
  deepSeekModelNames: string[];
  flowId?: string;
}) {
  const override = args.flowId ? getCachedAiModelOverride(args.flowId) : "";

  if (override) {
    return override;
  }

  if (args.provider === "deepseek") {
    return getDeepSeekModel(args.deepSeekModelNames) || args.baseModel;
  }

  return firstBackendValue(args.openAiModelNames) || args.baseModel;
}

export function getAiConfiguration() {
  const globalProvider = getPrimaryAiProvider();
  const auditProvider = getFlowProvider("audit", globalProvider);
  const volumeProvider = getFlowProvider("volume", globalProvider);
  const ldProvider = getFlowProvider("ld", globalProvider);
  const nexoProvider = getNexoProvider();
  // Visão é REQUISITO da conferência do volume: ela não segue o grupo "volume",
  // que é o barato e cuida de tarefas de texto. Ver `getConferenciaVolumeProvider`.
  const conferenciaVolumeProvider = getConferenciaVolumeProvider();
  // A auditoria e o chat pós-auditoria seguem auditProvider; volume e LD têm os
  // seus próprios. primaryProvider é apelido de auditProvider para o bloco de
  // auditoria abaixo (que domina esta função).
  const primaryProvider = auditProvider;
  const auditStandardModel =
    getProviderModel(
      primaryProvider,
      getBackendValue("OPENAI_STANDARD_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL,
      ["DEEPSEEK_AUDIT_STANDARD_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      "audit-standard",
    );
  const auditDeepModel =
    getProviderModel(
      primaryProvider,
      getBackendValue("OPENAI_DEEP_MODEL") ||
        getBackendValue("OPENAI_MODEL") ||
        DEFAULT_AUDIT_DEEP_MODEL,
      ["DEEPSEEK_AUDIT_DEEP_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      "audit-deep",
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
      "audit-standard-validation",
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
      "audit-deep-validation",
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
      flowId: "audit-standard-identity",
    }),
    global: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_GLOBAL_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      flowId: "audit-standard-global",
    }),
    chunk: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_CHUNK_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      flowId: "audit-standard-chunk",
    }),
    crossDocument: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_STANDARD_CROSS_DOCUMENT_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      flowId: "audit-standard-cross-document",
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
      flowId: "audit-deep-identity",
    }),
    global: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_GLOBAL_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      flowId: "audit-deep-global",
    }),
    chunk: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_CHUNK_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      flowId: "audit-deep-chunk",
    }),
    crossDocument: getProviderRoleModel({
      provider: primaryProvider,
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ],
      deepSeekModelNames: ["DEEPSEEK_AUDIT_DEEP_CROSS_DOCUMENT_MODEL", "DEEPSEEK_AUDIT_MODEL"],
      flowId: "audit-deep-cross-document",
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
        "audit-chat",
      ),
      keyConfigured: getProviderKeyConfigured(primaryProvider),
    },
    nexoAgent: {
      provider: nexoProvider,
      model: getProviderModel(
        nexoProvider,
        getBackendValue("OPENAI_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL,
        ["DEEPSEEK_NEXO_MODEL", "DEEPSEEK_AUDIT_CHAT_MODEL", "DEEPSEEK_MODEL"],
        "nexo-agent",
      ),
      keyConfigured: getProviderKeyConfigured(nexoProvider),
    },
    administrationUsage: {
      provider: "openai" as const,
      purpose: "usage_costs",
      keyConfigured: isConfigured("OPENAI_ADMIN_KEY"),
    },
    volumeAnalysis: {
      provider: volumeProvider,
      model: getProviderModel(
        volumeProvider,
        getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") || DEFAULT_VOLUME_ANALYSIS_MODEL,
        ["DEEPSEEK_VOLUME_ANALYSIS_MODEL"],
        "volume-analysis",
      ),
      keyConfigured: getProviderKeyConfigured(volumeProvider),
    },
    volumeSuggestion: {
      provider: volumeProvider,
      model: getProviderModel(
        volumeProvider,
        getBackendValue("NEXODOC_VOLUME_SUGGESTION_MODEL") ||
          getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") ||
          DEFAULT_VOLUME_SUGGESTION_MODEL,
        ["DEEPSEEK_VOLUME_SUGGESTION_MODEL", "DEEPSEEK_VOLUME_ANALYSIS_MODEL"],
        "volume-suggestion",
      ),
      keyConfigured: getProviderKeyConfigured(volumeProvider),
    },
    volumeConferencia: {
      provider: conferenciaVolumeProvider,
      model: getProviderModel(
        conferenciaVolumeProvider,
        getBackendValue("NEXODOC_VOLUME_CONFERENCIA_MODEL") ||
          DEFAULT_VOLUME_CONFERENCIA_MODEL,
        ["DEEPSEEK_VOLUME_CONFERENCIA_MODEL"],
        "volume-conferencia",
      ),
      keyConfigured: getProviderKeyConfigured(conferenciaVolumeProvider),
    },
    ldExtraction: {
      primary: {
        provider: ldProvider,
        model: getProviderModel(
          ldProvider,
          getBackendValue("NEXODOC_LD_OPENAI_MODEL") || DEFAULT_LD_OPENAI_MODEL,
          ["DEEPSEEK_LD_MODEL"],
          "ld-primary",
        ),
        keyConfigured: getProviderKeyConfigured(ldProvider),
      },
      fallback: {
        provider: "mimo" as const,
        model: getCachedAiModelOverride("ld-fallback") || getBackendValue("MIMO_MODEL") || DEFAULT_LD_MIMO_MODEL,
        keyConfigured: isConfigured("MIMO_API_KEY"),
      },
    },
    deepseek: {
      provider: "deepseek" as const,
      enabled: getBackendValue("NEXODOC_ENABLE_DEEPSEEK") === "true",
      model: getCachedAiModelOverride("deepseek-provider") || getBackendValue("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL,
      baseUrl: getDeepSeekBaseUrl(),
      keyConfigured: isConfigured("DEEPSEEK_API_KEY"),
      placeholderOnly: false,
      note:
        globalProvider === "deepseek"
          ? "DeepSeek configurado como provider global padrão."
          : "DeepSeek disponivel; defina NEXODOC_AI_PROVIDER=deepseek (global) ou NEXODOC_LD_PROVIDER/NEXODOC_VOLUME_PROVIDER (por fluxo).",
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
