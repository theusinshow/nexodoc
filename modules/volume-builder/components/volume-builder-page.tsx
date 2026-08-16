"use client";

import { useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type {
  AssemblyRow,
  AssemblySlot,
  ImportedPdfFile,
  PageAsset,
  VolumeMetadata,
} from "@/modules/volume-builder/lib/volume/volume-types";
import type { AssemblySuggestion } from "@/modules/volume-builder/lib/volume/assembly-suggestion-types";
import { plural } from "@/lib/plural";
import { createEmptyBlock, createEmptyRow } from "@/modules/volume-builder/lib/volume/assembly-builder";
import { createPageAssetsForFile, createPageSelectionFromAsset } from "@/modules/volume-builder/lib/volume/page-assets";
import { VolumeMetadataForm } from "./volume-metadata-form";
import { ImportedFilesPool } from "./imported-files-pool";
import { PageAssetTray } from "./page-asset-tray";
import { AssemblyWorkspace } from "./assembly-workspace";
import { AssemblySuggestionPanel } from "./assembly-suggestion-panel";
import { VolumeStructurePreview } from "./volume-structure-preview";
import { AiValidationPanel } from "./ai-validation-panel";
import { ExportPanel } from "./export-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleDot, FileSearch, FileStack, Layers3, Plus, Upload } from "lucide-react";
import type { ProjectContext } from "@/lib/project-context";

export function VolumeBuilderPage({
  projectId,
  projectContext,
}: {
  projectId?: string;
  projectContext?: ProjectContext | null;
}) {
  const [metadata, setMetadata] = useState<VolumeMetadata>({
    projectCode: projectContext?.code ?? "",
    projectName: projectContext?.name ?? "",
  });
  const [importedFiles, setImportedFiles] = useState<ImportedPdfFile[]>([]);
  const [pageAssets, setPageAssets] = useState<PageAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [fileDataMap, setFileDataMap] = useState<Map<string, File>>(new Map());
  const [rows, setRows] = useState<AssemblyRow[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [activeDragAssets, setActiveDragAssets] = useState<PageAsset[]>([]);
  const operationalStages = [
    {
      id: "import",
      label: "Importar",
      detail: `${importedFiles.length} PDF(s)`,
      state: importedFiles.length > 0 ? "done" : "current",
    },
    {
      id: "classify",
      label: "Classificar",
      detail: `${plural(pageAssets.length, "página", "páginas")}`,
      state: importedFiles.length === 0 ? "pending" : pageAssets.length > 0 ? "done" : "current",
    },
    {
      id: "assemble",
      label: "Montar",
      detail: `${plural(rows.length, "volume", "volumes")}`,
      state: pageAssets.length === 0 ? "pending" : rows.length > 0 ? "done" : "current",
    },
    {
      id: "export",
      label: "Exportar",
      detail: rows.length > 0 ? "pronto para revisar" : "aguardando montagem",
      state: rows.length > 0 ? "current" : "pending",
    },
  ] as const;
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

  function handleApplySuggestion(suggestion: AssemblySuggestion) {
    const coverAsset = suggestion.coverAssetId
      ? pageAssets.find((asset) => asset.id === suggestion.coverAssetId)
      : undefined;
    const ldAsset = suggestion.ldAssetId
      ? pageAssets.find((asset) => asset.id === suggestion.ldAssetId)
      : undefined;
    const documentAssets = suggestion.documentAssetIds
      .map((id) => pageAssets.find((asset) => asset.id === id))
      .filter((asset): asset is PageAsset => Boolean(asset));

    const row = createEmptyRow(rows.length + 1);
    const block = createEmptyBlock(1);

    setRows((currentRows) => [
      ...currentRows,
      {
        ...row,
        title: suggestion.title || row.title,
        outputFileName: suggestion.outputFileName || row.outputFileName,
        cover: coverAsset ? createSlotFromAsset(coverAsset, "cover", "Capa") : undefined,
        blocks: [
          {
            ...block,
            title: suggestion.title || block.title,
            separatorTitle: suggestion.separatorTitle || block.separatorTitle,
            ld: ldAsset ? createSlotFromAsset(ldAsset, "ld", "LD") : undefined,
            documents: documentAssets.map((asset, index) =>
              createSlotFromAsset(asset, "document", `Doc ${index + 1}`)
            ),
          },
        ],
      },
    ]);
  }

  function getDraggedAssets(activeId: string) {
    const ids = selectedAssetIds.includes(activeId) ? selectedAssetIds : [activeId];
    return ids
      .map((id) => pageAssets.find((asset) => asset.id === id))
      .filter((asset): asset is PageAsset => Boolean(asset));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragAssets(getDraggedAssets(String(event.active.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragAssets([]);
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

    if (files.length > 0) {
      setShowUploadPanel(false);
    }
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
    <div className="flex max-h-[calc(100vh-16px)] max-w-full flex-col gap-3 overflow-hidden">
      <Card className="shrink-0 border bg-background/95">
        <CardContent className="grid gap-3 py-3 xl:grid-cols-[minmax(220px,1fr)_minmax(520px,1.45fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">Montagem de volumes</h1>
              <Badge variant="outline">{plural(rows.length, "volume", "volumes")}</Badge>
              <Badge variant="secondary">{plural(pageAssets.length, "página", "páginas")}</Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {metadata.projectCode || "Projeto sem codigo"}
              {metadata.projectName ? ` - ${metadata.projectName}` : ""}
            </p>
          </div>

          <OperationalStageStrip stages={operationalStages} />

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button onClick={handleAddRow} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Volume
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="shrink-0">
        <VolumeMetadataForm metadata={metadata} onChange={setMetadata} />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveDragAssets([])}
        onDragEnd={handleDragEnd}
      >
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden ${
          showUploadPanel
            ? "xl:grid-cols-[minmax(240px,280px)_minmax(300px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(240px,280px)_minmax(320px,380px)_minmax(0,1fr)_minmax(260px,300px)]"
            : "xl:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,390px)_minmax(0,1fr)_minmax(260px,300px)]"
        }`}
      >
        {showUploadPanel && (
        <aside className="min-h-0 min-w-0 overflow-y-auto pr-1">
            <ImportedFilesPool
              files={importedFiles}
              fileDataMap={fileDataMap}
              onFilesImported={handleFilesImported}
              onRemoveFile={handleRemoveFile}
              onCollapse={() => setShowUploadPanel(false)}
            />
        </aside>
        )}

        <aside className="min-h-0 min-w-0 space-y-3 overflow-y-auto pr-1">
            {!showUploadPanel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start text-xs"
                onClick={() => setShowUploadPanel(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Mostrar upload
              </Button>
            )}
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

        <main className="min-h-0 min-w-0 space-y-3 overflow-y-auto pr-1">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 pb-2">
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
          <AssemblySuggestionPanel
            metadata={metadata}
            importedFiles={importedFiles}
            pageAssets={pageAssets}
            onApplySuggestion={handleApplySuggestion}
          />
          <AssemblyWorkspace
            rows={rows}
            pageAssets={pageAssets}
            onUpdateRow={handleUpdateRow}
            onRemoveRow={handleRemoveRow}
          />
        </main>

        <aside
          className={`min-h-0 min-w-0 space-y-3 overflow-y-auto pr-1 ${
            showUploadPanel ? "xl:col-span-3 2xl:col-span-1" : "xl:col-span-2 2xl:col-span-1"
          }`}
        >
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
            projectId={projectId}
            compact
          />
          <VolumeStructurePreview rows={rows} metadata={metadata} compact />
        </aside>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activeDragAssets.length > 0 ? (
          <DragPreview assets={activeDragAssets} />
        ) : null}
      </DragOverlay>
      </DndContext>
    </div>
  );
}

function OperationalStageStrip({
  stages,
}: {
  stages: ReadonlyArray<{
    id: string;
    label: string;
    detail: string;
    state: "done" | "current" | "pending";
  }>;
}) {
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border text-xs lg:grid-cols-4">
      {stages.map((stage) => {
        const isDone = stage.state === "done";
        const isCurrent = stage.state === "current";

        return (
          <li
            key={stage.id}
            className={`min-w-0 bg-card px-3 py-2 ${
              isCurrent ? "ring-1 ring-inset ring-primary/45" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--status-ok)]" />
              ) : isCurrent ? (
                <CircleDot className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <FileSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              )}
              <span
                className={`truncate font-medium ${
                  stage.state === "pending" ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {stage.label}
              </span>
            </div>
            <p className="mt-1 truncate pl-5 font-mono text-[11px] text-muted-foreground">
              {stage.detail}
            </p>
          </li>
        );
      })}
    </ol>
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

function DragPreview({ assets }: { assets: PageAsset[] }) {
  const first = assets[0];

  return (
    <div className="pointer-events-none w-56 rounded-md border border-[var(--nexodoc-tertiary-strong)]/60 bg-[var(--nexodoc-panel)] p-2 shadow-[0_14px_42px_rgb(0_0_0_/_0.45)] ring-2 ring-[var(--nexodoc-tertiary)]/20">
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-sm border bg-[var(--nexodoc-recessed)] text-xs font-semibold text-[var(--nexodoc-tertiary)]">
          {first?.pageNumber ?? 1}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            {assets.length > 1 ? `${assets.length} paginas selecionadas` : first?.sourceFileName}
          </p>
          <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
            {assets.length > 1
              ? "Solte na capa, LD ou trilho de pranchas."
              : first?.summary ?? "Solte na area desejada."}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--nexodoc-tertiary)]">
        <FileStack className="h-3 w-3" />
        Arrastando
      </div>
    </div>
  );
}
