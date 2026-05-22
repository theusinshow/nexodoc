export const AUDIT_MODES = ["memorial", "volume"] as const;

export type AuditMode = (typeof AUDIT_MODES)[number];

export const DEFAULT_AUDIT_MODE: AuditMode = "memorial";

export function parseAuditMode(value: FormDataEntryValue | null): AuditMode {
  if (value === "volume") {
    return value;
  }

  return DEFAULT_AUDIT_MODE;
}

export function getAuditModeLabel(mode: AuditMode) {
  if (mode === "volume") {
    return "Volume de projeto";
  }

  return "Memorial";
}

export function getAuditModeDescription(mode: AuditMode) {
  if (mode === "volume") {
    return "Capa, separatriz, LDs e pranchas A1/A0.";
  }

  return "Memorial descritivo em A4, texto corrido.";
}
