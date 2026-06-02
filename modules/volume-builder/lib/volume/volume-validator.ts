import type {
  AssemblyRow,
  VolumeStatus,
  ImportedPdfFile,
  BatchAnalysisResult,
} from "./volume-types";
import { validateRow, validateBatch, validatePageSelection } from "./volume-rules";

export function validateAssemblyRow(
  row: AssemblyRow,
  importedFiles?: ImportedPdfFile[]
): {
  status: VolumeStatus;
  warnings: string[];
  problems: string[];
} {
  const { warnings, problems } = validateRow(row);

  if (importedFiles) {
    if (row.cover?.selection) {
      const coverWarnings = validatePageSelection(
        row.cover.selection,
        importedFiles
      );
      warnings.push(...coverWarnings);
    }

    for (const block of row.blocks) {
      if (block.ld?.selection) {
        const ldWarnings = validatePageSelection(
          block.ld.selection,
          importedFiles
        );
        warnings.push(...ldWarnings);
      }

      for (const doc of block.documents) {
        if (doc.selection) {
          const docWarnings = validatePageSelection(doc.selection, importedFiles);
          warnings.push(...docWarnings);
        }
      }

      if (block.appendices) {
        for (const appendix of block.appendices) {
          if (appendix.selection) {
            const appendixWarnings = validatePageSelection(
              appendix.selection,
              importedFiles
            );
            warnings.push(...appendixWarnings);
          }
        }
      }
    }
  }

  const status: VolumeStatus =
    problems.length > 0
      ? "problema_de_montagem"
      : warnings.length > 0
        ? "ponto_de_atencao"
        : "sem_problemas";

  return { status, warnings, problems };
}

export function validateBatchAssembly(
  rows: AssemblyRow[],
  importedFiles?: ImportedPdfFile[]
): {
  status: VolumeStatus;
  warnings: string[];
  problems: string[];
} {
  const batchResult = validateBatch(rows);

  const rowResults = rows.map((row) => validateAssemblyRow(row, importedFiles));

  const allWarnings = [
    ...batchResult.warnings,
    ...rowResults.flatMap((r) => r.warnings),
  ];

  const allProblems = [
    ...batchResult.problems,
    ...rowResults.flatMap((r) => r.problems),
  ];

  const status: VolumeStatus =
    allProblems.length > 0
      ? "problema_de_montagem"
      : allWarnings.length > 0
        ? "ponto_de_atencao"
        : "sem_problemas";

  return { status, warnings: allWarnings, problems: allProblems };
}

export function analyzeBatch(
  rows: AssemblyRow[],
  importedFiles?: ImportedPdfFile[]
): BatchAnalysisResult {
  const { status, warnings, problems } = validateBatchAssembly(
    rows,
    importedFiles
  );

  const rowWarnings = rows.map((row) => {
    const result = validateAssemblyRow(row, importedFiles);
    return {
      rowId: row.id,
      rowTitle: row.title,
      warnings: result.warnings,
      problems: result.problems,
    };
  });

  const summary =
    status === "sem_problemas"
      ? "Nenhum problema encontrado na montagem."
      : status === "ponto_de_atencao"
        ? `Encontrados ${warnings.length} ponto(s) de atencao.`
        : `Encontrados ${problems.length} problema(s) de montagem.`;

  const requiresManualConfirmation = status === "problema_de_montagem";

  return {
    status,
    summary,
    batchWarnings: warnings,
    rowWarnings,
    requiresManualConfirmation,
  };
}
