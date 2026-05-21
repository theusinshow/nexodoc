import type { AuditMode } from "@/lib/audit-mode";
import { getDemoAuditResult } from "@/lib/audit-demo-data";

export function getMockAuditResult(mode: AuditMode) {
  return getDemoAuditResult(mode);
}

export function isMockModeEnabled() {
  return process.env.NEXODOC_MOCK_MODE === "true";
}

export async function waitForMockAudit() {
  const delay = Number(process.env.NEXODOC_MOCK_DELAY_MS ?? 3500);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
