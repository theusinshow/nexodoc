export const AUDIT_MODES = ["fast", "complete"] as const;

export type AuditMode = (typeof AUDIT_MODES)[number];

export const DEFAULT_AUDIT_MODE: AuditMode = "fast";

export function parseAuditMode(value: FormDataEntryValue | null): AuditMode {
  return value === "complete" ? "complete" : DEFAULT_AUDIT_MODE;
}

export function getAuditModeLabel(mode: AuditMode) {
  return mode === "complete" ? "Auditoria completa" : "Auditoria rápida";
}
