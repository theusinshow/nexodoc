import type { VolumeMetadata } from "./volume-types";
import { sanitizeFileName } from "@/modules/volume-builder/lib/utils/sanitize-file-name";

export function generateOutputFileName(
  metadata: VolumeMetadata,
  disciplineCodes: string[],
  tomoIndex?: number
): string {
  const parts: string[] = [];

  if (metadata.projectCode) {
    parts.push(metadata.projectCode);
  }

  if (metadata.volume) {
    parts.push(`vol_${metadata.volume}`);
  }

  if (disciplineCodes.length > 0) {
    parts.push(disciplineCodes.join("_").toLowerCase());
  }

  if (tomoIndex !== undefined) {
    parts.push(`tomo${String(tomoIndex).padStart(2, "0")}`);
  } else if (metadata.tomo) {
    parts.push(`tomo${metadata.tomo}`);
  }

  if (metadata.revision) {
    parts.push(metadata.revision.toLowerCase());
  }

  const fileName = parts.length > 0 ? parts.join("_") : "volume";
  return `${sanitizeFileName(fileName)}.pdf`;
}

export function generateZipFileName(metadata: VolumeMetadata): string {
  const parts: string[] = [];

  if (metadata.projectCode) {
    parts.push(metadata.projectCode);
  }

  parts.push("volumes_montados");

  return `${sanitizeFileName(parts.join("_"))}.zip`;
}

export function generateReportFileName(metadata: VolumeMetadata): string {
  const parts: string[] = [];

  if (metadata.projectCode) {
    parts.push(metadata.projectCode);
  }

  parts.push("relatorio_montagem");

  return `${sanitizeFileName(parts.join("_"))}.md`;
}
