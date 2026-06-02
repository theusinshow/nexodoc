import type {
  AssemblyRow,
  VolumeMetadata,
  ImportedPdfFile,
  BatchAnalysisResult,
} from "@/modules/volume-builder/lib/volume/volume-types";
import { formatPageSelection } from "@/modules/volume-builder/lib/utils/parse-page-selection";
import { formatFileSize } from "@/modules/volume-builder/lib/utils/format-file-size";
import { format } from "date-fns";

export interface ReportData {
  metadata: VolumeMetadata;
  importedFiles: ImportedPdfFile[];
  rows: AssemblyRow[];
  validationResult?: BatchAnalysisResult;
  generatedAt: Date;
}

export function generateMarkdownReport(data: ReportData): string {
  const { metadata, importedFiles, rows, validationResult, generatedAt } = data;

  const lines: string[] = [];

  lines.push("# Relatorio de Montagem");
  lines.push("");
  lines.push(`Gerado em: ${format(generatedAt, "dd/MM/yyyy HH:mm")}`);
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 1. Identificacao do Lote");
  lines.push("");
  if (metadata.projectCode) lines.push(`- **Codigo do projeto:** ${metadata.projectCode}`);
  if (metadata.projectName) lines.push(`- **Nome do projeto:** ${metadata.projectName}`);
  if (metadata.client) lines.push(`- **Cliente:** ${metadata.client}`);
  if (metadata.city) lines.push(`- **Cidade:** ${metadata.city}`);
  if (metadata.volume) lines.push(`- **Volume:** ${metadata.volume}`);
  if (metadata.tomo) lines.push(`- **Tomo:** ${metadata.tomo}`);
  if (metadata.revision) lines.push(`- **Revisao:** ${metadata.revision}`);
  if (metadata.date) lines.push(`- **Data:** ${metadata.date}`);
  lines.push(`- **Total de linhas:** ${rows.length}`);
  lines.push(
    `- **Modo de saida:** ${rows.length <= 1 ? "PDF unico" : "ZIP com multiplos PDFs"}`
  );
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 2. Arquivos Importados");
  lines.push("");
  if (importedFiles.length === 0) {
    lines.push("Nenhum arquivo importado.");
  } else {
    lines.push("| # | Arquivo | Tamanho | Paginas |");
    lines.push("|---|---------|---------|---------|");
    importedFiles.forEach((file, index) => {
      lines.push(
        `| ${index + 1} | ${file.name} | ${formatFileSize(file.size)} | ${file.pageCount} |`
      );
    });
  }
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 3. Linhas de Montagem");
  lines.push("");
  if (rows.length === 0) {
    lines.push("Nenhuma linha de montagem criada.");
  } else {
    for (const row of rows) {
      lines.push(`### ${row.title}`);
      lines.push("");
      lines.push(`- **Nome final:** \`${row.outputFileName || "sem nome"}\``);
      lines.push(`- **Status:** ${row.status}`);
      lines.push("");

      if (row.cover?.selection) {
        lines.push("**Capa:**");
        lines.push(
          `- ${row.cover.selection.sourceFileName} — ${formatPageSelection(row.cover.selection)}`
        );
        lines.push("");
      } else {
        lines.push("**Capa:** nao definida");
        lines.push("");
      }

      if (row.blocks.length === 0) {
        lines.push("Nenhum grupo documental.");
        lines.push("");
      } else {
        for (let i = 0; i < row.blocks.length; i++) {
          const block = row.blocks[i];
          lines.push(`**Grupo ${i + 1}: ${block.title}** (${block.disciplineCode || "sem disciplina"})`);
          lines.push("");
          lines.push(
            `- Separatriz: ${
              block.separator?.selection?.sourceFileName ?? `${block.separatorTitle || "sem titulo"} (automatica)`
            }`
          );

          if (block.ld?.selection) {
            lines.push(
              `- LD: ${block.ld.selection.sourceFileName} — ${formatPageSelection(block.ld.selection)}`
            );
          } else {
            lines.push("- LD: nao definida");
          }

          if (block.documents.length > 0) {
            lines.push("- Documentos:");
            for (const doc of block.documents) {
              if (doc.selection) {
                lines.push(
                  `  - ${doc.selection.sourceFileName} — ${formatPageSelection(doc.selection)}`
                );
              } else {
                lines.push(`  - ${doc.label}: sem selecao`);
              }
            }
          } else {
            lines.push("- Documentos: nenhum");
          }

          if (block.appendices && block.appendices.length > 0) {
            lines.push("- Anexos:");
            for (const appendix of block.appendices) {
              if (appendix.selection) {
                lines.push(
                  `  - ${appendix.selection.sourceFileName} — ${formatPageSelection(appendix.selection)}`
                );
              }
            }
          }

          lines.push("");
        }
      }
    }
  }

  lines.push("---");
  lines.push("");

  lines.push("## 4. Selecoes de Paginas");
  lines.push("");
  const allSelections: { row: string; slot: string; file: string; selection: string }[] = [];
  for (const row of rows) {
    if (row.cover?.selection) {
      allSelections.push({
        row: row.title,
        slot: "Capa",
        file: row.cover.selection.sourceFileName,
        selection: formatPageSelection(row.cover.selection),
      });
    }
    for (const block of row.blocks) {
      if (block.ld?.selection) {
        allSelections.push({
          row: row.title,
          slot: `LD (${block.title})`,
          file: block.ld.selection.sourceFileName,
          selection: formatPageSelection(block.ld.selection),
        });
      }
      for (const doc of block.documents) {
        if (doc.selection) {
          allSelections.push({
            row: row.title,
            slot: doc.label || "Documento",
            file: doc.selection.sourceFileName,
            selection: formatPageSelection(doc.selection),
          });
        }
      }
    }
  }

  if (allSelections.length === 0) {
    lines.push("Nenhuma selecao de paginas definida.");
  } else {
    lines.push("| Linha | Slot | Arquivo | Selecao |");
    lines.push("|-------|------|---------|---------|");
    for (const sel of allSelections) {
      lines.push(`| ${sel.row} | ${sel.slot} | ${sel.file} | ${sel.selection} |`);
    }
  }
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 5. Resultado da Validacao");
  lines.push("");
  if (validationResult) {
    lines.push(`- **Status geral:** ${validationResult.status}`);
    lines.push(`- **Resumo:** ${validationResult.summary}`);
    lines.push(
      `- **Requer confirmacao manual:** ${validationResult.requiresManualConfirmation ? "Sim" : "Nao"}`
    );
  } else {
    lines.push("Validacao nao executada.");
  }
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 6. Pontos de Atencao");
  lines.push("");
  const attentionPoints: string[] = [];

  if (validationResult) {
    attentionPoints.push(...validationResult.batchWarnings);
    for (const rowWarning of validationResult.rowWarnings) {
      attentionPoints.push(...rowWarning.warnings);
    }
  }

  for (const row of rows) {
    if (!row.cover) {
      attentionPoints.push(`${row.title}: capa ausente`);
    }
  }

  if (attentionPoints.length === 0) {
    lines.push("Nenhum ponto de atencao identificado.");
  } else {
    for (const point of attentionPoints) {
      lines.push(`- ${point}`);
    }
  }
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 7. Problemas de Montagem");
  lines.push("");
  const problems: string[] = [];

  if (validationResult) {
    for (const rowWarning of validationResult.rowWarnings) {
      problems.push(...rowWarning.problems);
    }
  }

  for (const row of rows) {
    if (row.blocks.length === 0) {
      problems.push(`${row.title}: nenhum grupo documental`);
    }
    if (!row.outputFileName || row.outputFileName.trim() === "") {
      problems.push(`${row.title}: nome final vazio`);
    }
    for (const block of row.blocks) {
      if (block.documents.length === 0) {
        problems.push(`${row.title} > ${block.title}: grupo sem documentos`);
      }
    }
  }

  if (problems.length === 0) {
    lines.push("Nenhum problema de montagem identificado.");
  } else {
    for (const problem of problems) {
      lines.push(`- ${problem}`);
    }
  }
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## 8. Arquivos Gerados");
  lines.push("");
  if (rows.length === 0) {
    lines.push("Nenhum arquivo gerado.");
  } else if (rows.length === 1) {
    lines.push(`- \`${rows[0].outputFileName || "volume.pdf"}\``);
    lines.push("- `relatorio_montagem.md`");
  } else {
    lines.push("Arquivos no ZIP:");
    lines.push("");
    for (const row of rows) {
      lines.push(`- \`${row.outputFileName || `volume_${row.order}.pdf`}\``);
    }
    lines.push("- `relatorio_montagem.md`");
  }
  lines.push("");

  return lines.join("\n");
}
