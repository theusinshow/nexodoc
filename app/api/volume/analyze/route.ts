import { NextRequest, NextResponse } from "next/server";
import type {
  AssemblyRow,
  VolumeMetadata,
  ImportedPdfFile,
  BatchAnalysisResult,
} from "@/modules/volume-builder/lib/volume/volume-types";
import { isAIConfigured, callOpenAI } from "@/modules/volume-builder/lib/ai/openai";
import {
  BATCH_ANALYSIS_SYSTEM_PROMPT,
  buildBatchAnalysisUserPrompt,
} from "@/modules/volume-builder/lib/ai/batch-analysis-prompt";
import { validateBatchAssembly } from "@/modules/volume-builder/lib/volume/volume-validator";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export async function POST(request: NextRequest) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  try {
    await refreshAiModelOverrideCache();
    const body = await request.json();

    const { rows, metadata, importedFiles } = body as {
      rows: AssemblyRow[];
      metadata: VolumeMetadata;
      importedFiles: ImportedPdfFile[];
    };

    if (!rows || rows.length === 0) {
      return withVolumeCors(
        NextResponse.json(
          { error: "Nenhuma linha de montagem fornecida." },
          { status: 400 }
        ),
        request
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

      return withVolumeCors(NextResponse.json(result), request);
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

      const aiResponse = await callOpenAI(BATCH_ANALYSIS_SYSTEM_PROMPT, userPrompt, {
        operation: "volume-batch-analysis",
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

      return withVolumeCors(NextResponse.json(combinedResult), request);
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

      return withVolumeCors(NextResponse.json(fallbackResult), request);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return withVolumeCors(NextResponse.json({ error: message }, { status: 500 }), request);
  }
}

export function OPTIONS(request: Request) {
  return volumeOptions(request, "POST, OPTIONS");
}
