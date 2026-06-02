import type { ImportedPdfFile, PageAsset } from "./volume-types";

export function createPageAssetsForFile(file: ImportedPdfFile): PageAsset[] {
  return Array.from({ length: file.pageCount }, (_, index) => {
    const pageNumber = index + 1;

    return {
      id: `${file.id}-page-${pageNumber}`,
      sourceFileId: file.id,
      sourceFileName: file.name,
      pageNumber,
      pageCount: file.pageCount,
      role: file.role,
    };
  });
}

export function createPageSelectionFromAsset(asset: PageAsset) {
  return {
    sourceFileId: asset.sourceFileId,
    sourceFileName: asset.sourceFileName,
    mode: "specific_pages" as const,
    pages: [asset.pageNumber],
  };
}
