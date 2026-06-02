import type { PageSelection, PageSelectionMode } from "@/modules/volume-builder/lib/volume/volume-types";

export function parsePageSelection(input: string): PageSelection | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const startPage = parseInt(rangeMatch[1], 10);
    const endPage = parseInt(rangeMatch[2], 10);
    if (startPage > 0 && endPage >= startPage) {
      return {
        sourceFileId: "",
        sourceFileName: "",
        mode: "page_range" as PageSelectionMode,
        startPage,
        endPage,
      };
    }
  }

  const singlePageMatch = trimmed.match(/^\d+$/);
  if (singlePageMatch) {
    const page = parseInt(trimmed, 10);
    if (page > 0) {
      return {
        sourceFileId: "",
        sourceFileName: "",
        mode: "specific_pages" as PageSelectionMode,
        pages: [page],
      };
    }
  }

  const mixedMatch = trimmed.match(/^[\d,\s-]+$/);
  if (mixedMatch) {
    const pages = expandPageExpression(trimmed);
    if (pages.length > 0) {
      return {
        sourceFileId: "",
        sourceFileName: "",
        mode: "specific_pages" as PageSelectionMode,
        pages,
      };
    }
  }

  return null;
}

function expandPageExpression(input: string): number[] {
  const parts = input.split(",").map((p) => p.trim());
  const pages: number[] = [];

  for (const part of parts) {
    if (!part) continue;

    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start > 0 && end >= start) {
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page > 0) {
        pages.push(page);
      }
    }
  }

  return [...new Set(pages)].sort((a, b) => a - b);
}

export function formatPageSelection(selection: PageSelection): string {
  switch (selection.mode) {
    case "entire_file":
      return "Arquivo inteiro";
    case "page_range":
      return `Paginas ${selection.startPage}-${selection.endPage}`;
    case "specific_pages":
      return `Paginas ${selection.pages?.join(", ")}`;
    default:
      return "";
  }
}

export function getPageCount(selection: PageSelection): number | null {
  switch (selection.mode) {
    case "entire_file":
      return null;
    case "page_range":
      if (selection.startPage !== undefined && selection.endPage !== undefined) {
        return selection.endPage - selection.startPage + 1;
      }
      return null;
    case "specific_pages":
      return selection.pages?.length ?? null;
    default:
      return null;
  }
}

export function validatePageSelectionAgainstPageCount(
  selection: PageSelection,
  pageCount: number
): string[] {
  const warnings: string[] = [];

  if (pageCount === 0) {
    return warnings;
  }

  if (selection.mode === "page_range") {
    if (selection.startPage !== undefined && selection.startPage < 1) {
      warnings.push("Pagina inicial invalida.");
    }
    if (selection.endPage !== undefined && selection.endPage > pageCount) {
      warnings.push(
        `Pagina final (${selection.endPage}) excede total de paginas (${pageCount}).`
      );
    }
    if (
      selection.startPage !== undefined &&
      selection.endPage !== undefined &&
      selection.startPage > selection.endPage
    ) {
      warnings.push("Pagina inicial maior que pagina final.");
    }
  }

  if (selection.mode === "specific_pages" && selection.pages) {
    const invalidPages = selection.pages.filter(
      (p) => p < 1 || p > pageCount
    );
    if (invalidPages.length > 0) {
      warnings.push(
        `Paginas fora do intervalo: ${invalidPages.join(", ")} (total: ${pageCount}).`
      );
    }
  }

  return warnings;
}
