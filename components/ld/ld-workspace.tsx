"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleX,
  Copy,
  Download,
  FileArchive,
  FileSearch,
  FileText,
  Filter,
  Gauge,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { encodeLdData } from "@/modules/ld-interop";
import {
  buildBalancedTomos,
  compareBySheet,
  formatSheet,
  parseSheet,
  updateTomoQuantity,
  validateRows,
  type ReviewRow,
  type RowIssue,
  type Tomo,
  type ValidationResult,
} from "@/lib/ld/ld-rules";

type LdData = {
  projectCode: string;
  formattedCode: string;
  discipline: string;
  revision: string;
  sectionTitle: string;
  client: string;
  workName: string;
  phase: string;
  templateMode: "padrao" | "alternativo";
};

type PdfReadResult = {
  fileName: string;
  pageNumber: number;
  sourceFileIndex: number;
  textForAi: string;
  row: ReviewRow;
  foundFields: {
    sheet: boolean;
    file: boolean;
    description: boolean;
  };
  aiExtraction: "not-used" | "text" | "visual" | "failed";
  extractionProvider?: "openai" | "mimo";
  fallbackReason?: string;
  providerFailureCategories?: ProviderFailureCategory[];
  aiError?: string;
  stampPreviewUrl?: string;
  stampImageUrl?: string;
  extractionAttempt?: string;
  ldData?: Partial<LdData>;
};

type CachedPdfReadResult = Omit<PdfReadResult, "row"> & {
  row: Omit<ReviewRow, "id">;
};

type GeneratedDownload = {
  fileName: string;
  url: string;
  kind: "odt" | "pdf" | "report" | "zip";
};

type LdDraftListItem = {
  id: string;
  title: string;
  projectCode: string;
  workName: string;
  status: "DRAFT" | "GENERATED" | "ARCHIVED";
  activeStep: number;
  ldData: LdData;
  rows: ReviewRow[];
  tomos: Tomo[];
  referenceTotal: number | null;
  manualTotal: string;
  uploadedFileNames: string[];
  uploadedFileCount: number;
  generatedFileNames: string[];
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
  eventCount?: number;
};

type AutosaveState = "idle" | "saving" | "saved" | "error" | "disabled";
type LdFieldKey = Exclude<keyof LdData, "templateMode">;
type LdFieldSource = "ai" | "system" | "manual" | "history" | "empty";
type LdFieldSources = Record<LdFieldKey, LdFieldSource>;

const steps = [
  "Importar PDFs",
  "Dados da LD",
  "Tabela de revisão",
  "Ajuste de tomos",
  "Resumo final",
  "Arquivos gerados",
];

const initialLdData: LdData = {
  projectCode: "",
  formattedCode: "",
  discipline: "",
  revision: "",
  sectionTitle: "",
  client: "",
  workName: "",
  phase: "PROJETO EXECUTIVO",
  templateMode: "padrao",
};

const ldFieldKeys: LdFieldKey[] = [
  "projectCode",
  "formattedCode",
  "discipline",
  "revision",
  "sectionTitle",
  "client",
  "workName",
  "phase",
];

const initialLdFieldSources: LdFieldSources = {
  projectCode: "empty",
  formattedCode: "empty",
  discipline: "empty",
  revision: "empty",
  sectionTitle: "empty",
  client: "empty",
  workName: "empty",
  phase: "system",
};

const initialRows: ReviewRow[] = [
  {
    id: 1,
    sheet: "01/30",
    file: "196_25_est_001_a",
    description: "TORRE RESERVATÓRIO: PLANTA DE LOCAÇÃO E DETALHAMENTO DAS FUNDAÇÕES",
    readDiscipline: "est",
    lowConfidence: false,
    reviewedAlertKeys: [],
  },
  {
    id: 2,
    sheet: "02/30",
    file: "196_25_est_002_a",
    description: "TORRE RESERVATÓRIO: PLANTA DE FORMAS TÉRREO, INTERMEDIÁRIO 01, 02, 03 E BARRILETE 01",
    readDiscipline: "est",
    lowConfidence: false,
    reviewedAlertKeys: [],
  },
  {
    id: 3,
    sheet: "03/34",
    file: "196_25_est_003_a",
    description: "TORRE RESERVATÓRIO: PLANTA DE FORMAS INTERMEDIÁRIO 04, 05, 06, BARRILETE 02 E COBERTURA",
    readDiscipline: "est",
    lowConfidence: false,
    reviewedAlertKeys: [],
  },
  {
    id: 4,
    sheet: "05/30",
    file: "196_25_fnd_005_a",
    description: "TORRE RESERVATÓRIO: DETALHAMENTO DE ARMADURAS DAS FUNDAÇÕES",
    readDiscipline: "fnd",
    lowConfidence: true,
    reviewedAlertKeys: [],
  },
];

const initialTomos: Tomo[] = [
  { id: 1, title: "TOMO 1", start: "01/30", end: "10/30", quantity: 10 },
  { id: 2, title: "TOMO 2", start: "11/30", end: "20/30", quantity: 10 },
  { id: 3, title: "TOMO 3", start: "21/30", end: "30/30", quantity: 10 },
];

const checklist = [
  "Abrir o arquivo .odt no LibreOffice Writer",
  "Conferir se o rodapé está atualizado",
  "Conferir se as propriedades do Writer foram preenchidas corretamente",
  "Conferir se o nome do arquivo está correto",
  "Conferir se o PDF abriu corretamente",
  "Conferir se cada tomo começa em uma nova página",
  "Conferir se nenhuma tabela de tomo quebrou entre páginas",
  "Conferir se a coluna Nº DA FOLHA está correta",
  "Conferir se a coluna ARQUIVOS está correta",
  "Conferir se a coluna DESCRIÇÃO copiou exatamente o campo CONTEÚDO das pranchas",
  "Conferir o relatório .md de inconsistências, se houver",
];

type PdfTextItem = {
  str: string;
  transform: number[];
};

type PdfTextLine = {
  x: number;
  y: number;
  text: string;
};

type VisualStampExtraction = {
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  arquivo: string | null;
  conteudo: string | null;
  cliente: string | null;
  obra: string | null;
  fase: string | null;
  tituloSecao: string | null;
  confianca: "alta" | "media" | "baixa";
  provider?: "openai" | "mimo";
  fallbackReason?: string;
  attempts?: ProviderAttempt[];
};

type ProviderFailureCategory =
  | "quota_billing"
  | "authentication"
  | "timeout"
  | "rate_limit"
  | "invalid_response"
  | "configuration"
  | "model_unavailable"
  | "unknown";

type ProviderAttempt = {
  provider: "openai" | "mimo";
  status: "succeeded" | "failed" | "not_configured";
  category?: ProviderFailureCategory;
  message?: string;
};

class StampExtractionError extends Error {
  attempts: ProviderAttempt[];

  constructor(message: string, attempts: ProviderAttempt[] = []) {
    super(message);
    this.name = "StampExtractionError";
    this.attempts = attempts;
  }
}

type PdfProcessingProgress = {
  current: number;
  total: number;
  fileName: string;
  pageNumber: number;
  status: string;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<unknown>;
};

type StampCropMode = "tight" | "normal" | "expanded" | "full-page";
type ReviewFilterMode = "all" | "blockers" | "warnings" | "low-confidence" | "missing";
type ReviewSortMode = "sheet" | "file" | "discipline" | "status";
type ReviewDensity = "comfortable" | "compact";

const stampCropModes: Array<{ mode: StampCropMode; label: string }> = [
  { mode: "tight", label: "selo compacto" },
  { mode: "normal", label: "recorte do selo" },
  { mode: "expanded", label: "recorte ampliado" },
  { mode: "full-page", label: "pagina inteira" },
];

const maxConcurrentVisualPages = 3;

function waitForUiFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });
}

function normalizeExtractedValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractField(text: string, field: "PRANCHA" | "ARQUIVO" | "CONTEÚDO") {
  const fieldAlternatives = ["PRANCHA", "ARQUIVO", "CONTEÚDO"].filter((name) => name !== field);
  const stopPattern = fieldAlternatives.map(escapeRegex).join("|");
  const pattern = new RegExp(`${field}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\s+(?:${stopPattern})\\s*[:\\-]?|$)`, "i");
  const match = text.match(pattern);

  return match ? normalizeExtractedValue(match[1]) : "";
}

function normalizeSheetValue(value: string, referenceTotal: number | null) {
  const normalized = normalizeExtractedValue(value);
  const completeMatch = normalized.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);

  if (completeMatch) {
    return formatSheet(Number(completeMatch[1]), Number(completeMatch[2]));
  }

  const singleNumberMatch = normalized.match(/\b(\d{1,3})\b/);

  if (singleNumberMatch && referenceTotal) {
    const sheetNumber = Number(singleNumberMatch[1]);

    if (sheetNumber > 0 && sheetNumber <= referenceTotal) {
      return formatSheet(sheetNumber, referenceTotal);
    }
  }

  return "";
}

function extractFileCode(value: string, sourceText: string) {
  const candidates = [value, sourceText];
  const filePatterns = [
    /\b\d{2,4}[_\-.]\d{2}[_\-.][A-Za-z]{2,}(?:[_\-.][A-Za-z0-9]+){2,}\b/i,
    /\b\d{2,4}\s+\d{2}\s+[A-Za-z]{2,}(?:\s+[A-Za-z0-9]+){2,}\b/i,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeExtractedValue(candidate);

    for (const pattern of filePatterns) {
      const match = normalized.match(pattern);

      if (match) {
        return match[0].replace(/\s+/g, "_");
      }
    }
  }

  return "";
}

function cleanDescriptionValue(value: string) {
  const normalized = normalizeExtractedValue(value);

  if (/^(PRANCHA|ARQUIVO)\b/i.test(normalized)) {
    return "";
  }

  return normalized.replace(/\s+(?:PRANCHA|ARQUIVO)\s*[:\-]?[\s\S]*$/i, "").trim();
}

function extractDisciplineFromPrancha(value: string) {
  const match = value.match(/[A-Za-z]{2,}(?:-[A-Za-z]{2,})?/);

  return match ? match[0] : "";
}

function groupTextLines(items: PdfTextLine[]) {
  const sortedItems = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 4) {
      return a.y - b.y;
    }

    return a.x - b.x;
  });
  const lines: PdfTextLine[] = [];

  for (const item of sortedItems) {
    const currentLine = lines[lines.length - 1];

    if (currentLine && Math.abs(currentLine.y - item.y) <= 4) {
      currentLine.text = `${currentLine.text} ${item.text}`;
      currentLine.x = Math.min(currentLine.x, item.x);
      continue;
    }

    lines.push({ ...item });
  }

  return lines.map((line) => normalizeExtractedValue(line.text)).filter(Boolean);
}

function parsePdfTextToRow(
  candidateText: string,
  fullText: string,
  fileName: string,
  pageNumber: number,
  id: number,
  sourceFileIndex: number,
  textForAi: string,
  referenceTotal: number | null,
): PdfReadResult {
  const sourceText = ["PRANCHA", "ARQUIVO", "CONTEÚDO"].every((field) =>
    candidateText.toLocaleUpperCase("pt-BR").includes(field),
  )
    ? candidateText
    : fullText;
  const rawSheet = extractField(sourceText, "PRANCHA");
  const rawFile = extractField(sourceText, "ARQUIVO");
  const rawDescription = extractField(sourceText, "CONTEÚDO");
  const sheet = normalizeSheetValue(rawSheet, referenceTotal);
  const file = extractFileCode(rawFile, sourceText);
  const description = cleanDescriptionValue(rawDescription);
  const foundFields = {
    sheet: Boolean(parseSheet(sheet)),
    file: Boolean(file),
    description: Boolean(description),
  };
  const normalizedRawSheet = normalizeExtractedValue(rawSheet);

  return {
    fileName,
    pageNumber,
    sourceFileIndex,
    textForAi,
    foundFields,
    ldData: extractLdMetadataFromText(fullText),
    row: {
      id,
      sheet,
      file,
      description,
      readDiscipline: extractDisciplineFromPrancha(sheet),
      lowConfidence:
        !foundFields.sheet ||
        !foundFields.file ||
        !foundFields.description ||
        (Boolean(normalizedRawSheet) && normalizedRawSheet !== sheet),
      reviewedAlertKeys: [],
    },
    aiExtraction: "not-used",
  };
}

function buildSheetFromVisualExtraction(extraction: VisualStampExtraction) {
  if (extraction.numeroFolha) {
    const sheet = normalizeSheetValue(extraction.numeroFolha, extraction.total);

    if (sheet) {
      return sheet;
    }
  }

  if (extraction.folha && extraction.total) {
    return formatSheet(extraction.folha, extraction.total);
  }

  return "";
}

function hasMissingStampFields(result: PdfReadResult) {
  return !result.foundFields.sheet || !result.foundFields.file || !result.foundFields.description;
}

