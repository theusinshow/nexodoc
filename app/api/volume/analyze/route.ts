import { NextRequest, NextResponse } from "next/server";
import type {
  AssemblyRow,
  VolumeMetadata,
  ImportedPdfFile,
  BatchAnalysisResult,
} from "@/modules/volume-builder/lib/volume/volume-types";
import { isAIConfigured, callOpenAI } from "@/modules/volume-builder/lib/ai/openai";
import { recordAiUsage } from "@/lib/ai-usage";
import {
  BATCH_ANALYSIS_SYSTEM_PROMPT,
  buildBatchAnalysisUserPrompt,
} from "@/modules/volume-builder/lib/ai/batch-analysis-prompt";
import { validateBatchAssembly } from "@/modules/volume-builder/lib/volume/volume-validator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { rows, metadata, importedFiles } = body as {
      rows: AssemblyRow[];
      metadata: VolumeMetadata;
      importedFiles: ImportedPdfFile[];
    };

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma linha de montagem fornecida." },
        { status: 400 }
      );
    }

    const localResult = validateBatchAssembly(rows, importedFiles);

    if (!isAIConfigured()) {
      const result: BatchAnalysisResult = {
        status: localResult.status,
        summary:
          localResult.status === "sem_problemas"
            ? "Nenhum problema encontrado na montagem. (IA nao configurada)"
            : localResult.status === "ponto_de_atencao"
              ? `Encontrados ${localResult.warnings.length} ponto(s) de atencao. (IA nao configurada)`
              : `Encontrados ${localResult.problems.length} problema(s) de montagem. (IA nao configurada)`,
        batchWarnings: localResult.warnings,
        rowWarnings: rows.map((row) => ({
          rowId: row.id,
          rowTitle: row.title,
          warnings: row.warnings,
          problems: [],
        })),
        requiresManualConfirmation: localResult.status === "problema_de_montagem",
      };

      return NextResponse.json(result);
    }

    try {
      const rowsJson = JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          outputFileName: r.outputFileName,
          hasCover: Boolean(r.cover?.selection),
          blocks: r.blocks.map((b) => ({
            title: b.title,
            disciplineCode: b.disciplineCode,
            separatorTitle: b.separatorTitle,
            hasLd: Boolean(b.ld?.selection),
            documentsCount: b.documents.filter((d) => d.selection).length,
          })),
        })),
        null,
        2
      );

      const importedFilesJson = JSON.stringify(
        importedFiles.map((f) => ({
          name: f.name,
          pageCount: f.pageCount,
        })),
        null,
        2
      );

      const metadataJson = JSON.stringify(metadata, null, 2);

      const userPrompt = buildBatchAnalysisUserPrompt(
        rowsJson,
        importedFilesJson,
        metadataJson
      );

      const aiResponse = await callOpenAI(BATCH_ANALYSIS_SYSTEM_PROMPT, userPrompt);

      await recordAiUsage({
        flow: "volume-analysis",
        provider: "openai",
        model: aiResponse.model,
        operation: "volume-batch-analysis",
        response: aiResponse.response,
        durationMs: aiResponse.durationMs,
        taskLabel: metadata.projectName || metadata.projectCode || "Volume",
        metadata: {
          rows: rows.length,
          importedFiles: importedFiles.length,
        },
      });

      const aiResult: BatchAnalysisResult = JSON.parse(aiResponse.text);

      const allWarnings = [
        ...localResult.warnings,
        ...(aiResult.batchWarnings || []),
      ];

      const allProblems = localResult.problems;

      const combinedStatus =
        allProblems.length > 0
          ? "problema_de_montagem"
          : allWarnings.length > 0
            ? "ponto_de_atencao"
            : (aiResult.status ?? localResult.status);

      const combinedResult: BatchAnalysisResult = {
        status: combinedStatus,
        summary: aiResult.summary || localResult.status,
        batchWarnings: allWarnings,
        rowWarnings: aiResult.rowWarnings || [],
        requiresManualConfirmation:
          combinedStatus === "problema_de_montagem",
      };

      return NextResponse.json(combinedResult);
    } catch (aiError) {
      console.error("Erro na analise por IA:", aiError);

      const fallbackResult: BatchAnalysisResult = {
        status: localResult.status,
        summary: `${localResult.status === "sem_problemas" ? "Nenhum problema encontrado." : "Validacao local executada."} (IA indisponivel)`,
        batchWarnings: localResult.warnings,
        rowWarnings: rows.map((row) => ({
          rowId: row.id,
          rowTitle: row.title,
          warnings: row.warnings,
          problems: [],
        })),
        requiresManualConfirmation: localResult.status === "problema_de_montagem",
      };

      return NextResponse.json(fallbackResult);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
