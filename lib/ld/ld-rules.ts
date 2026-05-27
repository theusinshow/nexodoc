export type ReviewRow = {
  id: number;
  sheet: string;
  file: string;
  description: string;
  readDiscipline: string;
  lowConfidence: boolean;
  reviewedAlertKeys: string[];
};

export type Tomo = {
  id: number;
  title: string;
  start: string;
  end: string;
  quantity: number;
};

export type ParsedSheet = {
  number: number;
  total: number;
};

export type RowIssue = {
  key: string;
  label: string;
  severity: "blocker" | "warning";
};

export type GlobalWarning = {
  key: string;
  label: string;
};

export type ValidationResult = {
  rowIssues: Record<number, RowIssue[]>;
  blockingIssues: string[];
  globalWarnings: GlobalWarning[];
  totals: number[];
  missingSheets: number[];
};

export function parseSheet(value: string): ParsedSheet | null {
  const match = value.trim().match(/(\d+)\s*\/\s*(\d+)/);

  if (!match) {
    return null;
  }

  return {
    number: Number(match[1]),
    total: Number(match[2]),
  };
}

export function formatSheet(number: number, total: number) {
  const width = Math.max(2, String(total).length);
  return `${String(number).padStart(width, "0")}/${String(total).padStart(width, "0")}`;
}

export function buildBalancedQuantities(total: number, count: number) {
  const safeCount = Math.max(1, Math.min(count, total));
  const base = Math.floor(total / safeCount);
  const remainder = total % safeCount;

  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function buildTomosFromQuantities(total: number, quantities: number[]) {
  let nextSheet = 1;

  return quantities.map((quantity, index) => {
    const endSheet = nextSheet + quantity - 1;
    const tomo = {
      id: index + 1,
      title: `TOMO ${index + 1}`,
      start: formatSheet(nextSheet, total),
      end: formatSheet(endSheet, total),
      quantity,
    };

    nextSheet = endSheet + 1;

    return tomo;
  });
}

export function buildBalancedTomos(total: number, count: number) {
  return buildTomosFromQuantities(total, buildBalancedQuantities(total, count));
}

export function updateTomoQuantity(
  tomos: Tomo[],
  total: number,
  index: number,
  requestedQuantity: number,
) {
  const minimumRemaining = tomos.length - index - 1;
  const usedBefore = tomos.slice(0, index).reduce((sum, tomo) => sum + tomo.quantity, 0);
  const maximum = total - usedBefore - minimumRemaining;
  const quantity = Math.max(1, Math.min(requestedQuantity, maximum));
  const remaining = total - usedBefore - quantity;
  const laterQuantities = minimumRemaining > 0
    ? buildBalancedQuantities(remaining, minimumRemaining)
    : [];
  const quantities = [
    ...tomos.slice(0, index).map((tomo) => tomo.quantity),
    quantity,
    ...laterQuantities,
  ];

  return buildTomosFromQuantities(total, quantities);
}

export function compareBySheet(a: ReviewRow, b: ReviewRow) {
  const parsedA = parseSheet(a.sheet);
  const parsedB = parseSheet(b.sheet);

  if (parsedA && parsedB) {
    return parsedA.number - parsedB.number;
  }

  if (parsedA) {
    return -1;
  }

  if (parsedB) {
    return 1;
  }

  return a.sheet.localeCompare(b.sheet, "pt-BR");
}

export function validateRows(
  rows: ReviewRow[],
  discipline: string,
  referenceTotal: number | null,
): ValidationResult {
  const rowIssues: Record<number, RowIssue[]> = {};
  const blockingIssues: string[] = [];
  const sheetOccurrences = new Map<number, number[]>();
  const totals = new Set<number>();
  const parsedRows = rows
    .map((row) => ({ row, parsed: parseSheet(row.sheet) }))
    .filter((item): item is { row: ReviewRow; parsed: ParsedSheet } => Boolean(item.parsed));

  for (const { row, parsed } of parsedRows) {
    totals.add(parsed.total);
    sheetOccurrences.set(parsed.number, [...(sheetOccurrences.get(parsed.number) ?? []), row.id]);
  }

  for (const row of rows) {
    const issues: RowIssue[] = [];
    const parsed = parseSheet(row.sheet);
    const normalizedDiscipline = discipline.trim().toLocaleLowerCase("pt-BR");
    const normalizedReadDiscipline = row.readDiscipline.trim().toLocaleLowerCase("pt-BR");

    if (!row.file.trim()) {
      issues.push({
        key: "empty-file",
        label: "Erro: ARQUIVOS vazio",
        severity: "blocker",
      });
      blockingIssues.push(`Linha ${row.id}: ARQUIVOS vazio.`);
    }

    if (!row.description.trim()) {
      issues.push({
        key: "empty-description",
        label: "Erro: DESCRIÇÃO vazia",
        severity: "blocker",
      });
      blockingIssues.push(`Linha ${row.id}: DESCRIÇÃO vazia.`);
    }

    if (parsed && (sheetOccurrences.get(parsed.number)?.length ?? 0) > 1) {
      issues.push({
        key: `duplicate-${parsed.number}`,
        label: `Erro: folha ${formatSheet(parsed.number, parsed.total)} duplicada`,
        severity: "blocker",
      });
      blockingIssues.push(`Folha ${formatSheet(parsed.number, parsed.total)} duplicada.`);
    }

    if (
      normalizedDiscipline &&
      normalizedReadDiscipline &&
      normalizedDiscipline !== normalizedReadDiscipline
    ) {
      issues.push({
        key: `discipline-${row.readDiscipline}`,
        label: `Alerta: disciplina lida ${row.readDiscipline.toUpperCase()}`,
        severity: "warning",
      });
    }

    if (row.lowConfidence) {
      issues.push({
        key: "low-confidence",
        label: "Alerta: leitura com baixa confiança",
        severity: "warning",
      });
    }

    if (parsed && referenceTotal && parsed.total !== referenceTotal) {
      issues.push({
        key: `total-${parsed.total}`,
        label: `Alerta: total ${parsed.total}, referência ${referenceTotal}`,
        severity: "warning",
      });
    }

    rowIssues[row.id] = issues;
  }

  const totalReference = referenceTotal ?? (totals.size === 1 ? [...totals][0] : null);
  const existingNumbers = new Set(parsedRows.map(({ parsed }) => parsed.number));
  const missingSheets =
    totalReference && totalReference > 0
      ? Array.from({ length: totalReference }, (_, index) => index + 1).filter(
          (number) => !existingNumbers.has(number),
        )
      : [];

  const globalWarnings: GlobalWarning[] =
    missingSheets.length > 0 && totalReference
      ? [
          {
            key: "missing-sheets",
            label: `Folhas não localizadas: ${missingSheets
              .map((number) => formatSheet(number, totalReference))
              .join(", ")}.`,
          },
        ]
      : [];

  if (totals.size > 1) {
    globalWarnings.unshift({
      key: "total-reference",
      label: "Há totais diferentes na tabela. Defina o total de referência para validar as folhas.",
    });
  }

  return {
    rowIssues,
    blockingIssues: [...new Set(blockingIssues)],
    globalWarnings,
    totals: [...totals].sort((a, b) => a - b),
    missingSheets,
  };
}