function describeExtractionSource(result: PdfReadResult) {
  if (result.aiExtraction === "failed") {
    return "Falha na IA";
  }

  if (result.aiExtraction === "not-used") {
    return "Parser local";
  }

  const method = result.aiExtraction === "visual" ? "visual" : "textual";
  const provider = result.extractionProvider === "mimo" ? "MiMo" : "OpenAI";

  return `IA ${method} (${provider})`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isProviderUnavailable(result: PdfReadResult) {
  return (
    result.aiExtraction === "failed" &&
    result.providerFailureCategories?.some((category) =>
      ["quota_billing", "authentication", "rate_limit", "configuration"].includes(category),
    ) === true
  );
}

function getPdfPageCacheKey(file: File, pageNumber: number) {
  return `${file.name}:${file.size}:${file.lastModified}:page-${pageNumber}`;
}

function toCachedPdfReadResult(result: PdfReadResult): CachedPdfReadResult {
  const { id: _id, ...row } = result.row;

  return {
    ...result,
    row,
  };
}

function fromCachedPdfReadResult(cached: CachedPdfReadResult, id: number): PdfReadResult {
  return {
    ...cached,
    row: {
      ...cached.row,
      id,
      reviewedAlertKeys: [],
    },
  };
}

function titleCaseProjectValue(value: string) {
  return value
    .toLocaleUpperCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLdMetadataFromText(text: string): Partial<LdData> {
  const normalized = normalizeExtractedValue(text).replace(/[–—]/g, "-");
  const fallbackMatch = normalized.match(
    /(PREFEITURA\s+MUNICIPAL\s+DE\s+CRICI[ÚU]MA)\W+(\d{2,4}[_-]\d{2})\W+(.+?)\W+(PROJETO\s+[A-ZÀ-Ú\s]+?)\W+LISTA\s+DE\s+DOCUMENTOS/i,
  );
  const looseHeaderMatch = normalized.match(
    /(PREFEITURA\s+MUNICIPAL\s+DE\s+CRICI[ÚU]MA)[\s\S]{0,80}?(\d{2,4}[_-]\d{2})[\s\S]{0,160}?(CENTRO\s+COMUNIT[ÁA]RIO\s+PRIMEIRA\s+LINHA)[\s\S]{0,120}?(PROJETO\s+EXECUTIVO)/i,
  );
  const headerParts = normalized
    .split(/\s*-{2,}\s*/)
    .map((part) => titleCaseProjectValue(part))
    .filter(Boolean);
  const client = headerParts.find((part) => /^PREFEITURA\s+MUNICIPAL\s+DE\s+/i.test(part));
  const clientIndex = client ? headerParts.indexOf(client) : -1;
  const projectCode = clientIndex >= 0 ? headerParts[clientIndex + 1] : "";
  const workName = clientIndex >= 0 ? headerParts[clientIndex + 2] : "";
  const phase = clientIndex >= 0 ? headerParts[clientIndex + 3] : "";
  const metadata: Partial<LdData> = {};

  if (fallbackMatch) {
    return {
      client: titleCaseProjectValue(fallbackMatch[1]),
      projectCode: fallbackMatch[2].replace("-", "_"),
      formattedCode: fallbackMatch[2].replace("_", "-"),
      workName: titleCaseProjectValue(fallbackMatch[3]),
    phase: titleCaseProjectValue(fallbackMatch[4]),
    };
  }

  if (looseHeaderMatch) {
    return {
      client: titleCaseProjectValue(looseHeaderMatch[1]),
      projectCode: looseHeaderMatch[2].replace("-", "_"),
      formattedCode: looseHeaderMatch[2].replace("_", "-"),
      workName: titleCaseProjectValue(looseHeaderMatch[3]),
      phase: titleCaseProjectValue(looseHeaderMatch[4]),
    };
  }

  if (client) {
    metadata.client = client;
  }

  if (projectCode && /^\d{2,4}[_-]\d{2}$/.test(projectCode)) {
    metadata.projectCode = projectCode.replace("-", "_");
    metadata.formattedCode = projectCode.replace("_", "-");
  }

  if (workName && !/LISTA\s+DE\s+DOCUMENTOS/i.test(workName)) {
    metadata.workName = workName;
  }

  if (phase && !/LISTA\s+DE\s+DOCUMENTOS/i.test(phase)) {
    metadata.phase = phase;
  }

  return metadata;
}

function deriveLdDataFromRow(row: ReviewRow): Partial<LdData> {
  const fileMatch = row.file.match(/^(\d{2,4})[_\-.](\d{2})[_\-.]([A-Za-z]{2,})(?:[_\-.].*?)[_\-.]([A-Za-z0-9]+)$/);
  const projectCode = fileMatch ? `${fileMatch[1]}_${fileMatch[2]}` : "";
  const discipline = fileMatch?.[3] ?? row.readDiscipline;
  const revision = fileMatch?.[4] ?? "";
  const sectionTitle = row.description.includes(":")
    ? row.description.split(":")[0].trim()
    : "";

  return {
    ...(projectCode ? { projectCode, formattedCode: projectCode.replace("_", "-") } : {}),
    ...(discipline ? { discipline: discipline.toLocaleLowerCase("pt-BR") } : {}),
    ...(revision ? { revision: revision.toLocaleLowerCase("pt-BR") } : {}),
    ...(sectionTitle ? { sectionTitle } : {}),
  };
}

function buildLdDataSuggestion(data: LdData): Partial<LdData> {
  const discipline = data.discipline.trim().toLocaleLowerCase("pt-BR");
  const formattedCode = data.formattedCode.trim();
  const suggestion: Partial<LdData> = {};

  if (!data.client.trim() && formattedCode === "017-26") {
    suggestion.client = "PREFEITURA MUNICIPAL DE CRICIÚMA";
  }

  if (!data.phase.trim()) {
    suggestion.phase = "PROJETO EXECUTIVO";
  }

  if (!data.sectionTitle.trim()) {
    if (discipline === "est") {
      suggestion.sectionTitle = "PROJETO ESTRUTURAL CONCRETO";
    } else if (discipline) {
      suggestion.sectionTitle = `PROJETO ${discipline.toLocaleUpperCase("pt-BR")}`;
    }
  }

  return suggestion;
}

function getFilledLdFieldSources(data: LdData, source: LdFieldSource) {
  return ldFieldKeys.reduce((sources, key) => {
    sources[key] = data[key].trim() ? source : "empty";
    return sources;
  }, {} as LdFieldSources);
}

function markLdFieldSources(
  current: LdFieldSources,
  fields: Partial<LdData>,
  source: LdFieldSource,
) {
  return ldFieldKeys.reduce((next, key) => {
    if (typeof fields[key] === "string" && fields[key]?.trim()) {
      next[key] = source;
    }

    return next;
  }, { ...current });
}

async function renderStampCropToDataUrl(pageProxy: unknown, mode: StampCropMode) {
  const page = pageProxy as {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  };
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível criar o canvas para renderizar o selo.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: context, canvas, viewport }).promise;

  const cropBounds =
    mode === "tight"
      ? { x: 0.62, y: 0.62 }
      : mode === "normal"
      ? { x: 0.55, y: 0.55 }
      : mode === "expanded"
        ? { x: 0.4, y: 0.4 }
        : { x: 0, y: 0 };
  const cropX = Math.floor(canvas.width * cropBounds.x);
  const cropY = Math.floor(canvas.height * cropBounds.y);
  const cropWidth = canvas.width - cropX;
  const cropHeight = canvas.height - cropY;
  const cropCanvas = document.createElement("canvas");
  const cropContext = cropCanvas.getContext("2d");

  if (!cropContext) {
    throw new Error("Não foi possível criar o recorte do selo.");
  }

  const maxImageEdge = 2400;
  const cropScale = Math.min(1, maxImageEdge / cropWidth, maxImageEdge / cropHeight);

  cropCanvas.width = Math.ceil(cropWidth * cropScale);
  cropCanvas.height = Math.ceil(cropHeight * cropScale);
  cropContext.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );

  const previewCanvas = document.createElement("canvas");
  const previewContext = previewCanvas.getContext("2d");

  if (!previewContext) {
    throw new Error("Não foi possível criar a prévia do selo.");
  }

  const previewWidth = Math.min(320, cropCanvas.width);
  const previewScale = previewWidth / cropCanvas.width;
  previewCanvas.width = previewWidth;
  previewCanvas.height = Math.ceil(cropCanvas.height * previewScale);
  previewContext.drawImage(cropCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

  return {
    imageDataUrl: cropCanvas.toDataURL("image/jpeg", 0.92),
    previewDataUrl: previewCanvas.toDataURL("image/jpeg", 0.76),
  };
}

async function requestVisualStampExtraction(imageDataUrl: string, pdfText: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
  const response = await fetch("/api/ld/extract-stamp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl, pdfText }),
    signal: controller.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; attempts?: ProviderAttempt[] }
      | null;
    throw new StampExtractionError(
      payload?.error ?? "Leitura visual por IA indisponível.",
      payload?.attempts,
    );
  }

  return (await response.json()) as VisualStampExtraction;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tempo limite de 30s atingido na leitura visual por IA.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestTextStampExtraction(pdfText: string) {
  const response = await fetch("/api/ld/extract-stamp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pdfText }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; attempts?: ProviderAttempt[] }
      | null;
    throw new StampExtractionError(
      payload?.error ?? "Leitura textual por IA indisponível.",
      payload?.attempts,
    );
  }

  return (await response.json()) as VisualStampExtraction;
}

function mergeAiExtraction(
  result: PdfReadResult,
  extraction: VisualStampExtraction,
  source: "text" | "visual",
): PdfReadResult {
  const sheet = buildSheetFromVisualExtraction(extraction) || result.row.sheet;
  const visualFile = normalizeExtractedValue(extraction.arquivo ?? "");
  const visualDescription = cleanDescriptionValue(extraction.conteudo ?? "");
  const file = extractFileCode(visualFile, visualFile) || result.row.file;
  const description = visualDescription || result.row.description;
  const readDiscipline =
    normalizeExtractedValue(extraction.disciplina ?? "") ||
    extractDisciplineFromPrancha(sheet) ||
    result.row.readDiscipline;
  const foundFields = {
    sheet: Boolean(parseSheet(sheet)),
    file: Boolean(file),
    description: Boolean(description),
  };
  const extractedLdData: Partial<LdData> = {
    ...result.ldData,
  };
  const client = normalizeExtractedValue(extraction.cliente ?? "");
  const workName = normalizeExtractedValue(extraction.obra ?? "");
  const phase = normalizeExtractedValue(extraction.fase ?? "");
  const sectionTitle = normalizeExtractedValue(extraction.tituloSecao ?? "");

  if (client) {
    extractedLdData.client = client;
  }

  if (workName) {
    extractedLdData.workName = workName;
  }

  if (phase) {
    extractedLdData.phase = phase;
  }

  if (sectionTitle) {
    extractedLdData.sectionTitle = sectionTitle;
  }

  return {
    ...result,
    foundFields,
    ldData: extractedLdData,
    aiExtraction: source,
    extractionProvider: extraction.provider,
    fallbackReason: extraction.fallbackReason,
    row: {
      ...result.row,
      sheet,
      file,
      description,
      readDiscipline,
      lowConfidence:
        extraction.confianca !== "alta" ||
        !foundFields.sheet ||
        !foundFields.file ||
        !foundFields.description,
    },
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o template alternativo."));
    reader.readAsDataURL(file);
  });
}

