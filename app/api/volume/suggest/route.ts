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
import { getClassificationKey } from "@/modules/volume-builder/lib/volume/page-classification";
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
    const localSuggestions = buildLocalSuggestions(pageAssets, metadata);

    if (!configuration.keyConfigured) {
      return withVolumeCors(
        NextResponse.json({
          suggestions: localSuggestions,
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
      const suggestions = sanitized.length > 0 ? sanitized : localSuggestions;

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
          suggestions: localSuggestions,
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

function buildLocalSuggestions(
  assets: PageAsset[],
  metadata: VolumeMetadata
): AssemblySuggestion[] {
  const covers = assets.filter((asset) => asset.role === "cover");
  const lds = assets.filter((asset) => asset.role === "ld");
  const documents = assets.filter((asset) => asset.role === "document");

  if (covers.length === 0 && lds.length === 0 && documents.length === 0) {
    return [];
  }

  const documentGroups = groupDocumentsByClassification(documents);
  const groups =
    documentGroups.length > 0 ? documentGroups : [{ key: "GERAL:SEM_BLOCO", documents: [] }];

  return groups.map((group, index) => {
    const reference = group.documents[0];
    const cover = pickBestMatch(covers, reference) ?? covers[index] ?? covers[0];
    const ld = pickBestMatch(lds, reference) ?? lds[index] ?? lds[0];
    const discipline = reference?.classification?.disciplineCode ?? ld?.classification?.disciplineCode;
    const block = reference?.classification?.blockCode ?? ld?.classification?.blockCode;
    const inferredTitle = inferSeparatorTitle(ld, group.documents);
    const outputBase =
      metadata.tomo ||
      metadata.volume ||
      [metadata.projectCode, discipline, block ? `bl_${block}` : undefined]
        .filter(Boolean)
        .join("_") ||
      `volume_${index + 1}`;

    return {
      id: `sugestao-local-${index + 1}`,
      title: buildSuggestionTitle(index, discipline, block, metadata),
      outputFileName: ensurePdfExtension(`${sanitizeFileName(outputBase)}.pdf`),
      coverAssetId: cover?.id,
      ldAssetId: ld?.id,
      separatorTitle: inferredTitle,
      documentAssetIds: group.documents.map((asset) => asset.id),
      confidence: getLocalConfidence(cover, ld, group.documents, reference),
      notes: [
        cover
          ? `Capa associada${block ? ` ao bloco ${block}` : ""}.`
          : "Nenhuma capa compativel foi encontrada.",
        ld ? `LD associada${block ? ` ao bloco ${block}` : ""}.` : "Nenhuma LD compativel foi encontrada.",
        `${group.documents.length} prancha(s) incluidas${discipline ? ` em ${discipline}` : ""}${block ? ` bloco ${block}` : ""}.`,
      ],
    };
  });
}

function groupDocumentsByClassification(documents: PageAsset[]) {
  const map = new Map<string, PageAsset[]>();

  for (const document of documents) {
    const key = getClassificationKey(document.classification);
    const group = map.get(key) ?? [];
    group.push(document);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .map(([key, groupDocuments]) => ({
      key,
      documents: groupDocuments.sort(compareAssetsByClassification),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function pickBestMatch(candidates: PageAsset[], reference?: PageAsset) {
  if (!reference) {
    return candidates[0];
  }

  const discipline = reference.classification?.disciplineCode;
  const block = reference.classification?.blockCode;
  const volume = reference.classification?.volumeHint;

  return candidates
    .map((candidate) => ({
      candidate,
      score:
        (discipline && candidate.classification?.disciplineCode === discipline ? 2 : 0) +
        (block && candidate.classification?.blockCode === block ? 3 : 0) +
        (volume && candidate.classification?.volumeHint === volume ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.candidate;
}

function compareAssetsByClassification(a: PageAsset, b: PageAsset) {
  const aNumber = Number(a.classification?.sheetNumber?.replace(/\D/g, "") || a.pageNumber);
  const bNumber = Number(b.classification?.sheetNumber?.replace(/\D/g, "") || b.pageNumber);

  if (aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return a.pageNumber - b.pageNumber;
}

function buildSuggestionTitle(
  index: number,
  discipline: string | undefined,
  block: string | undefined,
  metadata: VolumeMetadata
) {
  if (discipline && block) {
    return `${discipline} - Bloco ${block}`;
  }

  if (discipline) {
    return `${discipline} - Volume ${String(index + 1).padStart(2, "0")}`;
  }

  return metadata.tomo ? `Volume ${metadata.tomo}` : `Volume ${String(index + 1).padStart(2, "0")}`;
}

function getLocalConfidence(
  cover: PageAsset | undefined,
  ld: PageAsset | undefined,
  documents: PageAsset[],
  reference: PageAsset | undefined
): AssemblySuggestion["confidence"] {
  const strongReference = (reference?.classification?.confidence ?? 0) >= 0.72;

  if (cover && ld && documents.length > 0 && strongReference) {
    return "high";
  }

  if ((cover || ld) && documents.length > 0) {
    return "medium";
  }

  return "low";
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
