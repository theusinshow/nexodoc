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

/**
 * A divisão em tomos que o escritório usa: ~12 pranchas por tomo, nunca menos de
 * 9, nunca mais de 15, e o mais parelho possível.
 *
 * O número de tomos era sempre 1 até alguém digitar outro, e num projeto de 71
 * pranchas isso significa um volume único impossível de encadernar. A conta é
 * simples e ninguém deveria ter de fazê-la de cabeça toda vez.
 *
 * A busca é exaustiva sobre o número de tomos porque o espaço é minúsculo (no
 * máximo `total` candidatos) e a regra é mais fácil de conferir assim do que
 * numa fórmula fechada. Ganha quem fica mais perto de `ALVO`; empatou, ganha o
 * mais parelho; empatou de novo, ganha o de menos tomos — menos volumes é menos
 * capa, menos separatriz e menos encadernação.
 */
export const TOMO_ALVO = 12;
export const TOMO_MINIMO = 9;
export const TOMO_MAXIMO = 15;

export function sugerirNumeroDeTomos(totalDeFolhas: number): number {
  const total = Math.max(0, Math.trunc(totalDeFolhas));
  // Cabe num tomo só: não há divisão a sugerir, mesmo abaixo do mínimo — um
  // projeto de 5 pranchas é um tomo de 5, não meio tomo.
  if (total <= TOMO_MAXIMO) return 1;

  let melhor = 0;
  let melhorNota: [number, number, number] | null = null;
  for (let tomos = 1; tomos <= total; tomos++) {
    const baldes = buildBalancedQuantities(total, tomos);
    const menor = Math.min(...baldes);
    const maior = Math.max(...baldes);
    if (menor < TOMO_MINIMO || maior > TOMO_MAXIMO) continue;
    const nota: [number, number, number] = [
      Math.abs(total / tomos - TOMO_ALVO), // perto do alvo
      maior - menor, // parelho
      tomos, // menos volumes
    ];
    // Comparação campo a campo. `nota < melhorNota` em array compara STRING em
    // JavaScript ("10" < "9"), e o desempate sairia trocado sem avisar.
    const ganha =
      !melhorNota ||
      nota[0] < melhorNota[0] - 1e-9 ||
      (Math.abs(nota[0] - melhorNota[0]) < 1e-9 &&
        (nota[1] < melhorNota[1] ||
          (nota[1] === melhorNota[1] && nota[2] < melhorNota[2])));
    if (ganha) {
      melhorNota = nota;
      melhor = tomos;
    }
  }
  if (melhor > 0) return melhor;

  /*
   * Nenhuma divisão respeita os dois limites — acontece logo acima do máximo
   * (16 folhas: 1 tomo estoura 15, 2 tomos dão 8 e 8, abaixo do mínimo). Aí
   * vale o MÁXIMO, que é limite de encadernação: um tomo magro se encaderna, um
   * tomo gordo demais não fecha.
   */
  return Math.ceil(total / TOMO_MAXIMO);
}

/**
 * Faixas de folhas (1-based, inclusivas) de cada tomo.
 *
 * Cada tomo é um VOLUME FÍSICO com a sua fatia: a LD e o volume do tomo 1 levam
 * as folhas 1-12, os do tomo 2 levam 13-24. Antes o número de tomos só virava
 * seções dentro de um documento só, e o escritório recebia um PDF que precisava
 * ser fatiado à mão.
 *
 * Deriva de `buildBalancedQuantities` — o mesmo balanceamento que a LD já usa —
 * em vez de recalcular: dois algoritmos de divisão divergiriam com o tempo, e a
 * divergência apareceria como folha repetida ou folha sumida.
 */
export function faixasDosTomos(
  total: number,
  count: number,
): { inicio: number; fim: number }[] {
  if (total <= 0) return [];

  let cursor = 1;
  return buildBalancedQuantities(total, count).map((quantity) => {
    const faixa = { inicio: cursor, fim: cursor + quantity - 1 };
    cursor = faixa.fim + 1;
    return faixa;
  });
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

const invalidDisciplineLabels = new Set([
  "imp",
  "data",
  "escala",
  "rev",
  "revisao",
  "visto",
  "desenho",
  "folha",
  "prancha",
  "arquivo",
  "conteudo",
  "descricao",
]);

function normalizeDisciplineForComparison(value: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  return invalidDisciplineLabels.has(normalized) ? "" : normalized;
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
    const normalizedDiscipline = normalizeDisciplineForComparison(discipline);
    const normalizedReadDiscipline = normalizeDisciplineForComparison(row.readDiscipline);

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