function base64ToObjectUrl(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asReviewRows(value: unknown) {
  return Array.isArray(value) ? (value as ReviewRow[]) : [];
}

function asTomos(value: unknown) {
  return Array.isArray(value) ? (value as Tomo[]) : [];
}

function getAutosaveLabel(state: AutosaveState) {
  if (state === "saving") {
    return "Salvando rascunho...";
  }

  if (state === "saved") {
    return "Rascunho salvo";
  }

  if (state === "error") {
    return "Falha ao salvar rascunho";
  }

  if (state === "disabled") {
    return "Histórico indisponível";
  }

  return "Autosave pronto";
}

export function LdWorkspace({
  initialDraftId,
  isAdmin = false,
}: {
  initialDraftId?: string;
  isAdmin?: boolean;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [ldData, setLdData] = useState<LdData>(initialLdData);
  const [ldFieldSources, setLdFieldSources] = useState<LdFieldSources>(initialLdFieldSources);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [tomos, setTomos] = useState<Tomo[]>([]);
  const [referenceTotal, setReferenceTotal] = useState<number | null>(null);
  const [manualTotal, setManualTotal] = useState("");
  const [reviewedGlobalWarnings, setReviewedGlobalWarnings] = useState<string[]>([]);
  const [pdfReadResults, setPdfReadResults] = useState<PdfReadResult[]>([]);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfReadError, setPdfReadError] = useState("");
  const [pdfProgress, setPdfProgress] = useState<PdfProcessingProgress | null>(null);
  const [uploadedPdfFiles, setUploadedPdfFiles] = useState<File[]>([]);
  const [reprocessingRowId, setReprocessingRowId] = useState<number | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [generatedDownloads, setGeneratedDownloads] = useState<GeneratedDownload[]>([]);
  const [packageGenerating, setPackageGenerating] = useState(false);
  const [packageError, setPackageError] = useState("");
  const [preAnalysisResult, setPreAnalysisResult] = useState<PdfReadResult | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<LdDraftListItem[]>([]);
  const [draftsError, setDraftsError] = useState("");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const [loadedDraftNotice, setLoadedDraftNotice] = useState("");
  const [finalChecklist, setFinalChecklist] = useState<string[]>([]);
  const pdfReadCache = useRef(new Map<string, CachedPdfReadResult>());
  const autosaveHydrated = useRef(false);
  const initialDraftLoaded = useRef(false);

  const baseName = `${ldData.projectCode}_${ldData.discipline}_ld_${ldData.revision}`;
  const validation = useMemo(
    () => validateRows(rows, ldData.discipline, referenceTotal),
    [ldData.discipline, referenceTotal, rows],
  );
  const tomoSheetTotal = referenceTotal ?? Math.max(
    ...rows.map((row) => parseSheet(row.sheet)?.total ?? 0),
    rows.length,
    1,
  );
  const tomoAllocatedTotal = tomos.reduce((sum, tomo) => sum + tomo.quantity, 0);
  const canAdvancePastTomos =
    tomos.length > 0 &&
    tomoAllocatedTotal === tomoSheetTotal &&
    tomos.every((tomo) => tomo.quantity > 0);
  const rowWarningIssues = rows.flatMap((row) =>
    (validation.rowIssues[row.id] ?? []).filter((issue) => issue.severity === "warning"),
  );
  const warningCount = rowWarningIssues.length + validation.globalWarnings.length;
  const reviewedRowWarnings = rows.reduce((total, row) => {
    const issues = (validation.rowIssues[row.id] ?? []).filter((issue) => issue.severity === "warning");
    return total + issues.filter((issue) => row.reviewedAlertKeys.includes(issue.key)).length;
  }, 0);
  const reviewedGlobalWarningCount = validation.globalWarnings.filter((warning) =>
    reviewedGlobalWarnings.includes(warning.key),
  ).length;
  const reviewedWarnings = reviewedRowWarnings + reviewedGlobalWarningCount;
  const hasBlockingIssues = validation.blockingIssues.length > 0;
  const hasUnreviewedWarnings = reviewedWarnings < warningCount;
  const hasReferenceTotal = validation.totals.length <= 1 || referenceTotal !== null;
  const canAdvancePastReview = !hasBlockingIssues && !hasUnreviewedWarnings && hasReferenceTotal;
  const fullAnalysisComplete = rows.length > 0 && !pdfProcessing;
  const hasRequiredLdData = [
    ldData.projectCode,
    ldData.formattedCode,
    ldData.discipline,
    ldData.revision,
    ldData.sectionTitle,
    ldData.client,
    ldData.workName,
    ldData.phase,
  ].every((value) => value.trim().length > 0);
  const missingRequiredLdFields = ldFieldKeys.filter((key) => ldData[key].trim().length === 0);

  const generatedFiles = useMemo(
    () => [
      `${baseName}.odt`,
      `${baseName}.pdf`,
      `${baseName}_inconsistencias.md`,
      `${baseName}.zip`,
    ],
    [baseName],
  );
  const coverGeneratorHref = useMemo(() => {
    const params = encodeLdData({
      codigoInterno: ldData.projectCode,
      codigoExibido: ldData.formattedCode,
      revisao: ldData.revision,
      nomeObra: ldData.workName,
      fase: ldData.phase,
      orgao: ldData.client,
      tituloLd: ldData.sectionTitle,
      tomos: tomos.map((_, index) => String(index + 1).padStart(2, "0")),
      volume: "I",
    });

    return `/capas?${params.toString()}`;
  }, [ldData, tomos]);
  const finalChecklistItems = useMemo(
    () => [
      "Conferi órgão/cliente, nome da obra, fase e título da seção.",
      "Conferi folhas duplicadas, faltantes e alertas de baixa confiança.",
      "Conferi a divisão de tomos e intervalos de pranchas.",
      "Estou ciente de que os PDFs originais devem ser reenviados para reprocessamento futuro.",
    ],
    [],
  );
  const finalChecklistComplete = finalChecklistItems.every((item) => finalChecklist.includes(item));
  const uploadedFileCount = uploadedPdfFiles.length;
  const generatedFileNames = useMemo(
    () => generatedDownloads.map((download) => download.fileName),
    [generatedDownloads],
  );
  const autosaveDisabled = autosaveState === "disabled";
  const hasDraftContent =
    uploadedFileCount > 0 ||
    rows.length > 0 ||
    ldData.projectCode.trim().length > 0 ||
    ldData.workName.trim().length > 0;

  useEffect(() => {
    let ignore = false;

    async function loadDrafts() {
      try {
        const response = await fetch("/api/ld/drafts", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { drafts?: LdDraftListItem[]; disabledReason?: string; error?: string }
          | null;

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setDraftsError(payload?.error ?? "Não foi possível carregar o histórico de LDs.");
          setAutosaveState("error");
          return;
        }

        setDrafts(payload?.drafts ?? []);

        if (payload?.disabledReason) {
          setDraftsError(payload.disabledReason);
          setAutosaveState("disabled");
        }
      } catch {
        if (!ignore) {
          setDraftsError("Não foi possível carregar o histórico de LDs.");
          setAutosaveState("error");
        }
      } finally {
        autosaveHydrated.current = true;
      }
    }

    void loadDrafts();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!initialDraftId || initialDraftLoaded.current) {
      return;
    }

    initialDraftLoaded.current = true;

    async function openInitialDraft() {
      try {
        const response = await fetch(`/api/ld/drafts/${initialDraftId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { draft?: LdDraftListItem; error?: string }
          | null;

        if (!response.ok || !payload?.draft) {
          throw new Error(payload?.error ?? "Não foi possível abrir a LD selecionada.");
        }

        loadDraft(payload.draft, false);
        await fetch(`/api/ld/drafts/${initialDraftId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REOPENED" }),
        });
      } catch (error) {
        setDraftsError(error instanceof Error ? error.message : "Não foi possível abrir a LD selecionada.");
      }
    }

    void openInitialDraft();
  }, [initialDraftId]);

  useEffect(() => {
    if (!autosaveHydrated.current || !hasDraftContent || autosaveDisabled) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      setAutosaveState("saving");
      setAutosaveMessage("");

      try {
        const response = await fetch("/api/ld/drafts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: draftId,
            activeStep,
            ldData,
            rows,
            tomos,
            referenceTotal,
            manualTotal,
            uploadedFileNames: [],
            uploadedFileCount,
            generatedFileNames,
            status: generatedFileNames.length > 0 ? "GENERATED" : "DRAFT",
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { draft?: LdDraftListItem; error?: string }
          | null;

        if (!response.ok || !payload?.draft) {
          throw new Error(payload?.error ?? "Não foi possível salvar o rascunho.");
        }

        setDraftId(payload.draft.id);
        setDrafts((current) => [
          payload.draft!,
          ...current.filter((draft) => draft.id !== payload.draft!.id),
        ]);
        setAutosaveState("saved");
        setAutosaveMessage(`Salvo às ${new Date(payload.draft.updatedAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`);
      } catch (error) {
        setAutosaveState("error");
        setAutosaveMessage(error instanceof Error ? error.message : "Não foi possível salvar o rascunho.");
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [
    activeStep,
    autosaveDisabled,
    draftId,
    generatedFileNames,
    hasDraftContent,
    ldData,
    manualTotal,
    referenceTotal,
    rows,
    tomos,
    uploadedFileCount,
  ]);

  function loadDraft(draft: LdDraftListItem, registerReopen = true) {
    const nextLdData = { ...initialLdData, ...draft.ldData };

    setDraftId(draft.id);
    setLdData(nextLdData);
    setLdFieldSources(getFilledLdFieldSources(nextLdData, "history"));
    setRows(asReviewRows(draft.rows));
    setTomos(asTomos(draft.tomos));
    setReferenceTotal(draft.referenceTotal);
    setManualTotal(draft.manualTotal ?? "");
    setActiveStep(Math.min(Math.max(draft.activeStep, 1), steps.length - 1));
    setReviewedGlobalWarnings([]);
    setPdfReadResults([]);
    setUploadedPdfFiles([]);
    setGeneratedDownloads([]);
    setFinalChecklist([]);
    setPackageError("");
    setPdfReadError("");
    setPreAnalysisResult(null);
    setLoadedDraftNotice(
      `Rascunho "${draft.title}" reaberto. Os PDFs originais não ficam anexados ao histórico; reenvie-os se precisar reprocessar selos.`,
    );
    setAutosaveState("saved");
    setAutosaveMessage(`Reaberto de ${new Date(draft.updatedAt).toLocaleString("pt-BR")}`);

    if (registerReopen) {
      void fetch(`/api/ld/drafts/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REOPENED" }),
      });
    }
  }

  function startNewDraft() {
    setDraftId(null);
    setActiveStep(0);
    setLdData(initialLdData);
    setLdFieldSources(initialLdFieldSources);
    setRows([]);
    setTomos([]);
    setReferenceTotal(null);
    setManualTotal("");
    setReviewedGlobalWarnings([]);
    setPdfReadResults([]);
    setUploadedPdfFiles([]);
    setGeneratedDownloads([]);
    setFinalChecklist([]);
    setPackageError("");
    setPdfReadError("");
    setPreAnalysisResult(null);
    setLoadedDraftNotice("");
    setAutosaveState("idle");
    pdfReadCache.current.clear();
  }

  async function archiveDraft(id: string) {
    try {
      const response = await fetch(`/api/ld/drafts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Não foi possível arquivar o rascunho.");
      }

      setDrafts((current) => current.filter((draft) => draft.id !== id));

      if (draftId === id) {
        startNewDraft();
      }
    } catch (error) {
      setDraftsError(error instanceof Error ? error.message : "Não foi possível arquivar o rascunho.");
    }
  }

  function updateLdData(key: keyof LdData, value: string) {
    setLdData((current) => ({ ...current, [key]: value }));
    if (key !== "templateMode") {
      setLdFieldSources((current) => ({
        ...current,
        [key]: value.trim() ? "manual" : "empty",
      }));
    }
  }

  function updateTemplateFile(file: File | null) {
    setTemplateFile(file);
  }

  function applyLdDataSuggestions() {
    setLdData((currentData) => {
      const suggestion = buildLdDataSuggestion(currentData);

      setLdFieldSources((currentSources) => markLdFieldSources(currentSources, suggestion, "system"));

      return { ...currentData, ...suggestion };
    });
  }

  function updateRow(id: number, key: keyof ReviewRow, value: string | boolean) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [key]: value,
              reviewedAlertKeys:
                key === "sheet" || key === "file" || key === "description" || key === "readDiscipline"
                  ? []
                  : row.reviewedAlertKeys,
            }
          : row,
      ),
    );
  }

  function addRow() {
    const nextId = Math.max(...rows.map((row) => row.id), 0) + 1;
    setRows((current) => [
      ...current,
      {
        id: nextId,
        sheet: "",
        file: "",
        description: "",
        readDiscipline: ldData.discipline,
        lowConfidence: true,
        reviewedAlertKeys: [],
      },
    ]);
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function extractWithProgressiveVision(
    page: unknown,
    textResult: PdfReadResult,
    onAttempt?: (status: string) => void,
  ) {
    let lastResult = textResult;
    let lastError = "";

    for (const attempt of stampCropModes) {
      onAttempt?.(`IA visual: ${attempt.label}`);
      let previewDataUrl: string | undefined;
      let imageDataUrl: string | undefined;

      try {
        const crop = await renderStampCropToDataUrl(page, attempt.mode);
        previewDataUrl = crop.previewDataUrl;
        imageDataUrl = crop.imageDataUrl;
        const extraction = await requestVisualStampExtraction(crop.imageDataUrl, textResult.textForAi);
        const merged = {
          ...mergeAiExtraction(textResult, extraction, "visual"),
          stampPreviewUrl: crop.previewDataUrl,
          stampImageUrl: crop.imageDataUrl,
          extractionAttempt: attempt.label,
        };

        lastResult = merged;

        if (!hasMissingStampFields(merged)) {
          return merged;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Leitura visual por IA falhou.";
        lastResult = {
          ...lastResult,
          stampPreviewUrl: previewDataUrl ?? lastResult.stampPreviewUrl,
          stampImageUrl: imageDataUrl ?? lastResult.stampImageUrl,
          extractionAttempt: attempt.label,
          providerFailureCategories:
            error instanceof StampExtractionError
              ? error.attempts
                  .map((attempt) => attempt.category)
                  .filter((category): category is ProviderFailureCategory => Boolean(category))
              : lastResult.providerFailureCategories,
        };

        if (
          lastResult.providerFailureCategories?.some((category) =>
            ["quota_billing", "authentication", "rate_limit", "configuration"].includes(category),
          ) ||
          /tempo limite/i.test(lastError)
        ) {
          break;
        }
      }
    }

    return {
      ...lastResult,
      aiExtraction: "failed" as const,
      aiError: lastError || "A IA não localizou todos os campos obrigatórios.",
      row: {
        ...lastResult.row,
        lowConfidence: true,
      },
    };
  }

  async function analyzePdfPage({
    file,
    fileIndex,
    page,
    pageNumber,
    id,
    current,
    total,
  }: {
    file: File;
    fileIndex: number;
    page: unknown;
    pageNumber: number;
    id: number;
    current: number;
    total: number;
  }) {
    const cacheKey = getPdfPageCacheKey(file, pageNumber);
    const cached = pdfReadCache.current.get(cacheKey);

    if (cached?.aiExtraction === "failed") {
      pdfReadCache.current.delete(cacheKey);
    } else if (cached) {
      setPdfProgress({
        current,
        total,
        fileName: file.name,
        pageNumber,
        status: "Resultado recuperado do cache",
      });

      return fromCachedPdfReadResult(cached, id);
    }

    setPdfProgress({
      current,
      total,
      fileName: file.name,
      pageNumber,
      status: "Preparando selo para IA visual",
    });

    const typedPage = page as {
      getViewport: (options: { scale: number }) => {
        width: number;
        height: number;
        convertToViewportPoint: (x: number, y: number) => [number, number];
      };
      getTextContent: () => Promise<{ items: unknown[] }>;
    };
    const viewport = typedPage.getViewport({ scale: 1 });
    const textContent = await typedPage.getTextContent();
    const textItems = textContent.items.filter(
      (item): item is PdfTextItem =>
        typeof item === "object" &&
        item !== null &&
        "str" in item &&
        "transform" in item,
    );
    const positionedItems = textItems.map((item) => {
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);

      return {
        x,
        y,
        text: item.str,
      };
    });
    const stampItems = positionedItems.filter(
      (item) => item.x >= viewport.width * 0.55 && item.y >= viewport.height * 0.55,
    );
    const expandedStampItems = positionedItems.filter(
      (item) => item.x >= viewport.width * 0.45 && item.y >= viewport.height * 0.45,
    );
    const fullText = groupTextLines(positionedItems).join(" ");
    const stampText = groupTextLines(stampItems).join(" ");
    const expandedStampText = groupTextLines(expandedStampItems).join(" ");
    const candidateText = stampText || expandedStampText || fullText;
    const textForAi = [
      stampText ? `REGIAO DO SELO:\n${stampText}` : "",
      expandedStampText && expandedStampText !== stampText
        ? `REGIAO AMPLIADA:\n${expandedStampText}`
        : "",
      fullText ? `PAGINA COMPLETA:\n${fullText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 24000);
    const textResult = parsePdfTextToRow(
      candidateText,
      fullText,
      file.name,
      pageNumber,
      id,
      fileIndex,
      textForAi,
      referenceTotal,
    );
    let pageResult = await extractWithProgressiveVision(page, textResult, (status) => {
      setPdfProgress({ current, total, fileName: file.name, pageNumber, status });
    });

    if (hasMissingStampFields(pageResult)) {
      pageResult = {
        ...pageResult,
        row: {
          ...pageResult.row,
          lowConfidence: true,
        },
      };
    }

    if (pageResult.aiExtraction !== "failed") {
      pdfReadCache.current.set(cacheKey, toCachedPdfReadResult(pageResult));
    }

    return pageResult;
  }

  async function preAnalyzePdfFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

    if (files.length === 0) {
      setPdfReadError("Selecione ao menos um arquivo PDF.");
      return;
    }

    setPdfProcessing(true);
    setPdfReadError("");
    setPdfReadResults([]);
    setRows([]);
    setReviewedGlobalWarnings([]);
    setUploadedPdfFiles(files);
    setPreAnalysisResult(null);
    setPdfProgress(null);
    setReferenceTotal(null);
    setManualTotal("");

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();

      const firstFile = files[0];
      const documents = [];
      const totalPages = 1;

      setPdfProgress({
        current: 0,
        total: 1,
        fileName: firstFile.name,
        pageNumber: 0,
        status: "Abrindo PDF",
      });
      const data = await firstFile.arrayBuffer();
      const documentTask = pdfjs.getDocument({ data });
      const pdf = await documentTask.promise as PdfJsDocument;
      const page = await pdf.getPage(1);
      const pageResult = await analyzePdfPage({
        file: firstFile,
        fileIndex: 0,
        page,
        pageNumber: 1,
        id: 1,
        current: 1,
        total: 1,
      });
      const parsedSheet = parseSheet(pageResult.row.sheet);

      setPreAnalysisResult(pageResult);
      await waitForUiFrame();

      if (isProviderUnavailable(pageResult)) {
        setPdfReadError(
          pageResult.aiError ??
            "A API de IA recusou a leitura do selo. A análise não foi iniciada.",
        );
        return;
      }

      const automaticLdData = {
        ...deriveLdDataFromRow(pageResult.row),
        ...pageResult.ldData,
      };

      setLdData((currentData) => ({
        ...currentData,
        ...automaticLdData,
      }));
      setLdFieldSources((currentSources) => markLdFieldSources(currentSources, automaticLdData, "ai"));

      if (parsedSheet) {
        changeReferenceTotal(parsedSheet.total);
      }

      setActiveStep(1);
      return;

      documents.push({ file: firstFile, fileIndex: 0, pdf });

      const nextResults: PdfReadResult[] = [];
      let nextId = 1;

      for (const { file, fileIndex, pdf } of documents) {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const current = nextResults.length + 1;
          setPdfProgress({
            current,
            total: totalPages,
            fileName: file.name,
            pageNumber,
            status: "Extraindo texto da página",
          });
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          const textContent = await page.getTextContent();
          const textItems: PdfTextItem[] = textContent.items.filter(
            (item: unknown): item is PdfTextItem =>
              typeof item === "object" &&
              item !== null &&
              "str" in item &&
              "transform" in item,
          );
          const positionedItems = textItems.map((item) => {
            const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);

            return {
              x,
              y,
              text: item.str,
            };
          });
          const stampItems = positionedItems.filter(
            (item) => item.x >= viewport.width * 0.55 && item.y >= viewport.height * 0.55,
          );
          const expandedStampItems = positionedItems.filter(
            (item) => item.x >= viewport.width * 0.45 && item.y >= viewport.height * 0.45,
          );
          const fullText = groupTextLines(positionedItems).join(" ");
          const stampText = groupTextLines(stampItems).join(" ");
          const expandedStampText = groupTextLines(expandedStampItems).join(" ");
          const candidateText = stampText || expandedStampText || fullText;
          const textForAi = [
            stampText ? `REGIAO DO SELO:\n${stampText}` : "",
            expandedStampText && expandedStampText !== stampText
              ? `REGIAO AMPLIADA:\n${expandedStampText}`
              : "",
            fullText ? `PAGINA COMPLETA:\n${fullText}` : "",
          ]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 60000);

          const textResult = parsePdfTextToRow(
            candidateText,
            fullText,
            file.name,
            pageNumber,
            nextId,
            fileIndex,
            textForAi,
            referenceTotal,
          );
          let pageResult = textResult;
          let textAiError = "";
          const shouldUseTextAi = hasMissingStampFields(textResult) || textResult.row.lowConfidence;

          try {
            if (textForAi && shouldUseTextAi) {
              setPdfProgress({
                current,
                total: totalPages,
                fileName: file.name,
                pageNumber,
                status: "Interpretando texto com IA",
              });
              const textExtraction = await requestTextStampExtraction(textForAi);
              pageResult = mergeAiExtraction(textResult, textExtraction, "text");
            }
          } catch (textError) {
            textAiError = getErrorMessage(textError, "Leitura textual por IA falhou.");
          }

          if (hasMissingStampFields(pageResult) || pageResult.row.lowConfidence) {
            pageResult = await extractWithProgressiveVision(page, textResult, (status) => {
              setPdfProgress({ current, total: totalPages, fileName: file.name, pageNumber, status });
            });

            if (textAiError && pageResult.aiExtraction === "failed") {
              pageResult = {
                ...pageResult,
                aiError: `${textAiError} ${pageResult.aiError ?? ""}`.trim(),
              };
            }
          } else if (textAiError) {
            pageResult = {
              ...textResult,
              aiExtraction: "failed",
              aiError: textAiError,
            };
          }

          if (hasMissingStampFields(pageResult)) {
            pageResult = {
              ...pageResult,
              row: {
                ...pageResult.row,
                lowConfidence: true,
              },
            };
          }

          nextResults.push(pageResult);
          setPreAnalysisResult(pageResult);
          const automaticLdData = {
            ...deriveLdDataFromRow(pageResult.row),
            ...pageResult.ldData,
          };

          setLdData((currentData) => ({
            ...currentData,
            ...automaticLdData,
          }));
          setLdFieldSources((currentSources) => markLdFieldSources(currentSources, automaticLdData, "ai"));

          const parsedSheetTotal = parseSheet(pageResult.row.sheet)?.total;

          if (typeof parsedSheetTotal === "number") {
            changeReferenceTotal(Number(parsedSheetTotal));
          }

          setActiveStep(1);
          return;
        }
      }

      setPdfReadResults(nextResults);
      setRows(nextResults.map((result) => result.row).sort(compareBySheet));
      setReviewedGlobalWarnings([]);

      const totals = new Set(
        nextResults
          .map((result) => parseSheet(result.row.sheet)?.total)
          .filter((total): total is number => typeof total === "number"),
      );

      if (totals.size === 1) {
        const [total] = [...totals];
        changeReferenceTotal(total);
      }
    } catch (error) {
      setPdfReadError(error instanceof Error ? error.message : "Não foi possível ler o PDF selecionado.");
    } finally {
      setPdfProcessing(false);
      setPdfProgress(null);
    }
  }

  async function processPdfFiles(fileList: FileList | File[] = uploadedPdfFiles) {
    const files = Array.from(fileList).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

    if (files.length === 0) {
      setPdfReadError("Selecione ao menos um arquivo PDF.");
      return;
    }

    setPdfProcessing(true);
    setPdfReadError("");
    setPdfReadResults([]);
    setRows([]);
    setReviewedGlobalWarnings([]);
    setUploadedPdfFiles(files);
    setPdfProgress(null);

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();

      const documents: Array<{ file: File; fileIndex: number; pdf: PdfJsDocument }> = [];
      let totalPages = 0;

      for (const [fileIndex, file] of files.entries()) {
        setPdfProgress({
          current: 0,
          total: 0,
          fileName: file.name,
          pageNumber: 0,
          status: "Abrindo PDF",
        });
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise as PdfJsDocument;

        documents.push({ file, fileIndex, pdf });
        totalPages += pdf.numPages;
        await waitForUiFrame();
      }

      const nextResults: PdfReadResult[] = [];
      const pageJobs: Array<{
        file: File;
        fileIndex: number;
        pdf: PdfJsDocument;
        pageNumber: number;
        id: number;
      }> = [];

      for (const { file, fileIndex, pdf } of documents) {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          pageJobs.push({
            file,
            fileIndex,
            pdf,
            pageNumber,
            id: pageJobs.length + 1,
          });
        }
      }

      for (let index = 0; index < pageJobs.length; index += maxConcurrentVisualPages) {
        const batch = pageJobs.slice(index, index + maxConcurrentVisualPages);
        const batchResults = await Promise.all(
          batch.map(async (job, batchIndex) => {
            const page = await job.pdf.getPage(job.pageNumber);

            return analyzePdfPage({
              file: job.file,
              fileIndex: job.fileIndex,
              page,
              pageNumber: job.pageNumber,
              id: job.id,
              current: index + batchIndex + 1,
              total: totalPages,
            });
          }),
        );

        if (batchResults.every(isProviderUnavailable)) {
          setPdfReadResults([...nextResults, ...batchResults]);
          setPdfReadError(
            `Análise interrompida sem gerar linhas vazias: ${
              batchResults[0].aiError ?? "a API de IA recusou este lote."
            }`,
          );
          return;
        }

        nextResults.push(...batchResults);
        setPdfReadResults([...nextResults]);
        setRows(nextResults.map((result) => result.row).sort(compareBySheet));
        await waitForUiFrame();
      }

      setPdfReadResults(nextResults);
      setRows(nextResults.map((result) => result.row).sort(compareBySheet));
      setReviewedGlobalWarnings([]);

      const totals = new Set(
        nextResults
          .map((result) => parseSheet(result.row.sheet)?.total)
          .filter((total): total is number => typeof total === "number"),
      );

      if (totals.size === 1) {
        const [total] = [...totals];
        changeReferenceTotal(total);
      }

      setActiveStep(2);
    } catch (error) {
      setPdfReadError(error instanceof Error ? error.message : "Não foi possível ler o PDF selecionado.");
    } finally {
      setPdfProcessing(false);
      setPdfProgress(null);
    }
  }

  async function reprocessRow(id: number) {
    const result = pdfReadResults.find((item) => item.row.id === id);
    const file = result ? uploadedPdfFiles[result.sourceFileIndex] : null;

    if (!result || !file) {
      setPdfReadError("A página original desta linha não está disponível para reanálise.");
      return;
    }

    setReprocessingRowId(id);
    setPdfReadError("");

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await pdf.getPage(result.pageNumber);
      const updated = await extractWithProgressiveVision(page, result);

      setPdfReadResults((current) =>
        current.map((item) => (item.row.id === id ? updated : item)),
      );
      setRows((current) =>
        current.map((row) => (row.id === id ? updated.row : row)).sort(compareBySheet),
      );
    } catch (error) {
      setPdfReadError(error instanceof Error ? error.message : "Não foi possível reanalisar a prancha.");
    } finally {
      setReprocessingRowId(null);
    }
  }

  function sortRowsBySheet() {
    setRows((current) => [...current].sort(compareBySheet));
  }

  function resetRows() {
    setRows(initialRows);
    setTomos(initialTomos);
    changeReferenceTotal(30);
    setReviewedGlobalWarnings([]);
  }

  function toggleReviewedAlert(rowId: number, key: string, checked: boolean) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextKeys = checked
          ? [...new Set([...row.reviewedAlertKeys, key])]
          : row.reviewedAlertKeys.filter((currentKey) => currentKey !== key);

        return {
          ...row,
          reviewedAlertKeys: nextKeys,
        };
      }),
    );
  }

  function toggleGlobalWarning(key: string, checked: boolean) {
    setReviewedGlobalWarnings((current) =>
      checked ? [...new Set([...current, key])] : current.filter((currentKey) => currentKey !== key),
    );
  }

  function goToStep(step: number) {
    if (step > 1 && (!fullAnalysisComplete || !hasRequiredLdData)) {
      setActiveStep(1);
      return;
    }

    if (step > 2 && !canAdvancePastReview) {
      setActiveStep(2);
      return;
    }

    if (step > 3 && !canAdvancePastTomos) {
      setActiveStep(3);
      return;
    }

    setActiveStep(step);
  }

  function goNext() {
    if (activeStep === 0 && !preAnalysisResult) {
      return;
    }

    if (activeStep === 1 && (!fullAnalysisComplete || !hasRequiredLdData)) {
      return;
    }

    if (activeStep === 2 && !canAdvancePastReview) {
      return;
    }

    if (activeStep === 3 && !canAdvancePastTomos) {
      return;
    }

    setActiveStep((step) => Math.min(steps.length - 1, step + 1));
  }

  function changeTomoCount(count: number) {
    setTomos(buildBalancedTomos(tomoSheetTotal, count));
  }

  function changeTomoQuantity(index: number, quantity: number) {
    setTomos((current) => updateTomoQuantity(current, tomoSheetTotal, index, quantity));
  }

  function changeReferenceTotal(total: number | null) {
    setReferenceTotal(total);
    setManualTotal(total ? String(total) : "");

    if (total) {
      setTomos(buildBalancedTomos(total, Math.max(1, Math.ceil(total / 15))));
    }
  }

  function buildInconsistencyPayload() {
    return {
      missingSheets: validation.missingSheets,
      globalWarnings: validation.globalWarnings.map((warning) => warning.label),
      rowWarnings: rows
        .map((row) => {
          const warnings = (validation.rowIssues[row.id] ?? []).filter(
            (issue) => issue.severity === "warning",
          );

          return {
            sheet: row.sheet,
            file: row.file,
            warnings: warnings.map((warning) => warning.label),
            reviewed:
              warnings.length > 0 &&
              warnings.every((warning) => row.reviewedAlertKeys.includes(warning.key)),
          };
        })
        .filter((row) => row.warnings.length > 0),
    };
  }

  async function generateFinalFiles() {
    if (!finalChecklistComplete) {
      setPackageError("Conclua o checklist final antes de gerar os arquivos.");
      return;
    }

    setPackageGenerating(true);
    setPackageError("");

    try {
      const templateBase64 =
        ldData.templateMode === "alternativo" && templateFile
          ? await fileToDataUrl(templateFile)
          : null;
      const response = await fetch("/api/ld/generate-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ldData,
          rows: rows.map((row) => ({
            sheet: row.sheet,
            file: row.file,
            description: row.description,
            readDiscipline: row.readDiscipline,
            lowConfidence: row.lowConfidence,
            reviewedAlertKeys: row.reviewedAlertKeys,
          })),
          tomos,
          templateBase64,
          inconsistencies: buildInconsistencyPayload(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Não foi possível gerar os arquivos finais.");
      }

      const payload = (await response.json()) as {
        files: {
          odt: { name: string; data: string };
          pdf: { name: string; data: string } | null;
          report: { name: string; data: string } | null;
          zip: { name: string; data: string };
        };
        pdfError?: string;
      };

      generatedDownloads.forEach((download) => URL.revokeObjectURL(download.url));

      if (payload.pdfError) {
        setPackageError(`PDF indisponivel: ${payload.pdfError}`);
      }

      setGeneratedDownloads(
        [
          {
            fileName: payload.files.odt.name,
            kind: "odt" as const,
            url: base64ToObjectUrl(payload.files.odt.data, "application/vnd.oasis.opendocument.text"),
          },
          payload.files.pdf
            ? {
                fileName: payload.files.pdf.name,
                kind: "pdf" as const,
                url: base64ToObjectUrl(payload.files.pdf.data, "application/pdf"),
              }
            : null,
          payload.files.report
            ? {
                fileName: payload.files.report.name,
                kind: "report" as const,
                url: base64ToObjectUrl(payload.files.report.data, "text/markdown"),
              }
            : null,
          {
            fileName: payload.files.zip.name,
            kind: "zip" as const,
            url: base64ToObjectUrl(payload.files.zip.data, "application/zip"),
          },
        ].filter((download): download is GeneratedDownload => Boolean(download)),
      );
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : "Não foi possível gerar os arquivos finais.");
    } finally {
      setPackageGenerating(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              NexoDoc
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Criador de Listas de Documentos
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {getAutosaveLabel(autosaveState)}
              {autosaveMessage ? ` · ${autosaveMessage}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center rounded-sm border border-border px-3 py-2 font-mono text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Voltar ao painel de módulos
              </Link>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-sm border border-primary/35 bg-primary px-3 py-2 font-mono text-xs text-primary-foreground transition hover:bg-primary/90"
                >
                  <Gauge className="size-3.5" />
                  Painel admin
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Projeto" value={ldData.projectCode} />
            <Metric label="Disciplina" value={ldData.discipline.toUpperCase()} />
            <Metric label="Pranchas" value={String(rows.length)} />
            <Metric label="Tomos" value={String(tomos.length)} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit border border-border bg-card p-3">
          <div className="mb-4 space-y-3 border-b border-border pb-4">
            <button
              type="button"
              onClick={startNewDraft}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted"
            >
              <Plus size={16} />
              Nova LD
            </button>
            <LdHistoryPanel
              drafts={drafts}
              activeDraftId={draftId}
              error={draftsError}
              onLoad={loadDraft}
              onArchive={archiveDraft}
            />
            <Link
              href="/ld/historico"
              className="block rounded-md border border-border px-3 py-2 text-center text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Ver histórico completo
            </Link>
          </div>
          <nav className="space-y-1" aria-label="Etapas">
            {steps.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => goToStep(index)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  activeStep === index
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                  {index + 1}
                </span>
                {step}
              </button>
            ))}
          </nav>
          <LdSideSummary
            uploadedCount={uploadedFileCount}
            analyzedCount={rows.length}
            pendingCount={validation.blockingIssues.length + Math.max(0, warningCount - reviewedWarnings)}
            tomoCount={tomos.length}
            autosaveState={autosaveState}
            autosaveMessage={autosaveMessage}
            generatedCount={generatedDownloads.length}
          />
        </aside>

        <section className="min-w-0 border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm text-muted-foreground">Etapa {activeStep + 1} de 6</p>
            <h2 className="mt-1 text-xl font-semibold">{steps[activeStep]}</h2>
          </div>

          <div className="p-5">
            {loadedDraftNotice ? (
              <div className="mb-4 rounded-md border border-warning bg-warning-soft p-3 text-sm text-muted-foreground">
                {loadedDraftNotice}
              </div>
            ) : null}
            {activeStep === 0 && (
              <>
                <UploadStep onFilesSelected={preAnalyzePdfFiles} processing={pdfProcessing} />
                <PdfReadSummary
                  results={preAnalysisResult ? [preAnalysisResult] : []}
                  processing={pdfProcessing}
                  error={pdfReadError}
                  progress={pdfProgress}
                />
              </>
            )}
            {activeStep === 1 && (
              <LdForm
                data={ldData}
                sources={ldFieldSources}
                missingFields={missingRequiredLdFields}
                templateFile={templateFile}
                onChange={updateLdData}
                onApplySuggestions={applyLdDataSuggestions}
                onTemplateFileChange={updateTemplateFile}
              />
            )}
            {activeStep === 1 && (
              <PreAnalysisPanel
                files={uploadedPdfFiles}
                result={preAnalysisResult}
                processing={pdfProcessing}
                onAnalyzeAll={() => processPdfFiles()}
              />
            )}
            {activeStep === 1 && (
              <PdfReadSummary
                results={pdfReadResults}
                processing={pdfProcessing}
                error={pdfReadError}
                progress={pdfProgress}
              />
            )}
            {activeStep === 2 && (
              <ReviewTable
                rows={rows}
                referenceTotal={referenceTotal}
                manualTotal={manualTotal}
                validation={validation}
                reviewedGlobalWarnings={reviewedGlobalWarnings}
                readResults={pdfReadResults}
                reprocessingRowId={reprocessingRowId}
                onAdd={addRow}
                onRemove={removeRow}
                onUpdate={updateRow}
                onSort={sortRowsBySheet}
                onReset={resetRows}
                onReferenceTotalChange={changeReferenceTotal}
                onManualTotalChange={setManualTotal}
                onToggleReviewedAlert={toggleReviewedAlert}
                onToggleGlobalWarning={toggleGlobalWarning}
                onReprocess={reprocessRow}
              />
            )}
            {activeStep === 3 && (
              <TomosStep
                tomos={tomos}
                totalSheets={tomoSheetTotal}
                sectionTitle={ldData.sectionTitle}
                onTomoCountChange={changeTomoCount}
                onQuantityChange={changeTomoQuantity}
              />
            )}
            {activeStep === 4 && (
              <SummaryStep
                data={ldData}
                totalRows={rows.length}
                tomoCount={tomos.length}
                tomos={tomos}
                reviewedWarnings={reviewedWarnings}
                warningCount={warningCount}
                blockingCount={validation.blockingIssues.length}
                missingSheets={validation.missingSheets}
                files={generatedFiles}
              />
            )}
            {activeStep === 5 && (
              <FinalStep
                files={generatedFiles}
                downloads={generatedDownloads}
                coverGeneratorHref={coverGeneratorHref}
                generating={packageGenerating}
                error={packageError}
                checklistItems={finalChecklistItems}
                checkedItems={finalChecklist}
                onChecklistChange={setFinalChecklist}
                onGenerate={generateFinalFiles}
              />
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
              disabled={activeStep === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={
                activeStep === steps.length - 1 ||
                (activeStep === 0 && !preAnalysisResult) ||
                (activeStep === 1 && (!fullAnalysisComplete || !hasRequiredLdData)) ||
                (activeStep === 2 && !canAdvancePastReview) ||
                (activeStep === 3 && !canAdvancePastTomos)
              }
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {activeStep === 0 && !preAnalysisResult
                ? "Importe os PDFs"
                : activeStep === 1 && !fullAnalysisComplete
                ? pdfProcessing ? "Aguarde a análise" : "Analise todas as pranchas"
                : activeStep === 1 && !hasRequiredLdData
                ? "Preencha os dados da LD"
                : activeStep === 2
                  ? "Validar e avançar"
                  : "Avançar"}
              <ChevronRight size={16} />
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

function LdSideSummary({
  uploadedCount,
  analyzedCount,
  pendingCount,
  tomoCount,
  autosaveState,
  autosaveMessage,
  generatedCount,
}: {
  uploadedCount: number;
  analyzedCount: number;
  pendingCount: number;
  tomoCount: number;
  autosaveState: AutosaveState;
  autosaveMessage: string;
  generatedCount: number;
}) {
  const items = [
    ["PDFs carregados", String(uploadedCount)],
    ["Pranchas analisadas", String(analyzedCount)],
    ["Pendências", String(pendingCount)],
    ["Tomos", String(tomoCount)],
    ["Arquivos finais", String(generatedCount)],
  ];

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        Resumo da LD
      </p>
      <dl className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-mono text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 rounded-md border border-border bg-background px-3 py-2">
        <p className="text-xs text-muted-foreground">Autosave</p>
        <p className="mt-1 text-xs font-medium">
          {getAutosaveLabel(autosaveState)}
          {autosaveMessage ? ` · ${autosaveMessage}` : ""}
        </p>
      </div>
    </div>
  );
}

function LdHistoryPanel({
  drafts,
  activeDraftId,
  error,
  onLoad,
  onArchive,
}: {
  drafts: LdDraftListItem[];
  activeDraftId: string | null;
  error: string;
  onLoad: (draft: LdDraftListItem) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Histórico
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rascunhos salvos por usuário.
        </p>
      </div>
      {error ? (
        <p className="rounded-md border border-warning bg-warning-soft p-2 text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}
      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {drafts.length === 0 && !error ? (
          <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
            Nenhuma LD salva ainda.
          </p>
        ) : null}
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className={`rounded-md border p-2 ${
              activeDraftId === draft.id ? "border-primary bg-primary/10" : "border-border bg-background"
            }`}
          >
            <button
              type="button"
              onClick={() => onLoad(draft)}
              className="block w-full text-left"
            >
              <span className="block truncate text-xs font-semibold">
                {draft.projectCode || "Sem código"} · {draft.workName || "LD em montagem"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {draft.status === "GENERATED" ? "Gerada" : "Rascunho"} · {new Date(draft.updatedAt).toLocaleDateString("pt-BR")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onArchive(draft.id)}
              className="mt-2 text-xs text-muted-foreground transition hover:text-destructive"
            >
              Arquivar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LdForm({
  data,
  sources,
  missingFields,
  templateFile,
  onChange,
  onApplySuggestions,
  onTemplateFileChange,
}: {
  data: LdData;
  sources: LdFieldSources;
  missingFields: LdFieldKey[];
  templateFile: File | null;
  onChange: (key: keyof LdData, value: string) => void;
  onApplySuggestions: () => void;
  onTemplateFileChange: (file: File | null) => void;
}) {
  const suggestion = buildLdDataSuggestion(data);
  const hasSuggestions = Object.keys(suggestion).length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-md border border-warning bg-warning-soft p-3 text-sm md:col-span-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-medium">Confira os dados antes de avançar.</p>
            <p className="mt-1 text-muted-foreground">
              O NexoDoc só preenche órgão, obra e fase quando encontra esses dados no rodapé/cabeçalho do PDF.
              Se não encontrar, os campos ficam em branco para evitar siglas ou nomes de projeto incorretos.
            </p>
            {hasSuggestions ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Há sugestões seguras para campos padrão deste pacote. O nome da obra continua manual se não for encontrado no PDF.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onApplySuggestions}
            disabled={!hasSuggestions}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar sugestões seguras
          </button>
        </div>
      </div>
      {missingFields.length > 0 ? (
        <RequiredFieldsSummary missingFields={missingFields} />
      ) : (
        <div className="rounded-md border border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] p-3 text-sm text-[var(--status-ok)] md:col-span-2">
          Dados mínimos da LD preenchidos. Confira a origem de cada campo antes de avançar.
        </div>
      )}
      <Field required label="Código do projeto" source={sources.projectCode} value={data.projectCode} onChange={(value) => onChange("projectCode", value)} />
      <Field required label="Código formatado" source={sources.formattedCode} value={data.formattedCode} onChange={(value) => onChange("formattedCode", value)} />
      <Field required label="Sigla da disciplina" source={sources.discipline} value={data.discipline} onChange={(value) => onChange("discipline", value)} />
      <Field required label="Revisão" source={sources.revision} value={data.revision} onChange={(value) => onChange("revision", value)} />
      <Field required className="md:col-span-2" label="Título da seção" source={sources.sectionTitle} value={data.sectionTitle} onChange={(value) => onChange("sectionTitle", value)} />
      <Field required label="Órgão/cliente" source={sources.client} value={data.client} onChange={(value) => onChange("client", value)} />
      <Field required label="Nome da obra" source={sources.workName} value={data.workName} onChange={(value) => onChange("workName", value)} />
      <Field required label="Fase" source={sources.phase} value={data.phase} onChange={(value) => onChange("phase", value)} />
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Template</span>
        <select
          value={data.templateMode}
          onChange={(event) => onChange("templateMode", event.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="padrao">Usar template padrão</option>
          <option value="alternativo">Anexar template alternativo</option>
        </select>
      </label>
      {data.templateMode === "alternativo" && (
        <label className="grid gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">Template alternativo (.odt)</span>
          <input
            type="file"
            accept=".odt,application/vnd.oasis.opendocument.text"
            onChange={(event) => onTemplateFileChange(event.target.files?.[0] ?? null)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {templateFile && (
            <span className="text-xs text-muted-foreground">
              Template selecionado: {templateFile.name}
            </span>
          )}
        </label>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  source,
  onChange,
  className = "",
  required = false,
}: {
  label: string;
  value: string;
  source: LdFieldSource;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  const isMissing = required && value.trim().length === 0;

  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
        {label}
        <FieldSourceBadge source={isMissing ? "empty" : source} />
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 rounded-md border bg-background px-3 text-sm ${
          isMissing ? "border-warning" : "border-border"
        }`}
      />
    </label>
  );
}

function RequiredFieldsSummary({ missingFields }: { missingFields: LdFieldKey[] }) {
  const labels: Record<LdFieldKey, string> = {
    projectCode: "código do projeto",
    formattedCode: "código formatado",
    discipline: "disciplina",
    revision: "revisão",
    sectionTitle: "título da seção",
    client: "órgão/cliente",
    workName: "nome da obra",
    phase: "fase",
  };

  return (
    <div className="rounded-md border border-warning bg-warning-soft p-3 text-sm md:col-span-2">
      <div className="flex items-start gap-2">
        <CircleAlert size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Pendências obrigatórias: {missingFields.length}</p>
          <p className="mt-1 text-muted-foreground">
            Preencha {missingFields.map((field) => labels[field]).join(", ")} para liberar a próxima etapa.
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldSourceBadge({ source }: { source: LdFieldSource }) {
  const sourceMap: Record<LdFieldSource, { label: string; className: string }> = {
    ai: {
      label: "IA",
      className: "border-primary/30 bg-primary/10 text-primary",
    },
    system: {
      label: "Padrão",
      className: "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]",
    },
    manual: {
      label: "Manual",
      className: "border-border bg-muted text-muted-foreground",
    },
    history: {
      label: "Histórico",
      className: "border-border bg-muted text-muted-foreground",
    },
    empty: {
      label: "Pendente",
      className: "border-warning bg-warning-soft text-foreground",
    },
  };
  const config = sourceMap[source];

  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${config.className}`}>
      {config.label}
    </span>
  );
}

function UploadStep({
  onFilesSelected,
  processing,
}: {
  onFilesSelected: (files: FileList) => void;
  processing: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <UploadPanel
        title="PDF único com várias pranchas"
        description="O sistema separa as páginas e tenta extrair PRANCHA, ARQUIVO e CONTEÚDO."
        disabled={processing}
        onFilesSelected={onFilesSelected}
      />
      <UploadPanel
        title="Vários PDFs separados"
        description="Arquivos individuais processados em sequência e ordenados pelo campo PRANCHA."
        multiple
        disabled={processing}
        onFilesSelected={onFilesSelected}
      />
      <div className="md:col-span-2 rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
        A extração interpreta o texto do PDF e aplica leitura visual progressiva quando algum campo exigir confirmação.
      </div>
    </div>
  );
}

function UploadPanel({
  title,
  description,
  multiple = false,
  disabled = false,
  onFilesSelected,
}: {
  title: string;
  description: string;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: FileList) => void;
}) {
  return (
    <label
      className={`flex min-h-56 flex-col items-center justify-center rounded-md border border-dashed border-border bg-background p-6 text-center transition ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"
      }`}
    >
      {disabled ? (
        <Loader2 className="animate-spin text-primary" size={28} />
      ) : (
        <Upload className="text-primary" size={28} />
      )}
      <span className="mt-4 font-medium">{title}</span>
      <span className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</span>
      <input
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files) {
            onFilesSelected(event.target.files);
            event.target.value = "";
          }
        }}
        className="sr-only"
      />
    </label>
  );
}

function PreAnalysisPanel({
  files,
  result,
  processing,
  onAnalyzeAll,
}: {
  files: File[];
  result: PdfReadResult | null;
  processing: boolean;
  onAnalyzeAll: () => void;
}) {
  return (
    <div className="mt-4 rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Pré-análise dos PDFs</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {files.length > 0
              ? `${files.length} arquivo(s) carregado(s). Confira os dados sugeridos acima antes de analisar todas as pranchas.`
              : "Carregue os PDFs na primeira etapa para sugerir os dados da LD."}
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyzeAll}
          disabled={processing || files.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
          Analisar todas as pranchas
        </button>
      </div>
      {result && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-border bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Prancha lida</dt>
            <dd className="mt-1 font-mono font-semibold">{result.row.sheet || "Não localizada"}</dd>
          </div>
          <div className="rounded-md border border-border bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Arquivo</dt>
            <dd className="mt-1 truncate font-mono font-semibold">{result.row.file || "Não localizado"}</dd>
          </div>
          <div className="rounded-md border border-border bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Origem</dt>
            <dd className="mt-1 font-semibold">
              {describeExtractionSource(result)}
            </dd>
            {result.fallbackReason ? (
              <p className="mt-1 text-xs text-[var(--status-warning)]">
                Fallback utilizado: {result.fallbackReason}
              </p>
            ) : null}
          </div>
        </dl>
      )}
    </div>
  );
}

function PdfReadSummary({
  results,
  processing,
  error,
  progress,
}: {
  results: PdfReadResult[];
  processing: boolean;
  error: string;
  progress: PdfProcessingProgress | null;
}) {
  if (!processing && !error && results.length === 0) {
    return null;
  }

  const reviewCount = results.filter((result) => result.row.lowConfidence).length;
  const textAiCount = results.filter((result) => result.aiExtraction === "text").length;
  const visualAiCount = results.filter((result) => result.aiExtraction === "visual").length;
  const aiFailedCount = results.filter((result) => result.aiExtraction === "failed").length;

  return (
    <div className="mt-4 rounded-md border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {processing ? (
          <Loader2 size={16} className="animate-spin text-primary" />
        ) : (
          <FileSearch size={16} className="text-primary" />
        )}
        Extração por IA
      </div>
      {processing && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate text-muted-foreground">
              {progress?.fileName
                ? `${progress.fileName}${progress.pageNumber ? `, página ${progress.pageNumber}` : ""}`
                : "Preparando arquivos"}
            </span>
            {progress?.total ? (
              <span className="shrink-0 font-mono text-xs font-semibold">
                {progress.current}/{progress.total}
              </span>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{
                width: progress?.total ? `${Math.max(4, (progress.current / progress.total) * 100)}%` : "4%",
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {progress?.status ?? "Preparando leitura"}.
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {!processing && results.length > 0 && (
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-6">
          <Metric label="Páginas lidas" value={String(results.length)} />
          <Metric label="Para revisão" value={String(reviewCount)} />
          <Metric label="Preenchidas" value={String(results.length - reviewCount)} />
          <Metric label="IA texto" value={String(textAiCount)} />
          <Metric label="IA visual" value={String(visualAiCount)} />
          <Metric label="IA falhou" value={String(aiFailedCount)} />
        </div>
      )}
      {!processing && results.some((result) => result.aiError) && (
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {results
            .filter((result) => result.aiError)
            .map((result) => (
              <p key={`${result.fileName}-${result.pageNumber}`}>
                {result.fileName}, página {result.pageNumber}: {result.aiError}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function ReviewTable({
  rows,
  referenceTotal,
  manualTotal,
  validation,
  reviewedGlobalWarnings,
  readResults,
  reprocessingRowId,
  onAdd,
  onRemove,
  onUpdate,
  onSort,
  onReset,
  onReferenceTotalChange,
  onManualTotalChange,
  onToggleReviewedAlert,
  onToggleGlobalWarning,
  onReprocess,
}: {
  rows: ReviewRow[];
  referenceTotal: number | null;
  manualTotal: string;
  validation: ValidationResult;
  reviewedGlobalWarnings: string[];
  readResults: PdfReadResult[];
  reprocessingRowId: number | null;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, key: keyof ReviewRow, value: string | boolean) => void;
  onSort: () => void;
  onReset: () => void;
  onReferenceTotalChange: (value: number | null) => void;
  onManualTotalChange: (value: string) => void;
  onToggleReviewedAlert: (rowId: number, key: string, checked: boolean) => void;
  onToggleGlobalWarning: (key: string, checked: boolean) => void;
  onReprocess: (rowId: number) => void;
}) {
  const [zoomedStamp, setZoomedStamp] = useState<PdfReadResult | null>(null);
  const [filterMode, setFilterMode] = useState<ReviewFilterMode>("all");
  const [sortMode, setSortMode] = useState<ReviewSortMode>("sheet");
  const [density, setDensity] = useState<ReviewDensity>("comfortable");
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(() => new Set());
  const [bulkDiscipline, setBulkDiscipline] = useState("");
  const [triageMode, setTriageMode] = useState(false);
  const [triageIndex, setTriageIndex] = useState(0);
  const warningIssues = rows.flatMap((row) =>
    (validation.rowIssues[row.id] ?? []).filter((issue) => issue.severity === "warning"),
  );
  const reviewedRowWarnings = rows.reduce((total, row) => {
    const rowWarnings = (validation.rowIssues[row.id] ?? []).filter(
      (issue) => issue.severity === "warning",
    );
    return total + rowWarnings.filter((issue) => row.reviewedAlertKeys.includes(issue.key)).length;
  }, 0);
  const reviewedGlobalWarningCount = validation.globalWarnings.filter((warning) =>
    reviewedGlobalWarnings.includes(warning.key),
  ).length;
  const totalWarnings = warningIssues.length + validation.globalWarnings.length;
  const reviewedWarnings = reviewedRowWarnings + reviewedGlobalWarningCount;
  const unreviewedWarnings = Math.max(0, totalWarnings - reviewedWarnings);
  const getRowIssues = (row: ReviewRow) => validation.rowIssues[row.id] ?? [];
  const hasMissingData = (row: ReviewRow) =>
    !parseSheet(row.sheet) || row.file.trim().length === 0 || row.description.trim().length === 0;
  const getRowPriority = (row: ReviewRow) => {
    const issues = getRowIssues(row);

    if (issues.some((issue) => issue.severity === "blocker")) {
      return 0;
    }

    if (issues.some((issue) => issue.severity === "warning")) {
      return 1;
    }

    if (row.lowConfidence) {
      return 2;
    }

    if (hasMissingData(row)) {
      return 3;
    }

    return 4;
  };
  const filteredRows = rows.filter((row) => {
    const issues = getRowIssues(row);

    if (filterMode === "blockers") {
      return issues.some((issue) => issue.severity === "blocker");
    }

    if (filterMode === "warnings") {
      return issues.some((issue) => issue.severity === "warning");
    }

    if (filterMode === "low-confidence") {
      return row.lowConfidence;
    }

    if (filterMode === "missing") {
      return hasMissingData(row);
    }

    return true;
  });
  const visibleRows = [...filteredRows].sort((a, b) => {
    if (sortMode === "file") {
      return a.file.localeCompare(b.file, "pt-BR", { numeric: true });
    }

    if (sortMode === "discipline") {
      return a.readDiscipline.localeCompare(b.readDiscipline, "pt-BR", { numeric: true }) || compareBySheet(a, b);
    }

    if (sortMode === "status") {
      return getRowPriority(a) - getRowPriority(b) || compareBySheet(a, b);
    }

    return compareBySheet(a, b);
  });
  const pendingRows = [...rows]
    .filter((row) => {
      const issues = getRowIssues(row);

      return issues.some(
        (issue) =>
          issue.severity === "blocker" ||
          (issue.severity === "warning" && !row.reviewedAlertKeys.includes(issue.key)),
      );
    })
    .sort((a, b) => getRowPriority(a) - getRowPriority(b) || compareBySheet(a, b));
  const safeTriageIndex = Math.min(triageIndex, Math.max(0, pendingRows.length - 1));
  const triageRow = pendingRows[safeTriageIndex];
  const renderedRows = triageMode ? (triageRow ? [triageRow] : []) : visibleRows;
  const selectedRows = rows.filter((row) => selectedRowIds.has(row.id));
  const visibleSelectedCount = renderedRows.filter((row) => selectedRowIds.has(row.id)).length;
  const allVisibleSelected = renderedRows.length > 0 && visibleSelectedCount === renderedRows.length;
  const filterOptions: Array<{ value: ReviewFilterMode; label: string; count: number }> = [
    { value: "all", label: "Todas", count: rows.length },
    {
      value: "blockers",
      label: "Com erro",
      count: rows.filter((row) => getRowIssues(row).some((issue) => issue.severity === "blocker")).length,
    },
    {
      value: "warnings",
      label: "Alertas",
      count: rows.filter((row) => getRowIssues(row).some((issue) => issue.severity === "warning")).length,
    },
    { value: "low-confidence", label: "Baixa confiança", count: rows.filter((row) => row.lowConfidence).length },
    { value: "missing", label: "Campos vazios", count: rows.filter(hasMissingData).length },
  ];
  const copyVisibleRows = async () => {
    const text = [
      "Folha\tArquivo\tDescricao\tDisciplina\tStatus",
      ...renderedRows.map((row) => {
        const status = getRowIssues(row)
          .map((issue) => issue.label)
          .join(" | ") || (row.lowConfidence ? "Baixa confianca" : "OK");

        return [row.sheet, row.file, row.description, row.readDiscipline, status]
          .map((value) => value.replace(/\s+/g, " ").trim())
          .join("\t");
      }),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setClipboardStatus(`${renderedRows.length} linhas copiadas`);
    } catch {
      setClipboardStatus("Nao foi possivel copiar automaticamente");
    }

    window.setTimeout(() => setClipboardStatus(""), 2500);
  };
  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);

      for (const row of renderedRows) {
        if (checked) {
          next.add(row.id);
        } else {
          next.delete(row.id);
        }
      }

      return next;
    });
  };
  const toggleRowSelection = (rowId: number, checked: boolean) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }

      return next;
    });
  };
  const markSelectedWarningsReviewed = () => {
    for (const row of selectedRows) {
      for (const issue of getRowIssues(row).filter((item) => item.severity === "warning")) {
        if (!row.reviewedAlertKeys.includes(issue.key)) {
          onToggleReviewedAlert(row.id, issue.key, true);
        }
      }
    }
  };
  const clearSelectedLowConfidence = () => {
    for (const row of selectedRows) {
      if (row.lowConfidence) {
        onUpdate(row.id, "lowConfidence", false);
      }
    }
  };
  const applySelectedDiscipline = () => {
    const nextDiscipline = bulkDiscipline.trim();

    if (!nextDiscipline) {
      return;
    }

    for (const row of selectedRows) {
      onUpdate(row.id, "readDiscipline", nextDiscipline);
    }
  };
  const removeSelectedRows = () => {
    if (
      selectedRows.length === 0 ||
      !window.confirm(`Excluir ${selectedRows.length} linha(s) selecionada(s) da LD?`)
    ) {
      return;
    }

    for (const row of selectedRows) {
      onRemove(row.id);
    }

    setSelectedRowIds(new Set());
  };

  return (
    <div className="space-y-4">
      <ValidationPanel
        validation={validation}
        totalWarnings={totalWarnings}
        reviewedWarnings={reviewedWarnings}
      />
      <ReviewPendingSummary
        blockers={validation.blockingIssues}
        unreviewedWarnings={unreviewedWarnings}
        missingSheets={validation.missingSheets}
        referenceTotalNeeded={validation.totals.length > 1 && referenceTotal === null}
      />

      {validation.totals.length > 1 && (
        <ReferenceTotalPanel
          totals={validation.totals}
          referenceTotal={referenceTotal}
          manualTotal={manualTotal}
          onReferenceTotalChange={onReferenceTotalChange}
          onManualTotalChange={onManualTotalChange}
        />
      )}

      {validation.globalWarnings.length > 0 && (
        <div className="space-y-2 rounded-md border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Alertas gerais para relatório futuro</h3>
          <div className="grid gap-2">
            {validation.globalWarnings.map((warning) => (
              <label key={warning.key} className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={reviewedGlobalWarnings.includes(warning.key)}
                  onChange={(event) => onToggleGlobalWarning(warning.key, event.target.checked)}
                />
                <span>{warning.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter size={16} />
              Revisão das pranchas
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {triageMode
                ? `Triagem ativa: pendência ${pendingRows.length ? safeTriageIndex + 1 : 0} de ${pendingRows.length}.`
                : `Mostrando ${visibleRows.length} de ${rows.length} pranchas. Use filtros para atacar primeiro o que bloqueia a LD.`}
            </p>
          </div>
          <button
            type="button"
            onClick={copyVisibleRows}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted"
          >
            <Copy size={16} />
            Copiar visão atual
          </button>
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Triagem rápida</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pendingRows.length > 0
                ? `${pendingRows.length} prancha(s) ainda precisam de decisão.`
                : "Todas as pendências foram tratadas."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {triageMode && pendingRows.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setTriageIndex((current) => Math.max(0, current - 1))}
                  disabled={safeTriageIndex === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setTriageIndex((current) => Math.min(pendingRows.length - 1, current + 1))}
                  disabled={safeTriageIndex >= pendingRows.length - 1}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
                >
                  Próxima
                  <ChevronRight size={14} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setTriageMode((current) => !current);
                setTriageIndex(0);
              }}
              disabled={!triageMode && pendingRows.length === 0}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                triageMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {triageMode ? "Sair da triagem" : "Iniciar triagem"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros da revisão">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterMode(option.value)}
              className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                filterMode === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
        {clipboardStatus ? <p className="text-xs text-muted-foreground">{clipboardStatus}</p> : null}
        <details className="group border-t border-border pt-3">
          <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-2 text-sm text-muted-foreground transition hover:text-foreground">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal size={16} />
              Ajustes avançados
            </span>
            <span className="text-xs">
              {selectedRows.length > 0
                ? `${selectedRows.length} selecionada(s)`
                : "Ordenação, densidade e ações em massa"}
            </span>
          </summary>
          <div className="grid gap-3 pt-3">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSort}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted"
                >
                  <ShieldCheck size={16} />
                  Ordenar por folha
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted"
                >
                  <RotateCcw size={16} />
                  Restaurar mock
                </button>
              </div>
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted"
              >
                <Plus size={16} />
                Adicionar linha
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                Ordenar
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as ReviewSortMode)}
                  className="h-9 rounded-md border border-border bg-card px-2 text-foreground"
                >
                  <option value="sheet">Nº da folha</option>
                  <option value="status">Status de revisão</option>
                  <option value="file">Arquivo</option>
                  <option value="discipline">Disciplina lida</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                Densidade
                <select
                  value={density}
                  onChange={(event) => setDensity(event.target.value as ReviewDensity)}
                  className="h-9 rounded-md border border-border bg-card px-2 text-foreground"
                >
                  <option value="comfortable">Confortável</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 rounded-md border border-border bg-card p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="text-sm font-medium">
                  {selectedRows.length > 0
                    ? `${selectedRows.length} prancha(s) selecionada(s)`
                    : "Ações em massa"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecione linhas na tabela para revisar alertas, limpar baixa confiança ou padronizar disciplina.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={markSelectedWarningsReviewed}
                  disabled={selectedRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check size={16} />
                  Revisar alertas
                </button>
                <button
                  type="button"
                  onClick={clearSelectedLowConfidence}
                  disabled={selectedRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Limpar baixa confiança
                </button>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Disciplina
                  <input
                    value={bulkDiscipline}
                    onChange={(event) => setBulkDiscipline(event.target.value)}
                    placeholder="ex.: est"
                    className="h-9 w-24 rounded-md border border-border bg-background px-2 text-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={applySelectedDiscipline}
                  disabled={selectedRows.length === 0 || bulkDiscipline.trim().length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aplicar
                </button>
                <button
                  type="button"
                  onClick={removeSelectedRows}
                  disabled={selectedRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-destructive transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Excluir seleção
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>
      <div className="max-h-[68vh] overflow-auto border border-border">
        <table className="w-full min-w-[1500px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--nexodoc-raised)] text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="w-12 border-b border-border px-3 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
                    }
                  }}
                  onChange={(event) => toggleVisibleSelection(event.target.checked)}
                  aria-label="Selecionar pranchas visíveis"
                  className="size-4"
                />
              </th>
              <th className="w-28 border-b border-border px-3 py-3">Nº da folha</th>
              <th className="w-52 border-b border-border px-3 py-3">Arquivos</th>
              <th className="border-b border-border px-3 py-3">Descrição</th>
              <th className="w-44 border-b border-border px-3 py-3">Selo</th>
              <th className="w-40 border-b border-border px-3 py-3">Leitura</th>
              <th className="w-56 border-b border-border px-3 py-3">Status</th>
              <th className="w-24 border-b border-border px-3 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {renderedRows.map((row) => {
              const result = readResults.find((item) => item.row.id === row.id);
              const reprocessing = reprocessingRowId === row.id;

              return (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-3 align-top">
                  <input
                    type="checkbox"
                    checked={selectedRowIds.has(row.id)}
                    onChange={(event) => toggleRowSelection(row.id, event.target.checked)}
                    aria-label={`Selecionar prancha ${row.sheet || row.id}`}
                    className="size-4"
                  />
                </td>
                <td className="px-3 py-3 align-top">
                  <CellInput value={row.sheet} onChange={(value) => onUpdate(row.id, "sheet", value)} />
                </td>
                <td className="px-3 py-3 align-top">
                  <CellInput value={row.file} onChange={(value) => onUpdate(row.id, "file", value)} mono />
                </td>
                <td className="px-3 py-3 align-top">
                  <textarea
                    value={row.description}
                    onChange={(event) => onUpdate(row.id, "description", event.target.value)}
                    className={`w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm ${
                      density === "compact" ? "min-h-12" : "min-h-20"
                    }`}
                  />
                </td>
                <td className="px-3 py-3 align-top">
                  {result?.stampPreviewUrl ? (
                    <div className="space-y-2">
                      <Image
                        src={result.stampPreviewUrl}
                        alt={`Recorte analisado de ${result.fileName}, página ${result.pageNumber}`}
                        width={160}
                        height={80}
                        unoptimized
                        className="h-20 w-40 rounded-sm border border-border bg-background object-contain transition hover:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setZoomedStamp(result)}
                        className="text-xs font-medium text-primary transition hover:text-foreground"
                      >
                        Ampliar selo
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {result.extractionAttempt ?? "Recorte analisado"}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Somente texto</span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="space-y-3">
                    <label className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">Disciplina lida</span>
                      <input
                        value={row.readDiscipline}
                        onChange={(event) => onUpdate(row.id, "readDiscipline", event.target.value)}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={row.lowConfidence}
                        onChange={(event) => onUpdate(row.id, "lowConfidence", event.target.checked)}
                        className="size-4"
                      />
                      Baixa confiança
                    </label>
                    {result && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Origem: {describeExtractionSource(result)}
                        </p>
                        <FieldOriginStack result={result} />
                        {result.fallbackReason ? (
                          <p className="text-xs text-[var(--status-warning)]">
                            Fallback: {result.fallbackReason}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <RowStatus
                    issues={validation.rowIssues[row.id] ?? []}
                    reviewedKeys={row.reviewedAlertKeys}
                    onToggle={(key, checked) => onToggleReviewedAlert(row.id, key, checked)}
                  />
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center gap-2">
                    {result && (
                      <button
                        type="button"
                        onClick={() => onReprocess(row.id)}
                        disabled={reprocessing}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                        aria-label="Reanalisar prancha"
                        title="Reanalisar prancha"
                      >
                        {reprocessing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-destructive"
                      aria-label="Excluir linha"
                      title="Excluir linha"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {renderedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {triageMode ? "Nenhuma pendência restante na triagem." : "Nenhuma prancha corresponde ao filtro atual."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {zoomedStamp && (
        <StampZoomOverlay result={zoomedStamp} onClose={() => setZoomedStamp(null)} />
      )}
    </div>
  );
}

function StampZoomOverlay({
  result,
  onClose,
}: {
  result: PdfReadResult;
  onClose: () => void;
}) {
  const imageUrl = result.stampImageUrl ?? result.stampPreviewUrl;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Conferência do selo</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {result.fileName}, página {result.pageNumber}. Recorte: {result.extractionAttempt ?? "não informado"}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted"
          >
            Fechar
          </button>
        </div>
        <div className="grid max-h-[calc(92vh-64px)] gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-80 overflow-auto rounded-sm border border-border bg-background p-3">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={`Selo ampliado de ${result.fileName}, página ${result.pageNumber}`}
                width={1200}
                height={800}
                unoptimized
                className="h-auto min-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma imagem de selo foi registrada para esta linha.</p>
            )}
          </div>
          <dl className="space-y-3 rounded-sm border border-border bg-background p-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Nº da folha</dt>
              <dd className="mt-1 font-mono">{result.row.sheet || "Não localizado"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Arquivo</dt>
              <dd className="mt-1 break-all font-mono">{result.row.file || "Não localizado"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Descrição</dt>
              <dd className="mt-1 leading-relaxed">{result.row.description || "Não localizada"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Origem</dt>
              <dd className="mt-1">
                {describeExtractionSource(result)}
              </dd>
              {result.fallbackReason ? (
                <p className="mt-1 text-xs text-[var(--status-warning)]">
                  Fallback: {result.fallbackReason}
                </p>
              ) : null}
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function CellInput({
  value,
  onChange,
  mono = false,
}: {
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 w-full rounded-md border border-border bg-background px-2 text-sm ${mono ? "font-mono" : ""}`}
    />
  );
}

function FieldOriginStack({ result }: { result: PdfReadResult }) {
  const sourceLabel =
    result.aiExtraction === "visual" || result.aiExtraction === "text"
      ? "IA"
      : result.aiExtraction === "failed"
        ? "Falha"
        : "Parser";
  const fields: Array<[string, boolean]> = [
    ["Folha", result.foundFields.sheet],
    ["Arquivo", result.foundFields.file],
    ["Descrição", result.foundFields.description],
  ];

  return (
    <div className="grid gap-1">
      {fields.map(([label, found]) => (
        <span
          key={String(label)}
          className={`inline-flex w-fit rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
            found
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-warning bg-warning-soft text-foreground"
          }`}
        >
          {label}: {found ? sourceLabel : "Manual"}
        </span>
      ))}
    </div>
  );
}

function ValidationPanel({
  validation,
  totalWarnings,
  reviewedWarnings,
}: {
  validation: ValidationResult;
  totalWarnings: number;
  reviewedWarnings: number;
}) {
  const hasBlockingIssues = validation.blockingIssues.length > 0;
  const hasPendingWarnings = reviewedWarnings < totalWarnings;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div
        className={`rounded-md border p-4 ${
          hasBlockingIssues ? "border-destructive bg-background" : "border-border bg-background"
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {hasBlockingIssues ? <CircleX size={16} className="text-destructive" /> : <Check size={16} className="text-[var(--status-ok)]" />}
          Erros bloqueantes
        </div>
        <p className="mt-2 text-2xl font-semibold">{validation.blockingIssues.length}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasBlockingIssues ? "Corrija antes de avançar." : "Nenhum bloqueio encontrado."}
        </p>
      </div>

      <div
        className={`rounded-md border p-4 ${
          hasPendingWarnings ? "border-warning bg-warning-soft" : "border-border bg-background"
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CircleAlert size={16} />
          Alertas revisados
        </div>
        <p className="mt-2 text-2xl font-semibold">
          {reviewedWarnings}/{totalWarnings}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalWarnings === 0 ? "Nenhum alerta na tabela." : "Todos precisam ser marcados como revisados."}
        </p>
      </div>

      <div className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-primary" />
          Folhas faltantes
        </div>
        <p className="mt-2 text-2xl font-semibold">{validation.missingSheets.length}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O buraco é mantido e registrado para o relatório MD futuro.
        </p>
      </div>
    </div>
  );
}

function ReviewPendingSummary({
  blockers,
  unreviewedWarnings,
  missingSheets,
  referenceTotalNeeded,
}: {
  blockers: string[];
  unreviewedWarnings: number;
  missingSheets: number[];
  referenceTotalNeeded: boolean;
}) {
  const hasPending = blockers.length > 0 || unreviewedWarnings > 0 || referenceTotalNeeded;

  if (!hasPending && missingSheets.length === 0) {
    return (
      <div className="rounded-md border border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] p-4 text-sm text-[var(--status-ok)]">
        Revisão liberada: sem erros bloqueantes, alertas pendentes ou total divergente.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warning bg-warning-soft p-4 text-sm">
      <div className="flex items-start gap-2">
        <CircleAlert size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold">Resumo único de pendências</h3>
          <div className="mt-2 grid gap-1 text-muted-foreground">
            {referenceTotalNeeded ? <p>Defina o total de referência antes de avançar.</p> : null}
            {blockers.length > 0 ? <p>{blockers.length} erro(s) bloqueante(s) na tabela.</p> : null}
            {unreviewedWarnings > 0 ? <p>{unreviewedWarnings} alerta(s) ainda precisam ser revisados.</p> : null}
            {missingSheets.length > 0 ? (
              <p>Folhas faltantes registradas para relatório: {missingSheets.join(", ")}.</p>
            ) : null}
          </div>
          {blockers.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
              {blockers.slice(0, 4).map((blocker) => (
                <li key={blocker}>- {blocker}</li>
              ))}
              {blockers.length > 4 ? <li>- mais {blockers.length - 4} erro(s)</li> : null}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReferenceTotalPanel({
  totals,
  referenceTotal,
  manualTotal,
  onReferenceTotalChange,
  onManualTotalChange,
}: {
  totals: number[];
  referenceTotal: number | null;
  manualTotal: string;
  onReferenceTotalChange: (value: number | null) => void;
  onManualTotalChange: (value: string) => void;
}) {
  return (
    <div className="rounded-md border border-warning bg-warning-soft p-4">
      <h3 className="text-sm font-semibold">Total divergente</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha qual total deve ser usado como referência. A tabela não será corrigida automaticamente.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {totals.map((total) => (
          <button
            key={total}
            type="button"
            onClick={() => {
              onReferenceTotalChange(total);
              onManualTotalChange(String(total));
            }}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              referenceTotal === total
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {total}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <span>Manual</span>
          <input
            value={manualTotal}
            onChange={(event) => {
              const nextValue = event.target.value;
              onManualTotalChange(nextValue);
              const parsed = Number(nextValue);
              onReferenceTotalChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
            }}
            className="h-9 w-24 rounded-md border border-border bg-background px-2"
          />
        </label>
      </div>
    </div>
  );
}

function RowStatus({
  issues,
  reviewedKeys,
  onToggle,
}: {
  issues: RowIssue[];
  reviewedKeys: string[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        <Check size={14} />
        OK
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue.key} className="space-y-1">
          <span
            className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium ${
              issue.severity === "blocker"
                ? "bg-background text-destructive ring-1 ring-destructive"
                : "bg-warning-soft text-foreground"
            }`}
          >
            {issue.severity === "blocker" ? <CircleX size={14} /> : <CircleAlert size={14} />}
            {issue.label}
          </span>
          {issue.severity === "warning" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={reviewedKeys.includes(issue.key)}
                onChange={(event) => onToggle(issue.key, event.target.checked)}
                className="size-4"
              />
              Marcar como revisado
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

function TomosStep({
  tomos,
  totalSheets,
  sectionTitle,
  onTomoCountChange,
  onQuantityChange,
}: {
  tomos: Tomo[];
  totalSheets: number;
  sectionTitle: string;
  onTomoCountChange: (count: number) => void;
  onQuantityChange: (index: number, quantity: number) => void;
}) {
  const allocatedSheets = tomos.reduce((sum, tomo) => sum + tomo.quantity, 0);
  const maxTomos = Math.min(totalSheets, Math.max(1, Math.ceil(totalSheets / 5)));
  const tomoCountOptions = Array.from({ length: maxTomos }, (_, index) => index + 1);
  const recommendedTomoCount = Math.max(1, Math.ceil(totalSheets / 15));
  const oversizedTomos = tomos.filter((tomo) => tomo.quantity > 15);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Título da seção</p>
          <p className="mt-1 text-sm font-medium">
            {tomos.length > 1 ? `${sectionTitle} (TOMO N)` : sectionTitle}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-muted-foreground">Folhas alocadas</p>
          <p className="mt-1 font-mono text-lg font-semibold">
            {allocatedSheets}/{totalSheets}
          </p>
        </div>
      </div>
      <div className="rounded-md border border-border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Sugestão automática de tomos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para {totalSheets} pranchas, a divisão sugerida é de {recommendedTomoCount} tomo(s),
              mantendo até 15 pranchas por tomo sempre que possível.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTomoCountChange(recommendedTomoCount)}
            className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted"
          >
            Aplicar sugestão
          </button>
        </div>
      </div>
      {oversizedTomos.length > 0 && (
        <div className="rounded-md border border-warning bg-warning-soft p-4">
          <div className="flex items-start gap-2">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold">Atenção: tomo com mais de 15 pranchas</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {oversizedTomos.map((tomo) => `${tomo.title} (${tomo.quantity})`).join(", ")}.
                Confira se essa divisão é intencional antes de gerar a LD final.
              </p>
            </div>
          </div>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Quantidade de tomos</legend>
        <div className="flex flex-wrap gap-2">
          {tomoCountOptions.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onTomoCountChange(count)}
              className={`h-10 min-w-10 rounded-md border px-3 text-sm font-medium transition ${
                tomos.length === count
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3">
        {tomos.map((tomo, index) => (
          <div key={tomo.id} className="grid items-end gap-3 border border-border bg-background p-4 md:grid-cols-[1fr_140px_180px]">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tomo</p>
              <p className="mt-2 font-medium">{tomo.title}</p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Pranchas</span>
              <input
                type="number"
                min={1}
                max={totalSheets - (tomos.length - index - 1)}
                value={tomo.quantity}
                onChange={(event) => onQuantityChange(index, Number(event.target.value) || 1)}
                disabled={index === tomos.length - 1}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm disabled:bg-muted disabled:text-muted-foreground"
              />
            </label>
            <div>
              <p className="text-sm font-medium">Intervalo</p>
              <p className="mt-1 flex h-10 items-center rounded-md border border-border bg-muted px-3 font-mono text-sm">
                {tomo.start} a {tomo.end}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryStep({
  data,
  totalRows,
  tomoCount,
  tomos,
  reviewedWarnings,
  warningCount,
  blockingCount,
  missingSheets,
  files,
}: {
  data: LdData;
  totalRows: number;
  tomoCount: number;
  tomos: Tomo[];
  reviewedWarnings: number;
  warningCount: number;
  blockingCount: number;
  missingSheets: number[];
  files: string[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SummaryGroup
        title="Dados manuais"
        items={[
          ["Código do projeto", data.projectCode],
          ["Código formatado", data.formattedCode],
          ["Disciplina", data.discipline],
          ["Revisão", data.revision],
          ["Título da seção", data.sectionTitle],
          ["Órgão/cliente", data.client],
          ["Nome da obra", data.workName],
          ["Fase", data.phase],
        ]}
      />
      <SummaryGroup
        title="Geração"
        items={[
          ["Total de pranchas", String(totalRows)],
          ["Quantidade de tomos", String(tomoCount)],
          ["Alertas revisados", `${reviewedWarnings}/${warningCount}`],
          ["Erros bloqueantes", String(blockingCount)],
          ["Folhas faltantes", missingSheets.length ? missingSheets.join(", ") : "Nenhuma"],
          ["Template", data.templateMode === "padrao" ? "Padrão interno" : "Alternativo anexado"],
        ]}
      />
      <div className="lg:col-span-2">
        <h3 className="mb-3 font-semibold">Mapa dos tomos</h3>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {tomos.map((tomo) => (
            <div
              key={tomo.id}
              className={`rounded-md border bg-background p-3 ${
                tomo.quantity > 15 ? "border-warning" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{tomo.title}</p>
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                  {tomo.quantity} pranchas
                </span>
              </div>
              <p className="mt-2 font-mono text-sm text-muted-foreground">
                {tomo.start} a {tomo.end}
              </p>
              {tomo.quantity > 15 ? (
                <p className="mt-2 text-xs text-[var(--status-warning)]">
                  Acima da recomendação de 15 pranchas.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        <h3 className="mb-3 font-semibold">Arquivos previstos</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <div key={file} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              <FileText size={16} className="text-primary" />
              {file}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryGroup({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <dl className="divide-y divide-border border border-border bg-background">
        {items.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-3 py-2 sm:grid-cols-[170px_1fr]">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FinalStep({
  files,
  downloads,
  coverGeneratorHref,
  generating,
  error,
  checklistItems,
  checkedItems,
  onChecklistChange,
  onGenerate,
}: {
  files: string[];
  downloads: GeneratedDownload[];
  coverGeneratorHref: string;
  generating: boolean;
  error: string;
  checklistItems: string[];
  checkedItems: string[];
  onChecklistChange: (items: string[]) => void;
  onGenerate: () => void;
}) {
  const generatedNames = new Set(downloads.map((download) => download.fileName));
  const checklistComplete = checklistItems.every((item) => checkedItems.includes(item));
  const toggleChecklistItem = (item: string, checked: boolean) => {
    onChecklistChange(
      checked
        ? [...new Set([...checkedItems, item])]
        : checkedItems.filter((current) => current !== item),
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-background p-3">
          <h3 className="text-sm font-semibold">Checklist antes de gerar</h3>
          <div className="mt-3 space-y-2">
            {checklistItems.map((item) => (
              <label key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={checkedItems.includes(item)}
                  onChange={(event) => toggleChecklistItem(item, event.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !checklistComplete}
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-3 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          Gerar arquivos finais
        </button>
        {error && <p className="rounded-md border border-destructive bg-background p-3 text-sm text-destructive">{error}</p>}
        <Link
          href={coverGeneratorHref}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-sm font-medium text-[var(--nexodoc-accent)] transition hover:border-primary hover:bg-primary/15"
        >
          <FileArchive size={16} />
          Gerar capas desta LD
        </Link>
        {downloads.map((download) => (
          <a
            key={download.fileName}
            href={download.url}
            download={download.fileName}
            className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-3 text-left text-sm transition hover:bg-muted"
          >
            <span className="flex min-w-0 items-center gap-2">
              {download.kind === "zip" ? <FileArchive size={16} /> : <Download size={16} />}
              <span className="truncate font-mono">{download.fileName}</span>
            </span>
            Baixar
          </a>
        ))}
        {files
          .filter((file) => !generatedNames.has(file))
          .map((file) => (
            <button
              key={file}
              type="button"
              disabled
              className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-3 text-left text-sm opacity-70"
            >
              <span className="flex min-w-0 items-center gap-2">
                {file.endsWith(".zip") ? <FileArchive size={16} /> : <Download size={16} />}
                <span className="truncate font-mono">{file}</span>
              </span>
              Aguardando geração
            </button>
          ))}
      </div>
      <div>
        <h3 className="mb-3 font-semibold">Checklist final</h3>
        <div className="grid gap-2">
          {checklist.map((item) => (
            <label key={item} className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4" />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
