/**
 * OS FLUXOS DE IA QUE EXISTEM — a lista, num lugar só.
 *
 * Vinte e três entradas montadas a partir de `getAiConfiguration` e dos perfis
 * de execução. Ela vivia dentro de `buildConfigPayload`, na rota de
 * configuração, e isso bastava enquanto só aquela tela a usava.
 *
 * Deixou de bastar quando a FAIXA DE ATENÇÃO ("2 fluxos sem chave") saiu da
 * Config e foi para o cockpit: ou a lista saía dali, ou o cockpit contaria por
 * outra base — e as duas telas do mesmo painel diriam números diferentes sobre
 * a mesma coisa.
 */
import { getAiConfiguration, getAuditExecutionProfile, getSecretFingerprint } from "@/lib/ai-providers";

export interface FluxoDeIa {
  id: string;
  label: string;
  provider: string;
  model: string;
  keyConfigured: boolean;
}

export function listarFluxosDeIa(): FluxoDeIa[] {
  const ai = getAiConfiguration();
  const memorialStandard = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "standard",
  });
  const memorialDeep = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "deep",
  });
  const memorialDeepGlobal = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "deep",
    role: "global",
  });
  const memorialDeepValidation = getAuditExecutionProfile({
    auditMode: "memorial",
    analysisLevel: "deep",
    role: "validation",
  });
  const openAiKeyConfigured = getSecretFingerprint("OPENAI_API_KEY").configured;

  const aiFlows = [
    {
      id: "audit-memorial-standard",
      label: "Auditoria normal de memorial",
      provider: memorialStandard.provider,
      model: memorialStandard.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-memorial-deep",
      label: "Auditoria profunda de memorial",
      provider: memorialDeep.provider,
      model: memorialDeep.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-memorial-deep-global",
      label: "Auditoria profunda de memorial - leitura global",
      provider: memorialDeepGlobal.provider,
      model: memorialDeepGlobal.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-memorial-deep-validation",
      label: "Auditoria profunda de memorial - validação",
      provider: memorialDeepValidation.provider,
      model: memorialDeepValidation.model,
      keyConfigured: openAiKeyConfigured,
    },
    {
      id: "audit-standard",
      label: "Auditoria padrão",
      provider: ai.audit.provider,
      model: ai.audit.standardModel,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-standard-identity",
      label: "Auditoria padrão - identidade",
      provider: ai.audit.provider,
      model: ai.audit.models.standard.identity,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-standard-global",
      label: "Auditoria padrão - leitura global",
      provider: ai.audit.provider,
      model: ai.audit.models.standard.global,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-standard-chunk",
      label: "Auditoria padrão - blocos",
      provider: ai.audit.provider,
      model: ai.audit.models.standard.chunk,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-standard-cross-document",
      label: "Auditoria padrão - comparação entre arquivos",
      provider: ai.audit.provider,
      model: ai.audit.models.standard.crossDocument,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-standard-validation",
      label: "Auditoria padrão - validação",
      provider: ai.audit.provider,
      model: ai.audit.models.standard.validation,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-deep",
      label: "Auditoria profunda",
      provider: ai.audit.provider,
      model: ai.audit.deepModel,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-deep-identity",
      label: "Auditoria profunda - identidade",
      provider: ai.audit.provider,
      model: ai.audit.models.deep.identity,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-deep-global",
      label: "Auditoria profunda - leitura global",
      provider: ai.audit.provider,
      model: ai.audit.models.deep.global,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-deep-chunk",
      label: "Auditoria profunda - blocos",
      provider: ai.audit.provider,
      model: ai.audit.models.deep.chunk,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-deep-cross-document",
      label: "Auditoria profunda - comparação entre arquivos",
      provider: ai.audit.provider,
      model: ai.audit.models.deep.crossDocument,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-deep-validation",
      label: "Auditoria profunda - validação",
      provider: ai.audit.provider,
      model: ai.audit.models.deep.validation,
      keyConfigured: ai.audit.keyConfigured,
    },
    {
      id: "audit-chat",
      label: "Chat pós-auditoria",
      provider: ai.auditChat.provider,
      model: ai.auditChat.model,
      keyConfigured: ai.auditChat.keyConfigured,
    },
    {
      id: "volume-analysis",
      label: "Volumes - validação da montagem",
      provider: ai.volumeAnalysis.provider,
      model: ai.volumeAnalysis.model,
      keyConfigured: ai.volumeAnalysis.keyConfigured,
    },
    {
      id: "volume-suggestion",
      label: "Volumes - sugestão de montagem",
      provider: ai.volumeSuggestion.provider,
      model: ai.volumeSuggestion.model,
      keyConfigured: ai.volumeSuggestion.keyConfigured,
    },
    {
      id: "ld-primary",
      label: "LD - leitura principal",
      provider: ai.ldExtraction.primary.provider,
      model: ai.ldExtraction.primary.model,
      keyConfigured: ai.ldExtraction.primary.keyConfigured,
    },
  ];

  return aiFlows;
}
