export function normalizeProjectCode(code: string): string {
  return code.trim().replace(/\s+/g, "_").toLowerCase();
}
