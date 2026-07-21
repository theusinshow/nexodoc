/**
 * Ferramenta headless do Nexo (Fase 0) — gera uma Lista de Documentos (LD).
 *
 * Função pura de servidor, chamada diretamente pelo futuro agente de orquestração,
 * SEM HTTP. Valida as linhas de forma determinística, monta o payload de geração,
 * produz o ODT (e opcionalmente o PDF via LibreOffice/Render) e o relatório de
 * inconsistências em Markdown. Retorna Buffers crus (não base64).
 */

import {
  buildBaseFileName,
  buildInconsistencyReport,
  buildOdtFileName,
  generateOdtBuffer,
  type GeneratePayload,
  type InconsistencyPayload,
  type LdData,
  type ReviewRow,
  type Tomo,
} from "@/lib/ld/ld-generation";
import { validateRows, type ReviewRow as RulesReviewRow } from "@/lib/ld/ld-rules";
import { convertOdtToPdf } from "@/server/pdf";

export interface CreateLDInput {
  ldData: LdData;
  rows: ReviewRow[];
  tomos?: Tomo[];
  referenceTotal?: number | null;
  templateBase64?: string | null;
  includePdf?: boolean; // default true
  enforceValidation?: boolean; // default true — recusa se houver blockingIssues
}

export interface GeneratedFile {
  name: string;
  buffer: Buffer;
}

export interface CreateLDOutput {
  ok: boolean;
  blockingIssues: string[];
  warnings: string[];
  files: {
    odt: GeneratedFile;
    pdf: GeneratedFile | null;
    report: { name: string; markdown: string } | null;
  } | null;
}

/**
 * `validateRows` (lib/ld/ld-rules.ts) espera o `ReviewRow` daquele módulo, que exige
 * `id` e os campos `readDiscipline`/`lowConfidence`/`reviewedAlertKeys` obrigatórios.
 * O `ReviewRow` de `lib/ld/ld-generation.ts` (usado no input público) tem esses campos
 * opcionais e não tem `id`. Aqui normalizamos o input para o formato de validação,
 * atribuindo `id` estável por índice e defaults seguros.
 */
function toValidationRows(rows: ReviewRow[]): RulesReviewRow[] {
  return rows.map((row, index) => ({
    id: index + 1,
    sheet: row.sheet,
    file: row.file,
    description: row.description,
    readDiscipline: row.readDiscipline ?? "",
    lowConfidence: row.lowConfidence ?? false,
    reviewedAlertKeys: row.reviewedAlertKeys ?? [],
  }));
}

export async function createLD(input: CreateLDInput): Promise<CreateLDOutput> {
  const referenceTotal = input.referenceTotal ?? null;
  const validationRows = toValidationRows(input.rows);
  const validation = validateRows(validationRows, input.ldData.discipline, referenceTotal);

  const warnings = validation.globalWarnings.map((warning) => warning.label);
  const blockingIssues = validation.blockingIssues;

  const enforceValidation = input.enforceValidation !== false;
  if (enforceValidation && blockingIssues.length > 0) {
    return { ok: false, blockingIssues, warnings, files: null };
  }

  // Mapeia ValidationResult -> InconsistencyPayload (mesma lógica de
  // buildInconsistencyPayload em components/ld/ld-workspace.tsx).
  const inconsistencies: InconsistencyPayload = {
    missingSheets: validation.missingSheets,
    globalWarnings: validation.globalWarnings.map((warning) => warning.label),
    rowWarnings: validationRows
      .map((row) => {
        const rowWarns = (validation.rowIssues[row.id] ?? []).filter(
          (issue) => issue.severity === "warning",
        );

        return {
          sheet: row.sheet,
          file: row.file,
          warnings: rowWarns.map((warning) => warning.label),
          reviewed:
            rowWarns.length > 0 &&
            rowWarns.every((warning) => row.reviewedAlertKeys.includes(warning.key)),
        };
      })
      .filter((row) => row.warnings.length > 0),
  };

  const payload: GeneratePayload = {
    ldData: input.ldData,
    rows: input.rows,
    tomos: input.tomos ?? [],
    templateBase64: input.templateBase64 ?? null,
    inconsistencies,
  };

  const odtBuffer = await generateOdtBuffer(payload);
  const baseName = buildBaseFileName(input.ldData);

  const odt: GeneratedFile = {
    name: buildOdtFileName(input.ldData),
    buffer: odtBuffer,
  };

  let pdf: GeneratedFile | null = null;
  if (input.includePdf !== false) {
    const { pdfBuffer } = await convertOdtToPdf(odtBuffer);
    if (pdfBuffer) {
      pdf = { name: `${baseName}.pdf`, buffer: pdfBuffer };
    }
  }

  const markdown = buildInconsistencyReport(payload);
  const report =
    markdown.length > 0 ? { name: `${baseName}_inconsistencias.md`, markdown } : null;

  return {
    ok: true,
    blockingIssues,
    warnings,
    files: { odt, pdf, report },
  };
}
