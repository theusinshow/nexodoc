import type { CoverGroup, CoverPage } from "../types";
import type { TomoFormat, VolumeFormat } from "@/lib/cover-utils";
import { formatTomo, formatVolume } from "@/lib/cover-utils";

export type { TomoFormat, VolumeFormat } from "@/lib/cover-utils";
export {
  formatVolume,
  formatMesAno,
  formatTomo,
  formatDisplayCode,
  getFileName,
} from "@/lib/cover-utils";

export function getTomos(group: CoverGroup): string[] {
  if (group.tomoMode === "quantity") {
    return Array.from({ length: group.tomoQuantity }, (_, i) =>
      String(i + 1).padStart(2, "0")
    );
  }
  return group.tomoList.filter((t) => t.trim() !== "");
}

export function generatePages(
  groups: CoverGroup[],
  existingPages?: CoverPage[],
  volumeFormat: VolumeFormat = "roman",
  tomoFormat: TomoFormat = "parenthesized-padded"
): CoverPage[] {
  const allTomos: { tomo: string }[] = [];
  for (const group of groups) {
    const tomos = getTomos(group);
    for (const t of tomos) {
      allTomos.push({ tomo: t });
    }
  }

  const totalTomos = allTomos.length;

  const pages: CoverPage[] = [];
  let tomoIndex = 0;
  let pageIndex = 0;

  if (existingPages && existingPages.length > 0) {
    const groupPageMap = new Map<string, CoverPage[]>();
    for (const page of existingPages) {
      const list = groupPageMap.get(page.groupId) || [];
      list.push(page);
      groupPageMap.set(page.groupId, list);
    }

    for (const group of groups) {
      const tomos = getTomos(group);
      const existing = groupPageMap.get(group.id) || [];
      for (let i = 0; i < tomos.length; i++) {
        const prev = existing[i];
        pages.push({
          id: prev?.id ?? crypto.randomUUID(),
          groupId: group.id,
          tituloCapa: prev?.tituloCapa ?? group.tituloCapa,
          disciplina: prev?.disciplina ?? group.disciplina,
          tomo: prev?.tomo ?? formatTomo(tomos[i], totalTomos, tomoFormat),
          volume: prev?.volume ?? formatVolume(group.volume, volumeFormat),
          pageNumber: ++pageIndex,
        });
      }
    }
  } else {
    for (const group of groups) {
      const tomos = getTomos(group);
      for (const t of tomos) {
        pages.push({
          id: crypto.randomUUID(),
          groupId: group.id,
          tituloCapa: group.tituloCapa,
          disciplina: group.disciplina,
          tomo: formatTomo(t, totalTomos, tomoFormat),
          volume: formatVolume(group.volume, volumeFormat),
          pageNumber: ++pageIndex,
        });
      }
      tomoIndex += tomos.length;
    }
  }

  return pages;
}
