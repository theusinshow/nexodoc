import type { ImportedPdfFile, PageAssetRole } from "./volume-types";

let fileCounter = 0;

export function createImportedPdfFile(
  file: File,
  role: PageAssetRole = "document"
): ImportedPdfFile {
  fileCounter++;
  return {
    id: `file-${Date.now()}-${fileCounter}`,
    name: file.name,
    originalName: file.name,
    role,
    size: file.size,
    mimeType: "application/pdf",
    pageCount: 0,
    thumbnailStatus: "not_loaded",
    warnings: [],
  };
}

export function extractFileInfo(file: File): Partial<ImportedPdfFile> {
  return {
    name: file.name,
    originalName: file.name,
    role: "document",
    size: file.size,
    mimeType: "application/pdf",
    pageCount: 0,
    thumbnailStatus: "not_loaded",
    warnings: [],
  };
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}
