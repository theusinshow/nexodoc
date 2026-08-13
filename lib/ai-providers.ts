import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getCachedAiModelOverride } from "@/lib/ai-model-config";
import {
  classifyProviderErrorCategory,
  isInvalidProviderResponseError,
  type ProviderFailureCategory,
} from "@/lib/ai-failure-policy";

export { isInvalidProviderResponseError };
export type { ProviderFailureCategory };

/**
 * UM PROVEDOR SÓ, DE PROPÓSITO (13/08/2026).
 *
 * O projeto teve três: OpenAI, MiMo (fallback de visão da LD) e DeepSeek
 * (alternativa barata por fluxo). Os dois últimos foram removidos porque já
 * estavam mortos e ninguém sabia: a última chamada ao MiMo é de 26/06/2026, e a
 * do DeepSeek é de 20/07/2026 — 88 chamadas seguidas que FALHARAM todas, com
 * `DEEPSEEK_MODEL=deepseek-v4-flash(1)`, um nome inválido nascido do sufixo de
 * arquivo duplicado que o navegador põe em "arquivo (1).pdf". O nome quebrado
 * ainda era oferecido no dropdown do painel.
 *
 * Manter provedor desligado custa mais do que parece: cada função de modelo
 * carregava um par de listas (`openAiModelNames`/`deepSeekModelNames`), cada
 * fluxo tinha um `*_PROVIDER` para escolher errado, e a conferência do volume
 * já morreu uma vez inteira por herdar o grupo "barato" sem visão.
 *
 * O tipo continua existindo — e não vira `string` — para que a telemetria
 * histórica (167 eventos MiMo, 100 DeepSeek) siga legível e para que voltar a
 * ter dois provedores um dia seja uma mudança de tipo, não uma arqueologia.
 */
export type AiProvider = "openai";
export type AiProviderFlow = "audit" | "audit-chat" | "nexo-agent" | "ld-extraction" | "volume-analysis" | "volume-suggestion" | "volume-conferencia";
export type AuditAnalysisLevel = "standard" | "deep";
export type AuditModelRole = "identity" | "global" | "chunk" | "crossDocument";
export type AuditMode = "memorial" | "volume";
export type AuditExecutionRole = AuditModelRole | "validation";

export type SafeProviderFailure = {
  provider: AiProvider;
  flow: AiProviderFlow;
  model: string;
  category: ProviderFailureCategory;
  message: string;
  occurredAt: string;
};

/**
 * AUDITORIA GENÉRICA (não-memorial). Os dois níveis e os seus doze papéis.
 *
 * Rodavam em `gpt-5.5` até 11/08/2026 — resíduo de quando a geração 5.6 ainda
 * não existia, não escolha de critério. O `terra` iguala o 5.5 nos benchmarks
 * de inteligência da própria OpenAI e custa $2/$12 contra $5/$30: 2,5x menos
 * pela mesma capacidade declarada. O `gpt-5.5` ainda custava o MESMO que o
 * `sol`, que é o topo da geração seguinte — era pagar preço de fronteira por
 * geração anterior.
 *
 * Nota de contexto: hoje este caminho é frio. `modules/nexo/lib/audit.ts` manda
 * `auditMode` fixo em "memorial", então toda auditoria que passa pelo Nexo usa
 * os modelos de memorial. A troca aqui não economiza nada agora — ela evita que
 * ligar o modo volume um dia comece a gastar no tier mais caro sem decisão.
 */
