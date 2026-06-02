"use client";

import { useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type {
  AssemblyRow,
  AssemblySlot,
  ImportedPdfFile,
  PageAsset,
  VolumeMetadata,
} from "@/modules/volume-builder/lib/volume/volume-types";
import { createEmptyBlock, createEmptyRow } from "@/modules/volume-builder/lib/volume/assembly-builder";
import { createPageAssetsForFile, createPageSelectionFromAsset } from "@/modules/volume-builder/lib/volume/page-assets";
import { VolumeMetadataForm } from "./volume-metadata-form";
import { ImportedFilesPool } from "./imported-files-pool";
import { PageAssetTray } from "./page-asset-tray";
import { AssemblyWorkspace } from "./assembly-workspace";
import { VolumeStructurePreview } from "./volume-structure-preview";
import { AiValidationPanel } from "./ai-validation-panel";
import { ExportPanel } from "./export-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers3, Plus } from "lucide-react";

export function VolumeBuilderPage() {
  const [metadata, setMetadata] = useState<VolumeMetadata>({
    projectCode: "",
    projectName: "",
  });
  const [importedFiles, setImportedFiles] = useState<ImportedPdfFile[]>([]);
  const [pageAssets, setPageAssets] = useState<PageAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [fileDataMap, setFileDataMap] = useState<Map<string, File>>(new Map());
  const [rows, setRows] = useState<AssemblyRow[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  function handleAddRow() {
    const newRow = createEmptyRow(rows.length + 1);
    setRows([...rows, newRow]);
  }

  function handleRemoveRow(rowId: string) {
    setRows(rows.filter((r) => r.id !== rowId));
  }

  function handleUpdateRow(updatedRow: AssemblyRow) {
    setRows(rows.map((r) => (r.id === updatedRow.id ? updatedRow : r)));
  }

  function createSlotFromAsset(asset: PageAsset, type: AssemblySlot["type"], label: string): AssemblySlot {
    return {
      id: `slot-${Date.now()}-${asset.id}`,
      type,
      label,
      selection: createPageSelectionFromAsset(asset),
      warnings: [],
    };
  }

  function ensureFirstRow(currentRows: AssemblyRow[]) {
    return currentRows.length > 0 ? currentRows : [createEmptyRow(1)];
  }

  function handleSendToCover(asset: PageAsset) {
    setRows((currentRows) => {
      const nextRows = ensureFirstRow(currentRows);
      const [firstRow, ...rest] = nextRows;
      return [
        {
          ...firstRow,
          cover: createSlotFromAsset(asset, "cover", "Capa"),
        },
        ...rest,
      ];
    });
  }

  function handleSendToLd(asset: PageAsset) {
    setRows((currentRows) => {
      const nextRows = ensureFirstRow(currentRows);
      const [firstRow, ...rest] = nextRows;
      const [firstBlock, ...remainingBlocks] =
        firstRow.blocks.length > 0 ? firstRow.blocks : [createEmptyBlock(1)];

      return [
        {
          ...firstRow,
          blocks: [
            {
              ...firstBlock,
              ld: createSlotFromAsset(asset, "ld", "LD"),
            },
            ...remainingBlocks,
          ],
        },
        ...rest,
      ];
    });
  }

  function handleSendToDocuments(assets: PageAsset[]) {
    if (assets.length === 0) {
      return;
    }

    setRows((currentRows) => {
      const nextRows = ensureFirstRow(currentRows);
      const [firstRow, ...rest] = nextRows;
      const [firstBlock, ...remainingBlocks] =
        firstRow.blocks.length > 0 ? firstRow.blocks : [createEmptyBlock(1)];
      const newDocuments = assets.map((asset, index) =>
        createSlotFromAsset(asset, "document", `Doc ${firstBlock.documents.length + index + 1}`)
      );

      return [
        {
          ...firstRow,
          blocks: [
            {
              ...firstBlock,
              documents: [...firstBlock.documents, ...newDocuments],
            },
            ...remainingBlocks,
          ],
        },
        ...rest,
      ];
    });
  }

  function getDraggedAssets(activeId: string) {
    const ids = selectedAssetIds.includes(activeId) ? selectedAssetIds : [activeId];
    return ids
      .map((id) => pageAssets.find((asset) => asset.id === id))
      .filter((asset): asset is PageAsset => Boolean(asset));
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string") {
      return;
    }

    const assets = getDraggedAssets(String(event.active.id));
    if (assets.length === 0) {
      return;
    }

    const [target, id, index] = overId.split(":");

    if (target === "cover") {
      const asset = assets[0];
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === id
            ? { ...row, cover: createSlotFromAsset(asset, "cover", "Capa") }
            : row
        )
      );
      return;
    }

    if (target === "ld" || target === "separator") {
      const asset = assets[0];
      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          blocks: row.blocks.map((block) =>
            block.id === id
              ? {
                  ...block,
                  [target]: createSlotFromAsset(
                    asset,
                    target,
                    target === "ld" ? "LD" : "Separatriz"
                  ),
                }
              : block
          ),
        }))
      );
      return;
    }

    if (target === "documents") {
      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          blocks: row.blocks.map((block) =>
            block.id === id
              ? {
                  ...block,
                  documents: [
                    ...block.documents,
                    ...assets.map((asset, assetIndex) =>
                      createSlotFromAsset(
                        asset,
                        "document",
                        `Doc ${block.documents.length + assetIndex + 1}`
                      )
                    ),
                  ],
                }
              : block
          ),
        }))
      );
      return;
    }

    if (target === "document") {
      const asset = assets[0];
      const documentIndex = Number(index);
      if (Number.isNaN(documentIndex)) {
        return;
      }

      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          blocks: row.blocks.map((block) => {
            if (block.id !== id) {
              return block;
            }

            const documents = [...block.documents];
            documents[documentIndex] = createSlotFromAsset(
              asset,
              "document",
              `Doc ${documentIndex + 1}`
            );
            return { ...block, documents };
          }),
        }))
      );
    }
  }

  function handleFilesImported(files: ImportedPdfFile[], fileData: File[]) {
    setImportedFiles((current) => [...current, ...files]);
    setPageAssets((current) => [
      ...current,
      ...files.flatMap((file) => createPageAssetsForFile(file)),
    ]);

    setFileDataMap((current) => {
      const newMap = new Map(current);
      for (let i = 0; i < files.length; i++) {
        newMap.set(files[i].id, fileData[i]);
      }
      return newMap;
    });
  }

  function handleRemoveFile(fileId: string) {
    setImportedFiles((current) => current.filter((f) => f.id !== fileId));
    setPageAssets((current) => current.filter((asset) => asset.sourceFileId !== fileId));
    setSelectedAssetIds((current) =>
      current.filter((id) => !id.startsWith(`${fileId}-page-`))
    );
    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        cover:
          row.cover?.selection?.sourceFileId === fileId ? undefined : row.cover,
        blocks: row.blocks.map((block) => ({
          ...block,
          ld: block.ld?.selection?.sourceFileId === fileId ? undefined : block.ld,
          separator:
            block.separator?.selection?.sourceFileId === fileId
              ? undefined
              : block.separator,
          documents: block.documents.filter(
            (slot) => slot.selection?.sourceFileId !== fileId
          ),
          appendices: block.appendices?.filter(
            (slot) => slot.selection?.sourceFileId !== fileId
          ),
        })),
      }))
    );

    setFileDataMap((current) => {
      const newMap = new Map(current);
      newMap.delete(fileId);
      return newMap;
    });
  }

  return (
    <div className="max-w-full space-y-5 overflow-x-clip">
      <Card className="sticky top-0 z-20 border bg-background/95 backdrop-blur">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">Montagem de volumes</h1>
              <Badge variant="outline">{rows.length} volume(s)</Badge>
              <Badge variant="secondary">{pageAssets.length} pagina(s)</Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {metadata.projectCode || "Projeto sem codigo"}
              {metadata.projectName ? ` - ${metadata.projectName}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleAddRow} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Volume
            </Button>
          </div>
        </CardContent>
      </Card>

      <VolumeMetadataForm metadata={metadata} onChange={setMetadata} />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(320px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,340px)_minmax(340px,420px)_minmax(0,1fr)_minmax(280px,320px)]">
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
            <ImportedFilesPool
              files={importedFiles}
              fileDataMap={fileDataMap}
              onFilesImported={handleFilesImported}
              onRemoveFile={handleRemoveFile}
            />
        </aside>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
            <PageAssetTray
              assets={pageAssets}
              fileDataMap={fileDataMap}
              selectedAssetIds={selectedAssetIds}
              onSelectedAssetIdsChange={setSelectedAssetIds}
              onAssetsChange={setPageAssets}
              onSendToCover={handleSendToCover}
              onSendToLd={handleSendToLd}
              onSendToDocuments={handleSendToDocuments}
            />
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Mesa de montagem</h2>
              <p className="text-xs text-muted-foreground">
                Monte cada volume na ordem visual da esquerda para direita.
              </p>
            </div>
            <Button onClick={handleAddRow} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar volume
            </Button>
          </div>
          <AssemblyWorkspace
            rows={rows}
            pageAssets={pageAssets}
            onUpdateRow={handleUpdateRow}
            onRemoveRow={handleRemoveRow}
          />
        </main>

        <aside className="min-w-0 space-y-4 xl:col-span-3 2xl:col-span-1 2xl:sticky 2xl:top-24 2xl:self-start">
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Conferencia</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="PDFs" value={importedFiles.length} />
                <Metric label="Paginas" value={pageAssets.length} />
                <Metric label="Volumes" value={rows.length} />
              </div>
            </CardContent>
          </Card>

          <AiValidationPanel rows={rows} importedFiles={importedFiles} metadata={metadata} compact />
          <ExportPanel
            rows={rows}
            metadata={metadata}
            importedFiles={importedFiles}
            fileDataMap={fileDataMap}
            compact
          />
          <VolumeStructurePreview rows={rows} metadata={metadata} compact />
        </aside>
      </div>
      </DndContext>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
