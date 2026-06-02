import type { ImportedPdfFile, PageAsset, VolumeMetadata } from "./volume-types";

export type AssemblySuggestionConfidence = "high" | "medium" | "low";

export type AssemblySuggestion = {
  id: string;
  title: string;
  outputFileName: string;
  coverAssetId?: string;
  ldAssetId?: string;
  separatorTitle: string;
  documentAssetIds: string[];
  confidence: AssemblySuggestionConfidence;
  notes: string[];
};

export type AssemblySuggestionRequest = {
  metadata: VolumeMetadata;
  importedFiles: ImportedPdfFile[];
  pageAssets: PageAsset[];
};

export type AssemblySuggestionResponse = {
  suggestions: AssemblySuggestion[];
  source: "ai" | "local";
  model?: string;
  warnings: string[];
};
