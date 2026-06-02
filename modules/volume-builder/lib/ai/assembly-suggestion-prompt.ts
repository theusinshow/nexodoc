import type { AssemblySuggestionRequest } from "@/modules/volume-builder/lib/volume/assembly-suggestion-types";

export const ASSEMBLY_SUGGESTION_SYSTEM_PROMPT = `Voce e um assistente de montagem documental de volumes tecnicos de engenharia.

Sua tarefa e sugerir uma montagem de volume a partir de paginas ja importadas e classificadas.

Regras:
- Use paginas com role "cover" apenas como capa.
- Use paginas com role "ld" apenas como lista de documentos.
- Use paginas com role "document" como pranchas/documentos.
- Nao invente assetIds.
- Nao use paginas que nao aparecem no payload.
- A LD deve guiar quais pranchas entram e a ordem provavel.
- Quando houver disciplineCode e blockCode, agrupe capa, LD e pranchas pelo mesmo par disciplina/bloco.
- Para projetos por bloco, gere uma sugestao por bloco quando houver pranchas suficientes.
- Se a LD disser que ha N pranchas e houver N pranchas compativeis, sugira todas.
- A separatriz deve ser gerada automaticamente, com titulo tecnico em caixa alta.
- Se houver duvida, use confidence "medium" ou "low" e explique em notes.
- Retorne somente JSON valido, sem markdown.

Formato obrigatorio:
{
  "suggestions": [
    {
      "id": "sugestao-1",
      "title": "Volume 01",
      "outputFileName": "volume_01.pdf",
      "coverAssetId": "asset-id-opcional",
      "ldAssetId": "asset-id-opcional",
      "separatorTitle": "PROJETO DE ESTRUTURAS DE CONCRETO",
      "documentAssetIds": ["asset-id"],
      "confidence": "high" | "medium" | "low",
      "notes": ["motivo"]
    }
  ],
  "warnings": ["alertas gerais"]
}`;

export function buildAssemblySuggestionUserPrompt(data: AssemblySuggestionRequest) {
  const assets = data.pageAssets.map((asset) => ({
    assetId: asset.id,
    fileId: asset.sourceFileId,
    fileName: asset.sourceFileName,
    pageNumber: asset.pageNumber,
    pageCount: asset.pageCount,
    role: asset.role ?? "document",
    summary: asset.summary ?? "",
    classification: asset.classification
      ? {
          role: asset.classification.role,
          disciplineCode: asset.classification.disciplineCode,
          disciplineName: asset.classification.disciplineName,
          blockCode: asset.classification.blockCode,
          documentCode: asset.classification.documentCode,
          sheetNumber: asset.classification.sheetNumber,
          revision: asset.classification.revision,
          volumeHint: asset.classification.volumeHint,
          projectCode: asset.classification.projectCode,
          confidence: asset.classification.confidence,
          warnings: asset.classification.warnings,
        }
      : undefined,
  }));

  const files = data.importedFiles.map((file) => ({
    id: file.id,
    name: file.name,
    role: file.role,
    pageCount: file.pageCount,
  }));

  return JSON.stringify(
    {
      metadata: data.metadata,
      files,
      assets,
    },
    null,
    2
  );
}
