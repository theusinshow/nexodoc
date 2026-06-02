import type {
  PageAssetRole,
  PageClassification,
  PageClassificationSource,
} from "./volume-types";

const DISCIPLINES: Record<string, string> = {
  ARQ: "Arquitetonico",
  EST: "Estrutural",
  ELE: "Eletrico",
  HID: "Hidrossanitario",
  SAN: "Sanitario",
  PCI: "Preventivo contra incendio",
  DRE: "Drenagem",
  TER: "Terraplenagem",
  GEO: "Geotecnico",
};

const ROLE_PATTERNS: Array<{ role: PageAssetRole; patterns: RegExp[] }> = [
  { role: "cover", patterns: [/\bcapa\b/i, /\bcover\b/i] },
  {
    role: "ld",
    patterns: [/\bld\b/i, /\blista\s+de\s+documentos\b/i, /\blista\s+de\s+desenhos\b/i],
  },
  { role: "separator", patterns: [/\bseparatriz\b/i, /\bseparador\b/i] },
  { role: "appendix", patterns: [/\banexo\b/i, /\bappendix\b/i] },
];

export function classifyPageAsset(input: {
  fileName: string;
  pageNumber: number;
  currentRole?: PageAssetRole;
  summary?: string;
  previous?: PageClassification;
}): PageClassification {
  const fileText = normalize(input.fileName);
  const pageText = normalize(input.summary ?? "");
  const combinedText = `${fileText} ${pageText}`.trim();
  const warnings: string[] = [];
  let confidence = 0.34;
  let source: PageClassificationSource = input.summary ? "filename+pdf-text" : "filename";

  const roleFromText = inferRole(combinedText);
  const role = roleFromText ?? input.currentRole ?? input.previous?.role ?? "unknown";
  if (roleFromText) {
    confidence += 0.18;
  } else if (input.currentRole) {
    confidence += 0.1;
  }

  const disciplineCode = inferDiscipline(combinedText) ?? input.previous?.disciplineCode;
  if (disciplineCode) {
    confidence += 0.14;
  }

  const blockCode = inferBlock(combinedText) ?? input.previous?.blockCode;
  if (blockCode) {
    confidence += 0.14;
  }

  const documentCode = inferDocumentCode(combinedText, disciplineCode, blockCode);
  if (documentCode) {
    confidence += 0.16;
  }

  const sheetNumber = inferSheetNumber(combinedText, documentCode) ?? String(input.pageNumber).padStart(2, "0");
  const revision = inferRevision(combinedText) ?? input.previous?.revision;
  if (revision) {
    confidence += 0.05;
  }

  const volumeHint = inferVolume(combinedText) ?? input.previous?.volumeHint;
  const projectCode = inferProjectCode(combinedText) ?? input.previous?.projectCode;
  const title = inferTitle(input.summary);

  if (!disciplineCode && role === "document") {
    warnings.push("Disciplina nao identificada.");
  }

  if (!blockCode && combinedText.includes("bl")) {
    warnings.push("Possivel bloco nao identificado com seguranca.");
  }

  if (!documentCode && role === "document") {
    warnings.push("Codigo da prancha nao identificado.");
  }

  if (!input.summary) {
    warnings.push("Classificacao inicial baseada apenas no nome do arquivo.");
  }

  if (warnings.length > 0) {
    confidence -= Math.min(0.18, warnings.length * 0.05);
  }

  return {
    role,
    disciplineCode,
    disciplineName: disciplineCode ? DISCIPLINES[disciplineCode] ?? disciplineCode : undefined,
    blockCode,
    documentCode,
    sheetNumber,
    title,
    revision,
    volumeHint,
    projectCode,
    confidence: clampConfidence(confidence),
    source,
    warnings,
  };
}

export function getClassificationKey(classification?: PageClassification) {
  return [
    classification?.disciplineCode ?? "GERAL",
    classification?.blockCode ?? "SEM_BLOCO",
  ].join(":");
}

