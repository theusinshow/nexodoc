import { NextRequest, NextResponse } from "next/server";
import { getAiConfiguration } from "@/lib/ai-providers";
import { getOpenAIClient } from "@/lib/openai";
import { recordAiUsage } from "@/lib/ai-usage";
import type {
  AssemblySuggestion,
  AssemblySuggestionRequest,
  AssemblySuggestionResponse,
} from "@/modules/volume-builder/lib/volume/assembly-suggestion-types";
import type { PageAsset, VolumeMetadata } from "@/modules/volume-builder/lib/volume/volume-types";
import {
  ASSEMBLY_SUGGESTION_SYSTEM_PROMPT,
  buildAssemblySuggestionUserPrompt,
} from "@/modules/volume-builder/lib/ai/assembly-suggestion-prompt";
import { volumeOptions, withVolumeCors } from "@/app/api/volume/_shared/cors";

type AiSuggestionPayload = {
  suggestions?: AssemblySuggestion[];
  warnings?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssemblySuggestionRequest;
    const pageAssets = Array.isArray(body.pageAssets) ? body.pageAssets : [];
    const importedFiles = Array.isArray(body.importedFiles) ? body.importedFiles : [];
    const metadata = body.metadata ?? { projectCode: "", projectName: "" };

    if (pageAssets.length === 0) {
      return withVolumeCors(
        NextResponse.json(
          { error: "Nenhuma pagina importada para sugerir montagem." },
          { status: 400 }
        ),
        request
      );
    }

    const configuration = getAiConfiguration().volumeSuggestion;
    const localSuggestion = buildLocalSuggestion(pageAssets, metadata);

    if (!configuration.keyConfigured) {
      return withVolumeCors(
        NextResponse.json({
          suggestions: localSuggestion ? [localSuggestion] : [],
          source: "local",
          warnings: [
            "IA nao configurada. Sugestao local baseada em tipos de upload e ordem das paginas.",
          ],
        } satisfies AssemblySuggestionResponse),
        request
      );
    }

    try {
      const startedAt = Date.now();
      const response = await getOpenAIClient().responses.create({
        model: configuration.model,
        instructions: ASSEMBLY_SUGGESTION_SYSTEM_PROMPT,
        input: buildAssemblySuggestionUserPrompt({
          metadata,
          importedFiles,
          pageAssets,
        }),
        max_output_tokens: 2500,
        reasoning: { effort: "low" },
      });

      const parsed = parseAiJson(response.output_text ?? "");
      const sanitized = sanitizeSuggestions(parsed.suggestions ?? [], pageAssets);
      const suggestions = sanitized.length > 0 ? sanitized : localSuggestion ? [localSuggestion] : [];

      await recordAiUsage({
        flow: "volume-suggestion",
        provider: "openai",
        model: configuration.model,
        operation: "volume-assembly-suggestion",
        response,
        durationMs: Date.now() - startedAt,
        taskLabel: metadata.projectName || metadata.projectCode || "Volume",
        metadata: {
          importedFiles: importedFiles.length,
          pageAssets: pageAssets.length,
          suggestions: suggestions.length,
        },
      });

      return withVolumeCors(
        NextResponse.json({
          suggestions,
          source: "ai",
          model: configuration.model,
          warnings: parsed.warnings ?? [],
        } satisfies AssemblySuggestionResponse),
        request
      );
    } catch (error) {
      console.error("Erro na sugestao de montagem por IA:", error);

      return withVolumeCors(
        NextResponse.json({
          suggestions: localSuggestion ? [localSuggestion] : [],
          source: "local",
          model: configuration.model,
          warnings: [
            "IA indisponivel. Sugestao local baseada em tipos de upload e ordem das paginas.",
          ],
        } satisfies AssemblySuggestionResponse),
        request
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return withVolumeCors(NextResponse.json({ error: message }, { status: 500 }), request);
  }
}

export function OPTIONS(request: Request) {
  return volumeOptions(request, "POST, OPTIONS");
}

function parseAiJson(text: string): AiSuggestionPayload {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned) as AiSuggestionPayload;
}

function sanitizeSuggestions(suggestions: AssemblySuggestion[], assets: PageAsset[]) {
  const assetIds = new Set(assets.map((asset) => asset.id));

  return suggestions.map((suggestion, index) => ({
    id: suggestion.id || `sugestao-${index + 1}`,
    title: suggestion.title || `Volume ${String(index + 1).padStart(2, "0")}`,
    outputFileName: ensurePdfExtension(suggestion.outputFileName || `volume_${index + 1}.pdf`),
    coverAssetId: assetIds.has(suggestion.coverAssetId ?? "") ? suggestion.coverAssetId : undefined,
    ldAssetId: assetIds.has(suggestion.ldAssetId ?? "") ? suggestion.ldAssetId : undefined,
    separatorTitle: suggestion.separatorTitle || "SEPARATRIZ",
    documentAssetIds: (suggestion.documentAssetIds ?? []).filter((id) => assetIds.has(id)),
    confidence: suggestion.confidence ?? "medium",
    notes: suggestion.notes ?? [],
  }));
}

function buildLocalSuggestion(
  assets: PageAsset[],
  metadata: VolumeMetadata
): AssemblySuggestion | null {
  const cover = assets.find((asset) => asset.role === "cover");
  const ld = assets.find((asset) => asset.role === "ld");
  const documents = assets.filter((asset) => asset.role === "document");

  if (!cover && !ld && documents.length === 0) {
    return null;
  }

  const inferredTitle = inferSeparatorTitle(ld, documents);
  const outputBase =
    metadata.tomo ||
    metadata.volume ||
    metadata.projectCode ||
    "volume_01";

  return {
    id: "sugestao-local-1",
    title: metadata.tomo ? `Volume ${metadata.tomo}` : "Volume 01",
    outputFileName: ensurePdfExtension(`${sanitizeFileName(outputBase)}.pdf`),
    coverAssetId: cover?.id,
    ldAssetId: ld?.id,
    separatorTitle: inferredTitle,
    documentAssetIds: documents.map((asset) => asset.id),
    confidence: ld && documents.length > 0 ? "medium" : "low",
    notes: [
      cover ? "Capa selecionada pelo tipo do upload." : "Nenhuma capa classificada foi encontrada.",
      ld ? "LD selecionada pelo tipo do upload." : "Nenhuma LD classificada foi encontrada.",
      `${documents.length} prancha(s) classificada(s) foram incluidas na ordem da bandeja.`,
    ],
  };
}

function inferSeparatorTitle(ld: PageAsset | undefined, documents: PageAsset[]) {
  const sourceText = `${ld?.summary ?? ""} ${documents.map((doc) => doc.summary ?? "").join(" ")}`.toUpperCase();

  if (sourceText.includes("ESTRUTURA") || sourceText.includes("CONCRETO")) {
    return "PROJETO DE ESTRUTURAS DE CONCRETO";
  }

  if (sourceText.includes("ARQUITET")) {
    return "PROJETO ARQUITETONICO";
  }

  if (sourceText.includes("HIDROSSANIT")) {
    return "PROJETO HIDROSSANITARIO";
  }

  if (sourceText.includes("ELETRIC")) {
    return "PROJETO ELETRICO";
  }

  return "DOCUMENTOS TECNICOS";
}

function ensurePdfExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*]/g, "_")
    .toLowerCase();
}
