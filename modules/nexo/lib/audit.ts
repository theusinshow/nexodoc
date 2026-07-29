/**
 * Auditoria do MEMORIAL contra a obra das pranchas (caso raro do fluxo Nexo).
 * REUSA o motor de auditoria existente (`/api/audit`) — não reimplementa nada.
 *
 * Sacada: o Nexo já conhece a IDENTIDADE (obra/código do carimbo, prefeitura do
 * template escolhido). Ele passa isso como GABARITO (ground truth) para a
 * auditoria, que então pega de graça o erro que originou o projeto: um memorial
 * emitido com o nome/dados de OUTRA obra.
 */
import type { AuditReport } from "@/lib/audit-report";

export interface MemorialAuditGabarito {
  obra?: string;
  prefeitura?: string;
  municipio?: string;
}

export type MemorialAuditLevel = "standard" | "deep";

export interface MemorialAuditResult {
  /** O parecer estruturado — é o que a tela de relatório consome. */
  report: AuditReport;
  /** O mesmo parecer em texto corrido, para copiar/exportar. */
  texto: string;
  /** Id persistido; sem ele o feedback por achado não tem onde gravar. */
  auditId: string | null;
}

/**
 * Roda a auditoria do memorial. `level` "deep" é mais completa (mais tokens).
 *
 * CONTRATO: `/api/audit` responde `{ result, report, auditId }`, onde `result` é
 * o relatório em TEXTO e `report` é o objeto. Ler `result` como se fosse o objeto
 * — o que esta função fazia — grava uma string onde o relatório deveria estar, e
 * a tela quebra ao contar os achados. O teste em `audit-contrato.test.ts` casa os
 * dois lados justamente porque `tsc` não vê através de um `as`.
 */
export async function runMemorialAudit(
  memorial: File,
  gabarito: MemorialAuditGabarito = {},
  level: MemorialAuditLevel = "standard",
  conversationId?: string | null,
): Promise<MemorialAuditResult> {
  const form = new FormData();
  form.append(
    "message",
    "Auditoria do memorial descritivo contra a obra declarada das pranchas.",
  );
  form.append("auditMode", "memorial");
  form.append("analysisLevel", level);
  form.append("files", memorial, memorial.name);
  form.append("fileTypes", "memorial");
  if (gabarito.obra?.trim()) form.append("gabaritoObra", gabarito.obra.trim());
  if (gabarito.prefeitura?.trim()) {
    form.append("gabaritoPrefeitura", gabarito.prefeitura.trim());
  }
  if (gabarito.municipio?.trim()) {
    form.append("gabaritoMunicipio", gabarito.municipio.trim());
  }
  // Carimba a conversa do Nexo no consumo de IA desta auditoria (anel de consumo).
  if (conversationId) form.append("conversationId", conversationId);

  const res = await fetch("/api/audit", { method: "POST", body: form });
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; result?: string; report?: AuditReport; auditId?: string | null }
    | null;
  if (!res.ok || !payload?.report) {
    throw new Error(payload?.error ?? "Falha na auditoria do memorial.");
  }
  return {
    report: payload.report,
    texto: typeof payload.result === "string" ? payload.result : "",
    auditId: payload.auditId ?? null,
  };
}
