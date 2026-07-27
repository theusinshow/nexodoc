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
};

export async function executeAuditModelResponse(args: {
  taskId?: string | null;
  taskLabel?: string | null;
  model: string;
  operation: string;
  request: AuditOpenAiRequest;
  timeoutMs?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  conversationId?: string | null;
}) {
  return executeOpenAiResponse({
    flow: "audit",
    taskId: args.taskId,
    taskLabel: args.taskLabel,
    model: args.model,
    operation: args.operation,
    request: args.request,
    timeoutMs: args.timeoutMs,
    metadata: args.metadata ?? {},
    conversationId: args.conversationId,
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