const DEFAULT_AUDIT_STANDARD_MODEL = "gpt-5.6-terra";
const DEFAULT_AUDIT_DEEP_MODEL = "gpt-5.6-terra";
const DEFAULT_AUDIT_MEMORIAL_STANDARD_MODEL = "gpt-5.6-terra";
const DEFAULT_AUDIT_MEMORIAL_DEEP_MODEL = "gpt-5.6-sol";
/**
 * O MODELO BARATO DO SISTEMA — usado por tudo que só COPIA campo de carimbo.
 *
 * A leitura de selo é **uma chamada com visão por prancha**, e um volume real
 * tem dezenas. O modelo aqui não julga nada: quem compara o que foi lido com o
 * gabarito é regra determinística (`selo-identity-core.ts`, `volume-check-core.ts`).
 * Modelo maior não melhora o veredito, só multiplica tempo e custo.
 *
 * O padrão era `gpt-5.5` enquanto o uso de verdade rodava em `gpt-5.4-mini`
 * pelo `.env.local`. Quem subiu para produção sem repetir a variável ganhou o
 * modelo grande sem pedir, e o sintoma foi "está demorando muito para escanear
 * as pranchas" — o software funcionando, só que lento e caro. Padrão que não é
 * o valor validado em uso é armadilha, e é por isso que a troca do barato mexe
 * no default E no `.env.local` juntos.
 */
const DEFAULT_LD_OPENAI_MODEL = "gpt-5.6-luna";
/**
 * CONVERSA — agente Nexo e chat pós-auditoria.
 *
 * Os dois liam `OPENAI_MODEL` direto, e essa variável é TAMBÉM o fallback da
 * auditoria profunda (`OPENAI_DEEP_MODEL || OPENAI_MODEL`). Baixar o modelo da
 * conversa mexendo nela levava a auditoria junto, sem aviso — um knob que
 * governa duas coisas que não se parecem. Daí `NEXODOC_NEXO_MODEL` e
 * `NEXODOC_AUDIT_CHAT_MODEL`, que ainda caem em `OPENAI_MODEL` quando não
 * definidas, para não quebrar quem já configurou pelo jeito antigo.
 *
 * Conversa quer RESPOSTA RÁPIDA e barata, não raciocínio profundo: o `terra`
 * ($2/$12 por 1M) com `effort` baixo é o ponto certo. O `sol`/`gpt-5.5`
 * ($5/$30) paga por deliberação que ninguém espera num chat.
 */
const DEFAULT_CONVERSATION_MODEL = "gpt-5.6-terra";
/**
 * Organização de volumes — análise e sugestão no MESMO modelo, de propósito.
 *
 * As duas tarefas são de texto e olham o mesmo material; separá-las em modelos
 * diferentes fazia a sugestão propor uma montagem que a análise depois
 * reprovava, e o usuário via o software discordar de si mesmo.
 *
 * O padrão acompanha o valor em uso (`.env.example` e `render.yaml`): padrão
 * que não é o valor validado é armadilha — ver o comentário do modelo de LD
 * logo acima, que descreve o estrago quando os dois se separam.
 */
const DEFAULT_VOLUME_ANALYSIS_MODEL = "gpt-5.6-terra";
const DEFAULT_VOLUME_SUGGESTION_MODEL = "gpt-5.6-terra";
/**
 * A conferência do volume montado lê um recorte de carimbo por página, e são
 * MUITAS páginas. O modelo barato dá conta de copiar campo de carimbo, e o
 * flow é configurável no painel — trocar de modelo é um clique, sem código.
 */
const DEFAULT_VOLUME_CONFERENCIA_MODEL = "gpt-5.6-luna";

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

export function getOpenAiAdminKey() {
  return getBackendValue("OPENAI_ADMIN_KEY");
}

/**
 * Existia um provider por fluxo (`NEXODOC_AUDIT_PROVIDER`, `_VOLUME_`, `_LD_`,
 * `_NEXO_`, `_VOLUME_CONFERENCIA_`) para poder rodar auditoria na OpenAI e o
 * resto no barato. Com um provedor só, essas variáveis viraram cinco maneiras
 * de escrever "openai" — e uma delas já derrubou um recurso inteiro: a
 * conferência do volume herdou o grupo "barato", que não tem visão, e morreu em
 * 15 de 18 páginas no primeiro projeto real.
 */
const AI_PROVIDER = "openai" as const;

function getProviderKeyConfigured() {
  return isConfigured("OPENAI_API_KEY");
}

function getProviderModel(openAiModel: string, flowId?: string) {
  const override = flowId ? getCachedAiModelOverride(flowId) : "";

  return override || openAiModel;
}