function inferRole(text: string): PageAssetRole | undefined {
  for (const option of ROLE_PATTERNS) {
    if (option.patterns.some((pattern) => pattern.test(text))) {
      return option.role;
    }
  }

  return undefined;
}

function inferDiscipline(text: string) {
  const explicit = text.match(/\b(ARQ|EST|ELE|HID|SAN|PCI|DRE|TER|GEO)\b/i)?.[1];
  if (explicit) {
    return explicit.toUpperCase();
  }

  if (/\bestrutur|concreto|fundacao|forma\b/i.test(text)) {
    return "EST";
  }

  if (/\barquitet|layout|planta\s+baixa\b/i.test(text)) {
    return "ARQ";
  }

  if (/\beletric|iluminacao|energia\b/i.test(text)) {
    return "ELE";
  }

  if (/\bhidrossanit|sanitari|agua\s+fria|esgoto\b/i.test(text)) {
    return "HID";
  }

  return undefined;
}

function inferBlock(text: string) {
  const blockPatterns = [
    /\bbl(?:oco)?[._\-\s]*([a-z0-9]{1,4})\b/i,
    /\bbloco\s+([a-z0-9]{1,4})\b/i,
    /\btorre\s+([a-z0-9]{1,4})\b/i,
    /\bsetor\s+([a-z0-9]{1,4})\b/i,
  ];

  for (const pattern of blockPatterns) {
    const value = text.match(pattern)?.[1];
    if (value) {
      return value.toUpperCase();
    }
  }

  return undefined;
}

function inferDocumentCode(text: string, disciplineCode?: string, blockCode?: string) {
  const compact = text.replace(/\s+/g, "_");
  const prefixed = compact.match(/\b([A-Z]{2,4}[_\-.]?(?:BL|BLOCO)?[_\-.]?[A-Z0-9]{1,4}[_\-.]?\d{1,4}[A-Z]?)\b/i)?.[1];
  if (prefixed) {
    return normalizeCode(prefixed);
  }

  if (disciplineCode && blockCode) {
    const numbered = compact.match(/\b(\d{1,4}[A-Z]?)\b/i)?.[1];
    if (numbered) {
      return `${disciplineCode}-BL-${blockCode}-${numbered.padStart(2, "0")}`;
    }
  }

  return undefined;
}

function inferSheetNumber(text: string, documentCode?: string) {
  const fromDocument = documentCode?.match(/(\d{1,4}[A-Z]?)$/i)?.[1];
  if (fromDocument) {
    return fromDocument;
  }

  return text.match(/\b(?:prancha|folha|pag(?:ina)?)\s*[:\-]?\s*(\d{1,4}[A-Z]?)\b/i)?.[1];
}

function inferRevision(text: string) {
  return text.match(/\b(?:rev(?:isao)?\.?|r)\s*[:_\-\s]*([A-Z0-9]{1,3})\b/i)?.[1]?.toUpperCase();
}

function inferVolume(text: string) {
  return text.match(/\b(?:vol(?:ume)?|tomo)\s*[:_\-\s]*([A-Z0-9]{1,4})\b/i)?.[1]?.toUpperCase();
}

function inferProjectCode(text: string) {
  return text.match(/\b(\d{2,4}[_\-/]\d{2})\b/)?.[1]?.replace("/", "_");
}

function inferTitle(summary?: string) {
  if (!summary) {
    return undefined;
  }

  const cleaned = summary.replace(/\s+/g, " ").trim();
  return cleaned.length > 8 ? cleaned.slice(0, 96) : undefined;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[Pp][Dd][Ff]$/, "")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: string) {
  return value
    .replace(/[_.]+/g, "-")
    .replace(/--+/g, "-")
    .toUpperCase();
}

function clampConfidence(value: number) {
  return Math.max(0.05, Math.min(0.98, Number(value.toFixed(2))));
}
