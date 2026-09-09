import type { AssemblyRow, VolumeMetadata } from "./volume-types";
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

export function generateZipFileName(
  metadata: VolumeMetadata,
  rows: AssemblyRow[] = []
): string {
  /*
   * O NOME DA PASTA BAIXADA. Antes era `<centro de custo>_volumes_montados.zip`
   * -- dizia o que o arquivo e, nao de que obra ele e. Quem baixa dois volumes
   * da mesma obra ficava com dois arquivos de nome identico na pasta.
   *
   * Agora o nome carrega o que identifica o volume no escritorio: centro de
   * custo + disciplina(s) + volume, na ordem em que se fala (084_25_met_vol_12).
   * As disciplinas saem dos blocos montados, na ordem em que aparecem -- volume
   * misto lista todas. Campo que o engenheiro nao preencheu simplesmente nao
   * entra: nome inventado e pior do que nome curto.
   */
  const parts: string[] = [];

  if (metadata.projectCode) {
    parts.push(metadata.projectCode);
  }

  const disciplines = collectDisciplineCodes(rows);
  parts.push(...disciplines);

  const volume = normalizeVolumeToken(metadata.volume);
  if (volume) {
    parts.push(`vol_${volume}`);
  }

  // Sem disciplina e sem volume o nome nao diria o que o arquivo e; volta o
  // rotulo antigo para nao entregar um zip chamado so "084_25".
  if (disciplines.length === 0 && !volume) {
    parts.push("volumes_montados");
  }

  const fileName = parts.length > 0 ? parts.join("_") : "volumes_montados";
  return `${sanitizeFileName(fileName)}.zip`;
}

function collectDisciplineCodes(rows: AssemblyRow[]): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const row of rows) {
    for (const block of row.blocks ?? []) {
      const code = sanitizeFileName((block.disciplineCode ?? "").trim().toLowerCase());
      if (!code || seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
  }

  return codes;
}

function normalizeVolumeToken(volume: string | undefined): string {
  if (!volume) return "";

  // "12", "vol 12" e "Volume 12" descrevem o mesmo volume; sem isto o nome
  // sairia "vol_volume_12".
  const cleaned = volume.trim().replace(/^(volumes?|vols?)[\s._-]*/i, "");
  return sanitizeFileName(cleaned.toLowerCase());
}

export function generateReportFileName(metadata: VolumeMetadata): string {
  const parts: string[] = [];

  if (metadata.projectCode) {
    parts.push(metadata.projectCode);
  }

  parts.push("relatorio_montagem");

  return `${sanitizeFileName(parts.join("_"))}.md`;
}
