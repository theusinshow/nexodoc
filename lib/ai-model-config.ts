import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const AI_MODEL_OPTIONS = [
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "deepseek-chat",
  "deepseek-v4-pro",
  "deepseek-v4-flash(1)",
  "mimo-v2.5",
] as const;

export const AI_MODEL_FLOW_DEFINITIONS = [
  { id: "audit-standard", label: "Auditoria padrão" },
  { id: "audit-standard-identity", label: "Auditoria padrão - identidade" },
  { id: "audit-standard-global", label: "Auditoria padrão - leitura global" },
  { id: "audit-standard-chunk", label: "Auditoria padrão - blocos" },
  { id: "audit-standard-cross-document", label: "Auditoria padrão - comparação entre arquivos" },
  { id: "audit-standard-validation", label: "Auditoria padrão - validação" },
  { id: "audit-deep", label: "Auditoria profunda" },
  { id: "audit-deep-identity", label: "Auditoria profunda - identidade" },
  { id: "audit-deep-global", label: "Auditoria profunda - leitura global" },
  { id: "audit-deep-chunk", label: "Auditoria profunda - blocos" },
  { id: "audit-deep-cross-document", label: "Auditoria profunda - comparação entre arquivos" },
  { id: "audit-deep-validation", label: "Auditoria profunda - validação" },
  { id: "audit-chat", label: "Chat pós-auditoria" },
  { id: "volume-analysis", label: "Volumes - validação da montagem" },
  { id: "volume-suggestion", label: "Volumes - sugestão de montagem" },
  { id: "volume-conferencia", label: "Volumes - conferência do volume montado" },
  { id: "ld-primary", label: "LD - leitura principal" },
  { id: "ld-fallback", label: "LD - fallback" },
  { id: "deepseek-provider", label: "DeepSeek - configuração" },
] as const;

export type AiModelFlowId = (typeof AI_MODEL_FLOW_DEFINITIONS)[number]["id"];

export type AiModelOverride = {
  flowId: string;
  label: string;
  model: string;
  isActive: boolean;
  notes: string;
  updatedBy: string | null;
  updatedAt: string;
};

const CACHE_TTL_MS = 15_000;

const modelConfigStore = globalThis as typeof globalThis & {
  __nexodocAiModelOverrides?: {
    loadedAt: number;
    rows: AiModelOverride[];
    byFlowId: Record<string, AiModelOverride>;
  };
};

function getFlowDefinition(flowId: string) {
  return AI_MODEL_FLOW_DEFINITIONS.find((definition) => definition.id === flowId);
}

export function isKnownAiModelFlow(flowId: string): flowId is AiModelFlowId {
  return Boolean(getFlowDefinition(flowId));
}

export function normalizeAiModelName(model: string) {
  return model.trim();
}

export function validateAiModelName(model: string) {
  const normalized = normalizeAiModelName(model);

  if (!normalized) {
    return "Informe um modelo.";
  }

  if (normalized.length > 120) {
    return "Modelo muito longo.";
  }

  if (!/^[a-zA-Z0-9._:()/-]+$/.test(normalized)) {
    return "Use apenas letras, números, ponto, hífen, barra, dois-pontos, parênteses ou underline.";
  }

  return "";
}

function setModelConfigCache(rows: AiModelOverride[]) {
  modelConfigStore.__nexodocAiModelOverrides = {
    loadedAt: Date.now(),
    rows,
    byFlowId: Object.fromEntries(rows.filter((row) => row.isActive).map((row) => [row.flowId, row])),
  };
}

export function getCachedAiModelOverride(flowId: string) {
  return modelConfigStore.__nexodocAiModelOverrides?.byFlowId[flowId]?.model;
}

export function getCachedAiModelOverrides() {
  return modelConfigStore.__nexodocAiModelOverrides?.rows ?? [];
}

export async function refreshAiModelOverrideCache(options: { force?: boolean } = {}) {
  const current = modelConfigStore.__nexodocAiModelOverrides;

  if (!options.force && current && Date.now() - current.loadedAt < CACHE_TTL_MS) {
    return current.rows;
  }

  if (!isDatabaseConfigured()) {
    setModelConfigCache([]);
    return [];
  }

  try {
    const rows = await getPrisma().aiModelConfig.findMany({
      orderBy: [{ flowId: "asc" }],
    });
    const normalizedRows = rows.map((row) => ({
      flowId: row.flowId,
      label: row.label,
      model: row.model,
      isActive: row.isActive,
      notes: row.notes,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    }));

    setModelConfigCache(normalizedRows);

    return normalizedRows;
  } catch (error) {
    console.warn("Não foi possível carregar overrides de modelo IA.", error);
    setModelConfigCache([]);
    return [];
  }
}

export async function listAiModelConfigs() {
  return refreshAiModelOverrideCache({ force: true });
}

export async function upsertAiModelConfig(args: {
  flowId: string;
  model: string;
  updatedBy?: string | null;
  notes?: string;
}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const definition = getFlowDefinition(args.flowId);

  if (!definition) {
    throw new Error("Fluxo de IA desconhecido.");
  }

  const modelError = validateAiModelName(args.model);

  if (modelError) {
    throw new Error(modelError);
  }

  const model = normalizeAiModelName(args.model);

  await getPrisma().aiModelConfig.upsert({
    where: {
      flowId: args.flowId,
    },
    update: {
      label: definition.label,
      model,
      isActive: true,
      notes: args.notes?.trim() ?? "",
      updatedBy: args.updatedBy ?? null,
    },
    create: {
      flowId: args.flowId,
      label: definition.label,
      model,
      isActive: true,
      notes: args.notes?.trim() ?? "",
      updatedBy: args.updatedBy ?? null,
    },
  });

  return refreshAiModelOverrideCache({ force: true });
}

export async function disableAiModelConfig(flowId: string, updatedBy?: string | null) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }

  if (!isKnownAiModelFlow(flowId)) {
    throw new Error("Fluxo de IA desconhecido.");
  }

  await getPrisma().aiModelConfig.updateMany({
    where: {
      flowId,
    },
    data: {
      isActive: false,
      updatedBy: updatedBy ?? null,
    },
  });

  return refreshAiModelOverrideCache({ force: true });
}
