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
