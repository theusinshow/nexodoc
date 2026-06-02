export type VolumeStatus =
  | "sem_problemas"
  | "ponto_de_atencao"
  | "problema_de_montagem";

export type VolumeMetadata = {
  projectCode: string;
  projectName: string;
  client?: string;
  city?: string;
  volume?: string;
  tomo?: string;
  revision?: string;
  date?: string;
};

export type ImportedPdfFile = {
  id: string;
  name: string;
  originalName: string;
  role: PageAssetRole;
  size: number;
  mimeType: "application/pdf";
  pageCount: number;
  thumbnailStatus: "not_loaded" | "loading" | "ready" | "error";
  warnings: string[];
};

export type PageAssetRole = "cover" | "ld" | "document" | "separator" | "appendix";

export type PageClassificationSource = "filename" | "pdf-text" | "filename+pdf-text" | "manual" | "ai";

export type PageClassification = {
  role: PageAssetRole | "unknown";
  disciplineCode?: string;
  disciplineName?: string;
  blockCode?: string;
  documentCode?: string;
  sheetNumber?: string;
  title?: string;
  revision?: string;
  volumeHint?: string;
  projectCode?: string;
  confidence: number;
  source: PageClassificationSource;
  warnings: string[];
};

export type PageAsset = {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  pageNumber: number;
  pageCount: number;
  summary?: string;
  role?: PageAssetRole;
  classification?: PageClassification;
};

export type PageSelectionMode = "entire_file" | "page_range" | "specific_pages";

export type PageSelection = {
  sourceFileId: string;
  sourceFileName: string;
  mode: PageSelectionMode;
  startPage?: number;
  endPage?: number;
  pages?: number[];
};

export type AssemblySlotType = "cover" | "ld" | "document" | "separator" | "appendix";

export type AssemblySlot = {
  id: string;
  type: AssemblySlotType;
  label: string;
  selection?: PageSelection;
  warnings: string[];
};

export type AssemblyBlock = {
  id: string;
  title: string;
  disciplineCode: string;
  disciplineName?: string;
  separatorTitle: string;
  separator?: AssemblySlot;
  ld?: AssemblySlot;
  documents: AssemblySlot[];
  appendices?: AssemblySlot[];
  status: VolumeStatus;
  warnings: string[];
};

export type AssemblyRow = {
  id: string;
  order: number;
  title: string;
  cover?: AssemblySlot;
  blocks: AssemblyBlock[];
  outputFileName: string;
  status: VolumeStatus;
  warnings: string[];
  requiresManualConfirmation: boolean;
};

export type BatchAssemblyConfig = {
  metadata: VolumeMetadata;
  importedFiles: ImportedPdfFile[];
  rows: AssemblyRow[];
  outputMode: "single_pdf" | "zip";
};

export type BatchAnalysisResult = {
  status: VolumeStatus;
  summary: string;
  batchWarnings: string[];
  rowWarnings: {
    rowId: string;
    rowTitle: string;
    warnings: string[];
    problems: string[];
  }[];
  requiresManualConfirmation: boolean;
};
