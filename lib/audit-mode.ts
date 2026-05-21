export const AUDIT_MODES = ["fast", "volume", "complete"] as const;

export type AuditMode = (typeof AUDIT_MODES)[number];

export const DEFAULT_AUDIT_MODE: AuditMode = "fast";

export function parseAuditMode(value: FormDataEntryValue | null): AuditMode {
  if (value === "volume" || value === "complete") {
    return value;
  }

  return DEFAULT_AUDIT_MODE;
}

export function getAuditModeLabel(mode: AuditMode) {
  if (mode === "volume") {
    return "Checagem de volume";
  }

  return mode === "complete" ? "Auditoria completa" : "Auditoria rápida";
}
