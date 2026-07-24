/**
 * Próximos passos DETERMINÍSTICOS a partir do que a mensagem propôs (núcleo puro,
 * só `import type` → testável com node cru). Ordem do fluxo do escritório:
 * ld → capa → conferência → volume. Cada passo vira um chip que ENVIA a frase ao
 * agente (a IA re-propõe). Vazio quando não há LD/capa proposta (nada a encadear).
 */
import type { NexoAgentProposal } from "../types";

/** Um próximo passo: rótulo + a frase que vai ao agente ao clicar. */
export interface NextStep {
  label: string;
  send: string;
}

export function nextStepsFor(proposals: NexoAgentProposal[] | undefined): NextStep[] {
  const kinds = new Set((proposals ?? []).map((p) => p.kind));
  if (!kinds.has("ld") && !kinds.has("capa")) return [];
  const steps: NextStep[] = [];
  if (kinds.has("ld") && !kinds.has("capa")) {
    steps.push({ label: "Gerar a capa", send: "Gera a capa também" });
  }
  if (kinds.has("capa") && !kinds.has("ld")) {
    steps.push({ label: "Gerar a LD", send: "Gera a LD também" });
  }
  steps.push({ label: "Conferir as folhas", send: "Confere as folhas" });
  steps.push({ label: "Montar o volume", send: "Monta o volume" });
  return steps;
}
