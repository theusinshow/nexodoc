import type { AuditFinding } from "@/lib/audit-report";
import type { ExtractedPdf } from "@/lib/pdf-text";

export type CrossDocumentSource = {
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
};

type IdentifiedValue = {
  label: string;
  value: string;
  fileName: string;
  fileType: string;
  page: number;
  evidence: string;
};

type ComparisonField = {
  label: string;
  type: string;
  pattern: RegExp;
  priority: AuditFinding["prioridade"];
};

const COMPARISON_FIELDS: ComparisonField[] = [
  {
    label: "município/proprietário",
    type: "Município/proprietário divergente entre documentos",
    pattern: /(?:munic[ií]pio|prefeitura\s+municipal)\s*(?:de|:)?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,45})(?=[,;.\n]|$)/gi,
    priority: "Alta",
  },
  {
    label: "código do projeto",
    type: "Código do projeto divergente entre documentos",
    pattern: /(?:c[oó]digo(?:\s+do\s+projeto)?|projeto)\s*[:#-]\s*([A-Z0-9][A-Z0-9./_-]{2,30})/gi,
    priority: "Alta",
  },
  {
    label: "nome da obra",
    type: "Nome da obra divergente entre documentos",
    pattern: /(?:obra|unidade)\s*:\s*([^\n;]{4,80})/gi,
    priority: "Alta",
  },
  {
    label: "endereço",
    type: "Endereço divergente entre documentos",
    pattern: /(?:endere[cç]o|logradouro)\s*:\s*([^\n;]{4,100})/gi,
    priority: "Alta",
  },
  {
    label: "revisão",
    type: "Revisão divergente entre documentos",
    pattern: /(?:revis[aã]o|rev\.)\s*[:#-]?\s*(R?\d{1,3}|[A-Z]\d{0,2})\b/gi,
    priority: "Media/Alta",
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractEvidence(text: string, index: number) {
  return text
    .slice(Math.max(0, index - 45), Math.min(text.length, index + 135))
    .replace(/\s+/g, " ")
    .trim();
}

function sourceRank(source: CrossDocumentSource) {
  const ranks: Record<string, number> = {
    capa: 0,
    memorial: 1,
    ld: 2,
    separatriz: 3,
    pranchas: 4,
    outro: 5,
  };

  return ranks[source.fileType.toLowerCase()] ?? 6;
}

function identifyValues(source: CrossDocumentSource, field: ComparisonField) {
  const values: IdentifiedValue[] = [];

  for (const page of source.extracted.pages) {
    field.pattern.lastIndex = 0;

    for (const match of page.text.matchAll(field.pattern)) {
      const value = match[1]?.replace(/\s+/g, " ").trim();

      if (!value) {
        continue;
      }

      values.push({
        label: field.label,
        value,
        fileName: source.fileName,
        fileType: source.fileType,
        page: page.page,
        evidence: extractEvidence(page.text, match.index ?? 0),
      });
    }
  }

  return values;
}

function uniqueByFileAndValue(values: IdentifiedValue[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.fileName}|${normalize(value.value)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function runCrossDocumentRules(sources: CrossDocumentSource[]) {
  if (sources.length < 2) {
    return {
      findings: [] as AuditFinding[],
      comparisons: ["Auditoria realizada em arquivo único; não há documentos distintos para confronto."],
    };
  }

  const orderedSources = [...sources].sort((a, b) => sourceRank(a) - sourceRank(b));
  const findings: AuditFinding[] = [];
  const comparisons: string[] = [];

  for (const field of COMPARISON_FIELDS) {
    const identified = uniqueByFileAndValue(
      orderedSources.flatMap((source) => identifyValues(source, field)),
    );
    const representedFiles = new Set(identified.map((item) => item.fileName));

    if (representedFiles.size < 2) {
      continue;
    }

    const values = new Map<string, IdentifiedValue[]>();

    for (const value of identified) {
      const key = normalize(value.value);
      values.set(key, [...(values.get(key) ?? []), value]);
    }

    if (values.size === 1) {
      comparisons.push(
        `${field.label}: valor compatível entre ${[...representedFiles].join(" e ")}.`,
      );
      continue;
    }

    const baseline = identified[0];
    const conflicting = identified.filter(
      (item) => normalize(item.value) !== normalize(baseline.value),
    );
    comparisons.push(
      `${field.label}: divergência entre ${identified.map((item) => `${item.fileName} (${item.value})`).join(" x ")}.`,
    );

    for (const item of conflicting) {
      findings.push({
        id: `CROSS-${String(findings.length + 1).padStart(3, "0")}`,
        arquivo: item.fileName,
        origem: "regra",
        prioridade: field.priority,
        pagina: String(item.page),
        capitulo: "Comparação entre documentos",
        categoria: field.label,
        referencia_comparada: `${baseline.fileName}: ${baseline.value}`,
        local: field.label,
        tipo: field.type,
        descricao: `${item.fileName} informa "${item.value}", enquanto ${baseline.fileName} informa "${baseline.value}".`,
        evidencia: item.evidence,
        termo_busca: item.value.slice(0, 160),
        conflito: `${item.fileName}: ${item.value} x ${baseline.fileName}: ${baseline.value}.`,
        sugestao_correcao: `Conferir o ${field.label} correto e padronizar os documentos antes da emissão.`,
        confianca: "alta",
      });
    }
  }

  if (comparisons.length === 0) {
    comparisons.push(
      `Documentos confrontados: ${orderedSources.map((source) => `${source.fileType} (${source.fileName})`).join(" x ")}; não foram extraídos campos comuns suficientes para regra automática.`,
    );
  }

  return { findings, comparisons };
}
