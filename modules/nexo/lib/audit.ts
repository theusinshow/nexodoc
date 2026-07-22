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

/**
 * Roda a auditoria do memorial. `level` "deep" é mais completa (mais tokens).
 * Devolve o AuditReport do motor existente.
 */
export async function runMemorialAudit(
  memorial: File,
  gabarito: MemorialAuditGabarito = {},
  level: MemorialAuditLevel = "standard",
): Promise<AuditReport> {
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

  const res = await fetch("/api/audit", { method: "POST", body: form });
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; result?: AuditReport }
    | null;
  if (!res.ok || !payload?.result) {
    throw new Error(payload?.error ?? "Falha na auditoria do memorial.");
  }
  return payload.result;
}
