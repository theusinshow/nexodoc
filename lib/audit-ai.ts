import { executeOpenAiResponse } from "@/lib/ai-runner";

type AuditOpenAiRequest = Parameters<typeof executeOpenAiResponse>[0]["request"];

export type ModelFinding = {
  prioridade?: string;
  pagina?: string | number;
  capitulo?: string;
  local?: string;
  tipo?: string;
  descricao?: string;
  evidencia?: string;
  termo_busca?: string;
  arquivo?: string;
  categoria?: string;
  referencia_comparada?: string;
  conflito?: string;
  sugestao_correcao?: string;
  confianca?: string;
  /** faixa de consequência declarada pelo modelo; validada por parseFindingImpact */
  impacto?: string;
};

export type ValidationDecision = {
  source_id?: string;
  acao?: "confirmar" | "rebaixar" | "remover";
  prioridade?: string;
  impacto?: "critico_documental" | "tecnico_contratual" | "revisao_editorial";
  tipo?: string;
  descricao?: string;
  conflito?: string;
  sugestao_correcao?: string;
  confianca?: string;
  motivo?: string;
};

export type RefutationVerdict = {
  source_id?: string;
  sustentado?: boolean;
  motivo?: string;
};

export type AuditModelJson = {
  findings?: ModelFinding[];
  comparisons?: string[];
  decisions?: ValidationDecision[];
  verdicts?: RefutationVerdict[];
  /**
   * Uma linha por capítulo, com o que ele AFIRMA. Só a leitura global devolve
   * isto — é a única passada que recebe o documento inteiro. Alimenta a
   * reauditoria barata: os capítulos que não mudaram vão ao modelo como uma
   * linha cada, em vez de em texto integral.
   */
  sintese?: { capitulo?: string; resumo?: string }[];
};

export async function executeAuditModelResponse(args: {
  taskId?: string | null;
  taskLabel?: string | null;
  model: string;
  providerOverride?: Parameters<typeof executeOpenAiResponse>[0]["providerOverride"];
  operation: string;
  request: AuditOpenAiRequest;
  timeoutMs?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  conversationId?: string | null;
  /** E-mail da sessão — viaja SEMPRE junto com `conversationId` (telemetria). */
  userEmail?: string | null;
}) {
  return executeOpenAiResponse({
    flow: "audit",
    providerOverride: args.providerOverride,
    taskId: args.taskId,
    taskLabel: args.taskLabel,
    model: args.model,
    operation: args.operation,
    request: args.request,
    timeoutMs: args.timeoutMs,
    metadata: args.metadata ?? {},
    conversationId: args.conversationId,
    userEmail: args.userEmail,
  });
}

export function parseAuditModelJson(text: string): AuditModelJson | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as AuditModelJson;
  } catch {
    return null;
  }
}
