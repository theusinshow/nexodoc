"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Document, Page, pdfjs } from "react-pdf";
import type { PageAsset, PageAssetRole } from "@/modules/volume-builder/lib/volume/volume-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileStack, GripVertical, Layers3, Search, X } from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PageAssetTrayProps {
  assets: PageAsset[];
  fileDataMap: Map<string, File>;
  selectedAssetIds: string[];
  onSelectedAssetIdsChange: (ids: string[]) => void;
  onAssetsChange: (assets: PageAsset[]) => void;
  onSendToCover: (asset: PageAsset) => void;
  onSendToLd: (asset: PageAsset) => void;
  onSendToDocuments: (assets: PageAsset[]) => void;
}

export default function PageAssetTrayInternal({
  assets,
  fileDataMap,
  selectedAssetIds,
  onSelectedAssetIdsChange,
  onAssetsChange,
  onSendToCover,
  onSendToLd,
  onSendToDocuments,
}: PageAssetTrayProps) {
  const [query, setQuery] = useState("");
  const [activeFileId, setActiveFileId] = useState<string>("all");
  const [activeRole, setActiveRole] = useState<PageAssetRole | "all">("all");
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const files = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const asset of assets) {
      const current = map.get(asset.sourceFileId);
      map.set(asset.sourceFileId, {
        id: asset.sourceFileId,
        name: asset.sourceFileName,
        count: (current?.count ?? 0) + 1,
      });
    }
    return Array.from(map.values());
  }, [assets]);

  const roleCounts = useMemo(
    () =>
      ROLE_OPTIONS.map((role) => ({
        ...role,
        count: assets.filter((asset) => asset.role === role.value).length,
      })),
    [assets]
  );

  const selectedAssets = useMemo(
    () =>
      selectedAssetIds
        .map((id) => assets.find((asset) => asset.id === id))
        .filter((asset): asset is PageAsset => Boolean(asset)),
    [assets, selectedAssetIds]
  );

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesFile = activeFileId === "all" || asset.sourceFileId === activeFileId;
      const matchesRole = activeRole === "all" || asset.role === activeRole;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        asset.sourceFileName.toLowerCase().includes(normalizedQuery) ||
        asset.summary?.toLowerCase().includes(normalizedQuery) ||
        String(asset.pageNumber).includes(normalizedQuery);

      return matchesFile && matchesRole && matchesQuery;
    });
  }, [activeFileId, activeRole, assets, query]);

  const groupedAssets = useMemo(() => {
    const map = new Map<string, PageAsset[]>();
    for (const asset of filteredAssets) {
      const group = map.get(asset.sourceFileId) ?? [];
      group.push(asset);
      map.set(asset.sourceFileId, group);
    }
    return Array.from(map.entries()).map(([fileId, group]) => ({
      fileId,
      fileName: group[0]?.sourceFileName ?? "PDF",
      assets: group,
      file: fileDataMap.get(fileId),
    }));
  }, [fileDataMap, filteredAssets]);

  useEffect(() => {
    const pendingFileIds = new Set(
      assets.filter((asset) => !asset.summary).map((asset) => asset.sourceFileId)
    );

    if (pendingFileIds.size === 0) {
      return;
    }

    let cancelled = false;

    async function readSummaries() {
      const nextAssets = [...assets];
      let changed = false;

      for (const fileId of pendingFileIds) {
        const file = fileDataMap.get(fileId);
        if (!file) {
          continue;
        }

        try {
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buffer }).promise;
          const pages = nextAssets.filter((asset) => asset.sourceFileId === fileId);

          for (const asset of pages) {
            if (asset.summary) {
              continue;
            }

            const page = await pdf.getPage(asset.pageNumber);
            const textContent = await page.getTextContent();
            const text = textContent.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            const summary = text.length > 0 ? text.slice(0, 72) : `Pagina ${asset.pageNumber}`;
            const index = nextAssets.findIndex((item) => item.id === asset.id);

            if (index >= 0) {
              nextAssets[index] = { ...nextAssets[index], summary };
              changed = true;
            }
          }
        } catch {
          for (let index = 0; index < nextAssets.length; index++) {
            const asset = nextAssets[index];
            if (asset.sourceFileId === fileId && !asset.summary) {
              nextAssets[index] = { ...asset, summary: `Pagina ${asset.pageNumber}` };
              changed = true;
            }
          }
        }
      }

      if (!cancelled && changed) {
        onAssetsChange(nextAssets);
      }
    }

    void readSummaries();

    return () => {
      cancelled = true;
    };
  }, [assets, fileDataMap, onAssetsChange]);

  function selectAsset(asset: PageAsset, event: MouseEvent<HTMLDivElement>) {
    if (event.shiftKey && lastSelectedId) {
      const lastAsset = assets.find((item) => item.id === lastSelectedId);
      if (lastAsset?.sourceFileId === asset.sourceFileId) {
        const sameFileAssets = assets.filter((item) => item.sourceFileId === asset.sourceFileId);
        const start = sameFileAssets.findIndex((item) => item.id === lastSelectedId);
        const end = sameFileAssets.findIndex((item) => item.id === asset.id);
        if (start >= 0 && end >= 0) {
          const [from, to] = [Math.min(start, end), Math.max(start, end)];
          const rangeIds = sameFileAssets.slice(from, to + 1).map((item) => item.id);
          onSelectedAssetIdsChange(Array.from(new Set([...selectedAssetIds, ...rangeIds])));
          return;
        }
      }
    }

    setLastSelectedId(asset.id);
    if (event.ctrlKey || event.metaKey) {
      onSelectedAssetIdsChange(
        selectedAssetIds.includes(asset.id)
          ? selectedAssetIds.filter((id) => id !== asset.id)
          : [...selectedAssetIds, asset.id]
      );
      return;
    }

    onSelectedAssetIdsChange([asset.id]);
  }

  function handleDragStart(asset: PageAsset, event: DragEvent<HTMLDivElement>) {
    const ids = selectedAssetIds.includes(asset.id) ? selectedAssetIds : [asset.id];
    event.dataTransfer.setData("application/x-volume-pages", JSON.stringify(ids));
    event.dataTransfer.setData("text/plain", ids.join(","));
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-4 w-4" />
            Bandeja de paginas
          </CardTitle>
          <Badge variant="secondary">{assets.length}</Badge>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar arquivo, pagina ou texto lido"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant={activeRole === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setActiveRole("all")}
          >
            Todos
          </Button>
          {roleCounts.map((role) => (
            <Button
              key={role.value}
              type="button"
              variant={activeRole === role.value ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveRole(role.value)}
            >
              {role.label}
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {role.count}
              </Badge>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t pt-3">
          <Button
            type="button"
            variant={activeFileId === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setActiveFileId("all")}
          >
            Todos
          </Button>
          {files.map((file) => (
            <Button
              key={file.id}
              type="button"
              variant={activeFileId === file.id ? "default" : "outline"}
              size="sm"
              className="h-7 max-w-full px-2 text-xs"
              onClick={() => setActiveFileId(file.id)}
            >
              <span className="truncate">{file.name}</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {file.count}
              </Badge>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {selectedAssetIds.length > 0 && (
          <div className="space-y-2 rounded-md border border-[var(--nexodoc-tertiary-strong)]/45 bg-[var(--nexodoc-tertiary-bg)] p-2 shadow-[inset_0_0_0_1px_rgb(255_181_158_/_0.08)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--nexodoc-tertiary)]">
                {selectedAssetIds.length} pagina(s) selecionada(s)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onSelectedAssetIdsChange([])}
              >
                <X className="mr-1 h-3 w-3" />
                Limpar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={selectedAssets.length === 0}
                onClick={() => {
                  if (selectedAssets[0]) {
                    onSendToCover(selectedAssets[0]);
                  }
                }}
              >
                Enviar capa
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={selectedAssets.length === 0}
                onClick={() => {
                  if (selectedAssets[0]) {
                    onSendToLd(selectedAssets[0]);
                  }
                }}
              >
                Enviar LD
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={selectedAssets.length === 0}
                onClick={() => onSendToDocuments(selectedAssets)}
              >
                Enviar docs
              </Button>
            </div>
          </div>
        )}

        {assets.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <FileStack className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              Importe PDFs para destrinchar as paginas.
            </p>
          </div>
        ) : (
          <div className="max-h-[760px] space-y-5 overflow-y-auto pr-1">
            {groupedAssets.map((group) => (
              <div key={group.fileId} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium">{group.fileName}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {group.assets.length} pag.
                  </span>
                </div>

                {group.file ? (
                  <Document file={group.file} loading={<TraySkeleton />}>
                    <div className="grid grid-cols-2 gap-2 2xl:grid-cols-3">
                      {group.assets.map((asset) => {
                        const selected = selectedAssetIds.includes(asset.id);
                        return (
                          <PageAssetTile
                            key={asset.id}
                            asset={asset}
                            selected={selected}
                            onSelect={selectAsset}
                            onNativeDragStart={handleDragStart}
                          />
                        );
                      })}
                    </div>
                  </Document>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Arquivo original indisponivel.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ROLE_OPTIONS: Array<{ value: PageAssetRole; label: string }> = [
  { value: "cover", label: "Capas" },
  { value: "ld", label: "LDs" },
  { value: "separator", label: "Separatrizes" },
  { value: "document", label: "Pranchas" },
  { value: "appendix", label: "Anexos" },
];

const ROLE_LABELS: Record<PageAssetRole, string> = {
  cover: "Capa",
  ld: "LD",
  separator: "Sep.",
  document: "Prancha",
  appendix: "Anexo",
};

function TraySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center bg-muted ${
        compact ? "h-24 w-20" : "h-28 w-full"
      }`}
    >
      <div className="h-4 w-4 animate-pulse rounded-full bg-muted-foreground/20" />
    </div>
  );
}

function PageAssetTile({
  asset,
  selected,
  onSelect,
  onNativeDragStart,
}: {
  asset: PageAsset;
  selected: boolean;
  onSelect: (asset: PageAsset, event: MouseEvent<HTMLDivElement>) => void;
  onNativeDragStart: (asset: PageAsset, event: DragEvent<HTMLDivElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asset.id,
    data: { type: "page-asset", asset },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      draggable
      onClick={(event) => onSelect(asset, event)}
      onDragStart={(event) => onNativeDragStart(asset, event)}
      className={`group relative cursor-grab touch-none overflow-hidden rounded-md border bg-background text-left transition active:cursor-grabbing ${
        selected
          ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] ring-2 ring-[var(--nexodoc-tertiary)]/25 shadow-[0_0_0_1px_rgb(255_181_158_/_0.12)]"
          : "border-border hover:border-primary/60"
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex aspect-[3/4] items-center justify-center bg-muted/40">
        <Page
          pageNumber={asset.pageNumber}
          width={148}
          loading={<TraySkeleton compact />}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </div>
      <div
        className={`space-y-1 border-t px-2 py-1.5 ${
          selected
            ? "border-[var(--nexodoc-tertiary-strong)]/45 bg-[var(--nexodoc-tertiary-bg)]"
            : "bg-background/95"
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-medium">Pag. {asset.pageNumber}</span>
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={`h-4 px-1 text-[9px] ${
                selected
                  ? "border-[var(--nexodoc-tertiary-strong)]/60 text-[var(--nexodoc-tertiary)]"
                  : ""
              }`}
            >
              {ROLE_LABELS[asset.role ?? "document"]}
            </Badge>
            <GripVertical
              className={`h-3 w-3 opacity-70 ${
                selected ? "text-[var(--nexodoc-tertiary)]" : "text-muted-foreground"
              }`}
            />
          </div>
        </div>
        <p
          className={`line-clamp-2 min-h-7 text-[10px] leading-snug ${
            selected ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {asset.summary ?? "Lendo texto da pagina..."}
        </p>
      </div>
    </div>
  );
}
