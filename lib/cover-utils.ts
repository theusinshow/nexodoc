export type CoverTitleMode = "items" | "volume-title-items";

export type VolumeFormat = "roman" | "numeric";

export type TomoFormat =
  | "parenthesized-padded"
  | "parenthesized"
  | "plain-padded"
  | "plain";

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Valor do marcador {{VOLUME}} no ODT. O RÓTULO ("Vol."/"VOLUME") já vem escrito
 * no próprio template de cada prefeitura — então o marcador leva só o valor cru
 * ("I", "1"). Antes, o formato romano adicionava "Vol." e, somado ao literal do
 * template, saía "Vol. Vol. I". Para exibir na UI (prévia), use formatVolumeDisplay.
 */
export function formatVolume(value: string): string {
  return value;
}

/** Volume com rótulo, só para exibição na UI (o ODT usa formatVolume cru). */
export function formatVolumeDisplay(
  value: string,
  format: VolumeFormat = "roman",
): string {
  if (!value) return "";
  return format === "numeric" ? `Volume ${value}` : `Vol. ${value}`;
}

export function formatMesAno(mes: string, ano: string): string {
  if (!mes && !ano) return "";
  if (!mes) return ano;
  if (!ano) return mes;
  return `${mes}/${ano}`;
}

/**
 * Rótulos dos tomos de um documento: `quantos` tomos contando A PARTIR de
 * `inicial` (padrão 1), com dois dígitos.
 *
 * Existe porque a contagem de tomos é do VOLUME, não do documento. Num volume
 * de estrutural onde "Concreto" já ocupou os tomos 01-03, os dois tomos de
 * "Concreto Implantação" são 04 e 05 — reiniciar em 01 produziria dois tomos
 * 01 no mesmo volume. Antes só existia "divida em N", que sempre recomeçava.
 *
 * Tolerante a lixo (0, negativo, NaN) porque o valor vem da conversa: cai no
 * comportamento de sempre (um tomo, começando no 1) em vez de quebrar.
 */
export function tomoLabels(quantos: number, inicial: number = 1): string[] {
  const n = Math.max(1, Math.floor(quantos) || 1);
  const start = Math.max(1, Math.floor(inicial) || 1);
  return Array.from({ length: n }, (_, i) =>
    String(start + i).padStart(2, "0"),
  );
}

export function formatTomo(
  tomoNumber: string,
  totalTomos: number,
  format: TomoFormat = "parenthesized-padded"
): string {
  if (totalTomos <= 1) return "";
  const numeric = String(parseInt(tomoNumber, 10) || tomoNumber);
  const padded = numeric.padStart(2, "0");

  if (format === "plain") return `TOMO ${numeric}`;
  if (format === "plain-padded") return `TOMO ${padded}`;
  if (format === "parenthesized") return `(TOMO ${numeric})`;
  return `(TOMO ${padded})`;
}

export function formatDisplayCode(codigoInterno: string): string {
  return codigoInterno.replace(/_/g, "-");
}

export function getFileName(
  codigoInterno: string,
  complemento: string,
  revisao: string,
  ext: string
): string {
  return [codigoInterno, "capas", complemento, revisao]
    .filter((part) => part.trim())
    .join("_") + `.${ext}`;
}
