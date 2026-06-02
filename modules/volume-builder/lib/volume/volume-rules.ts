import type {
  AssemblyRow,
  AssemblyBlock,
  PageSelection,
  ImportedPdfFile,
} from "./volume-types";

export function validateBlock(block: AssemblyBlock): string[] {
  const warnings: string[] = [];

  if (!block.title || block.title.trim() === "") {
    warnings.push("Titulo do grupo vazio.");
  }

  if (!block.separatorTitle || block.separatorTitle.trim() === "") {
    warnings.push("Separatriz sem titulo.");
  }

  if (block.documents.length === 0) {
    warnings.push("Grupo sem documentos.");
  }

  return warnings;
}

export function validateRow(row: AssemblyRow): {
  warnings: string[];
  problems: string[];
} {
  const warnings: string[] = [];
  const problems: string[] = [];

  if (!row.cover) {
    warnings.push("Capa ausente na linha.");
  }

  if (row.blocks.length === 0) {
    problems.push("Nenhum grupo documental na linha.");
  } else {
    for (const block of row.blocks) {
      const blockWarnings = validateBlock(block);
      problems.push(...blockWarnings);
    }
  }

  if (!row.outputFileName || row.outputFileName.trim() === "") {
    problems.push("Nome final do PDF vazio.");
  } else {
    const fileNameWarnings = validateOutputFileName(row.outputFileName);
    warnings.push(...fileNameWarnings);
  }

  return { warnings, problems };
}

export function validateBatch(rows: AssemblyRow[]): {
  warnings: string[];
  problems: string[];
} {
  const warnings: string[] = [];
  const problems: string[] = [];

  if (rows.length === 0) {
    warnings.push("Nenhuma linha de montagem criada.");
    return { warnings, problems };
  }

  const fileNames = rows
    .map((r) => r.outputFileName)
    .filter((name) => name && name.trim() !== "");

  const duplicates = fileNames.filter(
    (name, index) => fileNames.indexOf(name) !== index
  );

  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    problems.push(`Nomes finais duplicados: ${uniqueDuplicates.join(", ")}`);
  }

  return { warnings, problems };
}

export function validateOutputFileName(fileName: string): string[] {
  const warnings: string[] = [];

  if (fileName.includes(" ")) {
    warnings.push("Nome final contem espacos.");
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    warnings.push("Nome final deve ter extensao .pdf.");
  }

  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(fileName)) {
    warnings.push("Nome final contem caracteres invalidos.");
  }

  return warnings;
}

export function validatePageSelection(
  selection: PageSelection,
  importedFiles: ImportedPdfFile[]
): string[] {
  const warnings: string[] = [];

  const sourceFile = importedFiles.find((f) => f.id === selection.sourceFileId);

  if (!sourceFile) {
    warnings.push("Arquivo fonte nao encontrado.");
    return warnings;
  }

  if (sourceFile.pageCount === 0) {
    return warnings;
  }

  if (selection.mode === "page_range") {
    if (selection.startPage !== undefined && selection.startPage < 1) {
      warnings.push("Pagina inicial invalida.");
    }
    if (selection.endPage !== undefined && selection.endPage > sourceFile.pageCount) {
      warnings.push(
        `Pagina final (${selection.endPage}) excede total de paginas (${sourceFile.pageCount}).`
      );
    }
    if (
      selection.startPage !== undefined &&
      selection.endPage !== undefined &&
      selection.startPage > selection.endPage
    ) {
      warnings.push("Pagina inicial maior que pagina final.");
    }
  }

  if (selection.mode === "specific_pages" && selection.pages) {
    const invalidPages = selection.pages.filter(
      (p) => p < 1 || p > sourceFile.pageCount
    );
    if (invalidPages.length > 0) {
      warnings.push(
        `Paginas fora do intervalo: ${invalidPages.join(", ")} (total: ${sourceFile.pageCount}).`
      );
    }
  }

  return warnings;
}

export function determineOutputMode(rows: AssemblyRow[]): "single_pdf" | "zip" {
  return rows.length <= 1 ? "single_pdf" : "zip";
}