function getProviderRoleModel(args: {
  baseModel: string;
  openAiModelNames: string[];
  flowId?: string;
}) {
  const override = args.flowId ? getCachedAiModelOverride(args.flowId) : "";

  if (override) {
    return override;
  }

  return firstBackendValue(args.openAiModelNames) || args.baseModel;
}

export function getAiConfiguration() {
  const auditStandardModel = getProviderModel(
    getBackendValue("OPENAI_STANDARD_MODEL") || DEFAULT_AUDIT_STANDARD_MODEL,
    "audit-standard",
  );
  const auditDeepModel = getProviderModel(
    getBackendValue("OPENAI_DEEP_MODEL") ||
      getBackendValue("OPENAI_MODEL") ||
      DEFAULT_AUDIT_DEEP_MODEL,
    "audit-deep",
  );
  const auditStandardValidationModel = getProviderModel(
    getBackendValue("OPENAI_STANDARD_VALIDATION_MODEL") || auditStandardModel,
    "audit-standard-validation",
  );
  const auditDeepValidationModel = getProviderModel(
    getBackendValue("OPENAI_DEEP_VALIDATION_MODEL") ||
      getBackendValue("OPENAI_VALIDATION_MODEL") ||
      auditDeepModel,
    "audit-deep-validation",
  );
  const standardRoleModels = {
    identity: getProviderRoleModel({
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_IDENTITY_MODEL",
        "NEXODOC_AUDIT_IDENTITY_MODEL",
      ],
      flowId: "audit-standard-identity",
    }),
    global: getProviderRoleModel({
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ],
      flowId: "audit-standard-global",
    }),
    chunk: getProviderRoleModel({
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ],
      flowId: "audit-standard-chunk",
    }),
    crossDocument: getProviderRoleModel({
      baseModel: auditStandardModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_STANDARD_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ],
      flowId: "audit-standard-cross-document",
    }),
  };
  const deepRoleModels = {
    identity: getProviderRoleModel({
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_IDENTITY_MODEL",
        "NEXODOC_AUDIT_IDENTITY_MODEL",
      ],
      flowId: "audit-deep-identity",
    }),
    global: getProviderRoleModel({
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_GLOBAL_MODEL",
        "NEXODOC_AUDIT_GLOBAL_MODEL",
      ],
      flowId: "audit-deep-global",
    }),
    chunk: getProviderRoleModel({
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_CHUNK_MODEL",
        "NEXODOC_AUDIT_CHUNK_MODEL",
      ],
      flowId: "audit-deep-chunk",
    }),
    crossDocument: getProviderRoleModel({
      baseModel: auditDeepModel,
      openAiModelNames: [
        "NEXODOC_AUDIT_DEEP_CROSS_DOCUMENT_MODEL",
        "NEXODOC_AUDIT_CROSS_DOCUMENT_MODEL",
      ],
      flowId: "audit-deep-cross-document",
    }),
  };

  return {
    audit: {
      provider: AI_PROVIDER,
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
      keyConfigured: getProviderKeyConfigured(),
    },
    auditChat: {
      provider: AI_PROVIDER,
      model: getProviderModel(
        getBackendValue("NEXODOC_AUDIT_CHAT_MODEL") ||
          getBackendValue("OPENAI_MODEL") ||
          DEFAULT_CONVERSATION_MODEL,
        "audit-chat",
      ),
      keyConfigured: getProviderKeyConfigured(),
    },
    nexoAgent: {
      provider: AI_PROVIDER,
      model: getProviderModel(
        getBackendValue("NEXODOC_NEXO_MODEL") ||
          getBackendValue("OPENAI_MODEL") ||
          DEFAULT_CONVERSATION_MODEL,
        "nexo-agent",
      ),
      keyConfigured: getProviderKeyConfigured(),
    },
    administrationUsage: {
      provider: "openai" as const,
      purpose: "usage_costs",
      keyConfigured: isConfigured("OPENAI_ADMIN_KEY"),
    },
    volumeAnalysis: {
      provider: AI_PROVIDER,
      model: getProviderModel(
        getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") || DEFAULT_VOLUME_ANALYSIS_MODEL,
        "volume-analysis",
      ),
      keyConfigured: getProviderKeyConfigured(),
    },
    volumeSuggestion: {
      provider: AI_PROVIDER,
      model: getProviderModel(
        getBackendValue("NEXODOC_VOLUME_SUGGESTION_MODEL") ||
          getBackendValue("NEXODOC_VOLUME_ANALYSIS_MODEL") ||
          DEFAULT_VOLUME_SUGGESTION_MODEL,
        "volume-suggestion",
      ),
      keyConfigured: getProviderKeyConfigured(),
    },
    volumeConferencia: {
      provider: AI_PROVIDER,
      model: getProviderModel(
        getBackendValue("NEXODOC_VOLUME_CONFERENCIA_MODEL") || DEFAULT_VOLUME_CONFERENCIA_MODEL,
        "volume-conferencia",
      ),
      keyConfigured: getProviderKeyConfigured(),
    },
    ldExtraction: {
      primary: {
        provider: AI_PROVIDER,
        model: getProviderModel(
          getBackendValue("NEXODOC_LD_OPENAI_MODEL") || DEFAULT_LD_OPENAI_MODEL,
          "ld-primary",
        ),
        keyConfigured: getProviderKeyConfigured(),
      },
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

export function getAuditExecutionProfile(args: {
  auditMode: AuditMode;
  analysisLevel: AuditAnalysisLevel;
  role?: AuditExecutionRole;
}) {
  const configuration = getAiConfiguration().audit;
  const currentModel =
    args.role === "validation"
      ? args.analysisLevel === "deep"
        ? configuration.deepValidationModel
        : configuration.standardValidationModel
      : args.role
        ? args.analysisLevel === "deep"
          ? configuration.deepRoleModels[args.role]
          : configuration.standardRoleModels[args.role]
        : args.analysisLevel === "deep"
          ? configuration.deepModel
          : configuration.standardModel;

  if (args.auditMode !== "memorial") {
    return {
      provider: configuration.provider,
      model: currentModel,
    } as const;
  }

  /*
   * Havia aqui um desvio para "provider != openai": o modo memorial tem os seus
   * próprios modelos, e só fazia sentido aplicá-los quando o provedor era a
   * OpenAI. Com um provedor só, a condição nunca é verdadeira — e uma condição
   * que nunca dispara é pior que código morto, porque parece cobrir um caso.
   */
  if (args.analysisLevel === "standard") {
    return {
      provider: "openai" as const,
      model:
        getCachedAiModelOverride("audit-memorial-standard") ||
        getBackendValue("NEXODOC_AUDIT_MEMORIAL_STANDARD_MODEL") ||
        DEFAULT_AUDIT_MEMORIAL_STANDARD_MODEL,
    };
  }

  const baseOverride = getCachedAiModelOverride("audit-memorial-deep");
  const roleOverride =
    args.role === "global"
      ? getCachedAiModelOverride("audit-memorial-deep-global") ||
        getBackendValue("NEXODOC_AUDIT_MEMORIAL_DEEP_GLOBAL_MODEL")
      : args.role === "validation"
        ? getCachedAiModelOverride("audit-memorial-deep-validation") ||
          getBackendValue("NEXODOC_AUDIT_MEMORIAL_DEEP_VALIDATION_MODEL")
        : undefined;

  return {
    provider: "openai" as const,
    model:
      roleOverride ||
      baseOverride ||
      getBackendValue("NEXODOC_AUDIT_MEMORIAL_DEEP_MODEL") ||
      DEFAULT_AUDIT_MEMORIAL_DEEP_MODEL,
  };
}

export function classifyProviderFailure(
  provider: AiProvider,
  flow: AiProviderFlow,
  model: string,
  error: unknown,
) {
  const category = classifyProviderErrorCategory(error);

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
  // O parâmetro sobrevive à remoção dos outros provedores porque a assinatura é
  // pública e o nome aparece na mensagem que o usuário lê.
  const name = provider === "openai" ? "OpenAI" : provider;

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
