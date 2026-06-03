"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Document, Page, pdfjs } from "react-pdf";
import type { PageAsset, PageAssetRole } from "@/modules/volume-builder/lib/volume/volume-types";
import { classifyPageAsset } from "@/modules/volume-builder/lib/volume/page-classification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  FileStack,
  GripVertical,
  Layers3,
  Maximize2,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/nexodoc-pdf-engine.mjs";

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
  const [activeDiscipline, setActiveDiscipline] = useState<string>("all");
  const [activeBlock, setActiveBlock] = useState<string>("all");
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [zoomedAssetId, setZoomedAssetId] = useState<string | null>(null);
  const [fileObjectUrls, setFileObjectUrls] = useState<Map<string, string>>(new Map());
  const [failedPdfFileIds, setFailedPdfFileIds] = useState<Set<string>>(new Set());

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
        count: assets.filter((asset) => getAssetRole(asset) === role.value).length,
      })),
    [assets]
  );

  const disciplineCounts = useMemo(() => getFacetCounts(assets, "disciplineCode"), [assets]);
  const blockCounts = useMemo(() => getFacetCounts(assets, "blockCode"), [assets]);

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
      const matchesRole = activeRole === "all" || getAssetRole(asset) === activeRole;
      const matchesDiscipline =
        activeDiscipline === "all" || asset.classification?.disciplineCode === activeDiscipline;
      const matchesBlock = activeBlock === "all" || asset.classification?.blockCode === activeBlock;
      const matchesReview =
        !showReviewOnly ||
        !asset.classification ||
        asset.classification.confidence < 0.72 ||
        asset.classification.warnings.length > 0;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        asset.sourceFileName.toLowerCase().includes(normalizedQuery) ||
        asset.summary?.toLowerCase().includes(normalizedQuery) ||
        asset.classification?.documentCode?.toLowerCase().includes(normalizedQuery) ||
        asset.classification?.blockCode?.toLowerCase().includes(normalizedQuery) ||
        asset.classification?.disciplineCode?.toLowerCase().includes(normalizedQuery) ||
        String(asset.pageNumber).includes(normalizedQuery);

      return (
        matchesFile &&
        matchesRole &&
        matchesDiscipline &&
        matchesBlock &&
        matchesReview &&
        matchesQuery
      );
    });
  }, [activeBlock, activeDiscipline, activeFileId, activeRole, assets, query, showReviewOnly]);

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
      fileUrl: fileObjectUrls.get(fileId),
    }));
  }, [fileDataMap, fileObjectUrls, filteredAssets]);

  useEffect(() => {
    const nextUrls = new Map<string, string>();

    for (const asset of assets) {
      const file = fileDataMap.get(asset.sourceFileId);
      if (file && !nextUrls.has(asset.sourceFileId)) {
        nextUrls.set(asset.sourceFileId, URL.createObjectURL(file));
      }
    }

    setFileObjectUrls(nextUrls);

    return () => {
      for (const url of nextUrls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [assets, fileDataMap]);

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
              const nextAsset = nextAssets[index];
              const classification = classifyPageAsset({
                fileName: nextAsset.sourceFileName,
                pageNumber: nextAsset.pageNumber,
                currentRole: nextAsset.role,
                summary,
                previous: nextAsset.classification,
              });
              nextAssets[index] = {
                ...nextAsset,
                summary,
                role: classification.role === "unknown" ? nextAsset.role : classification.role,
                classification,
              };
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
    <Card className="flex max-h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0 space-y-3 pb-3">
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

        <div className="rounded-md border bg-muted/20 px-2 py-1.5">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Clique para selecionar. Use Shift para intervalo ou Ctrl para varias paginas.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${
              activeRole === "all"
                ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                : ""
            }`}
            onClick={() => setActiveRole("all")}
          >
            Todos
          </Button>
          {roleCounts.map((role) => (
            <Button
              key={role.value}
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 px-2 text-xs ${
                activeRole === role.value
                  ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                  : ""
              }`}
              onClick={() => setActiveRole(role.value)}
            >
              {role.label}
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {role.count}
              </Badge>
            </Button>
          ))}
        </div>

        {(disciplineCounts.length > 0 || blockCounts.length > 0) && (
          <div className="space-y-2 rounded-md border bg-muted/15 p-2">
            {disciplineCounts.length > 0 && (
              <FacetButtons
                label="Disciplina"
                activeValue={activeDiscipline}
                options={disciplineCounts}
                onChange={setActiveDiscipline}
              />
            )}
            {blockCounts.length > 0 && (
              <FacetButtons
                label="Bloco"
                activeValue={activeBlock}
                options={blockCounts}
                onChange={setActiveBlock}
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 px-2 text-xs ${
                showReviewOnly
                  ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                  : ""
              }`}
              onClick={() => setShowReviewOnly((current) => !current)}
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              Revisar baixa confianca
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${
              activeFileId === "all"
                ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                : ""
            }`}
            onClick={() => setActiveFileId("all")}
          >
            Todos
          </Button>
          {files.map((file) => (
            <Button
              key={file.id}
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 max-w-full px-2 text-xs ${
                activeFileId === file.id
                  ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                  : ""
              }`}
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

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-hidden">
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
          <div className="max-h-[calc(100vh-360px)] space-y-5 overflow-y-auto pr-1">
            {groupedAssets.map((group) => (
              <div key={group.fileId} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium">{group.fileName}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {group.assets.length} pag.
                  </span>
                </div>

                {group.file ? (
                  failedPdfFileIds.has(group.fileId) && group.fileUrl ? (
                    <>
                      <NativePdfFallbackNotice />
                      {group.assets.map((asset) =>
                        asset.id === zoomedAssetId ? (
                          <PageZoomOverlay
                            key={`zoom-${asset.id}`}
                            asset={asset}
                            nativePreviewUrl={group.fileUrl}
                            onClose={() => setZoomedAssetId(null)}
                          />
                        ) : null
                      )}
                      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-3">
                        {group.assets.map((asset) => {
                          const selected = selectedAssetIds.includes(asset.id);
                          return (
                            <PageAssetTile
                              key={asset.id}
                              asset={asset}
                              selected={selected}
                              nativePreviewUrl={group.fileUrl}
                              onSelect={selectAsset}
                              onNativeDragStart={handleDragStart}
                              onOpenZoom={() => setZoomedAssetId(asset.id)}
                            />
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Document
                      key={group.fileId}
                      file={group.fileUrl ?? group.file}
                      loading={<TraySkeleton />}
                      onLoadSuccess={() => {
                        setFailedPdfFileIds((current) => {
                          if (!current.has(group.fileId)) return current;
                          const next = new Set(current);
                          next.delete(group.fileId);
                          return next;
                        });
                      }}
                      onLoadError={(error) => {
                        console.error(`Erro ao carregar miniaturas de ${group.fileName}:`, error);
                        setFailedPdfFileIds((current) => new Set(current).add(group.fileId));
                      }}
                      error={
                        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                          Nao foi possivel carregar as miniaturas deste PDF.
                        </div>
                      }
                    >
                      {group.assets.map((asset) => (
                        asset.id === zoomedAssetId ? (
                        <PageZoomOverlay
                          key={`zoom-${asset.id}`}
                          asset={asset}
                          onClose={() => setZoomedAssetId(null)}
                        />
                        ) : null
                      ))}
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
                              onOpenZoom={() => setZoomedAssetId(asset.id)}
                            />
                          );
                        })}
                      </div>
                    </Document>
                  )
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

function getFacetCounts(assets: PageAsset[], field: "disciplineCode" | "blockCode") {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    const value = asset.classification?.[field];
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

function getAssetRole(asset: PageAsset): PageAssetRole {
  return asset.classification?.role && asset.classification.role !== "unknown"
    ? asset.classification.role
    : asset.role ?? "document";
}

function FacetButtons({
  label,
  activeValue,
  options,
  onChange,
}: {
  label: string;
  activeValue: string;
  options: Array<{ value: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`h-7 px-2 text-xs ${
            activeValue === "all"
              ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
              : ""
          }`}
          onClick={() => onChange("all")}
        >
          Todos
        </Button>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${
              activeValue === option.value
                ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]"
                : ""
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.value}
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {option.count}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}

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

function NativePdfFallbackNotice() {
  return (
    <div className="mb-2 rounded-md border border-[var(--nexodoc-tertiary-strong)]/35 bg-[var(--nexodoc-tertiary-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--nexodoc-tertiary)]">
      Preview alternativo ativado para este PDF.
    </div>
  );
}

function PageAssetTile({
  asset,
  selected,
  onSelect,
  onNativeDragStart,
  onOpenZoom,
  nativePreviewUrl,
}: {
  asset: PageAsset;
  selected: boolean;
  onSelect: (asset: PageAsset, event: MouseEvent<HTMLDivElement>) => void;
  onNativeDragStart: (asset: PageAsset, event: DragEvent<HTMLDivElement>) => void;
  onOpenZoom: () => void;
  nativePreviewUrl?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asset.id,
    data: { type: "page-asset", asset },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };
  const classification = asset.classification;
  const role = getAssetRole(asset);
  const confidence = classification?.confidence ?? 0;
  const classificationLine = [
    classification?.disciplineCode,
    classification?.blockCode ? `Bloco ${classification.blockCode}` : undefined,
    classification?.revision ? `Rev. ${classification.revision}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      draggable
      onClick={(event) => onSelect(asset, event)}
      onDragStart={(event) => onNativeDragStart(asset, event)}
      className={`group relative cursor-grab touch-none overflow-hidden rounded-md border bg-background text-left transition-[border-color,box-shadow,transform,background-color,opacity] duration-200 ease-out active:cursor-grabbing active:scale-[0.985] ${
        selected
          ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] ring-2 ring-[var(--nexodoc-tertiary)]/25 shadow-[0_0_0_1px_rgb(255_181_158_/_0.12)]"
          : "border-border hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_8px_24px_rgb(0_0_0_/_0.28)]"
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex aspect-[3/4] items-center justify-center bg-muted/40">
        <button
          type="button"
          title="Ampliar miniatura"
          aria-label={`Ampliar pagina ${asset.pageNumber}`}
          className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:border-[var(--nexodoc-tertiary-strong)] hover:text-[var(--nexodoc-tertiary)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onOpenZoom();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => event.preventDefault()}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        {nativePreviewUrl ? (
          <NativePdfPageFrame
            src={nativePreviewUrl}
            pageNumber={asset.pageNumber}
            className="h-full w-full"
          />
        ) : (
          <Page
            pageNumber={asset.pageNumber}
            width={148}
            loading={<TraySkeleton compact />}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        )}
      </div>
      {isDragging && (
        <div className="absolute inset-0 border-2 border-[var(--nexodoc-tertiary)] bg-[var(--nexodoc-tertiary-bg)]" />
      )}
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
              {ROLE_LABELS[role]}
            </Badge>
            {classification && (
              <Badge
                variant="outline"
                className={`h-4 px-1 text-[9px] ${
                  confidence >= 0.72
                    ? "border-[var(--status-ok)]/35 text-[var(--status-ok)]"
                    : "border-[var(--nexodoc-tertiary-strong)]/50 text-[var(--nexodoc-tertiary)]"
                }`}
              >
                {Math.round(confidence * 100)}%
              </Badge>
            )}
            <GripVertical
              className={`h-3 w-3 opacity-70 ${
                selected ? "text-[var(--nexodoc-tertiary)]" : "text-muted-foreground"
              }`}
            />
          </div>
        </div>
        {classificationLine && (
          <p className="truncate text-[10px] font-semibold text-[var(--nexodoc-tertiary)]">
            {classificationLine}
          </p>
        )}
        {classification?.documentCode && (
          <p className="truncate font-mono text-[10px] text-foreground">
            {classification.documentCode}
          </p>
        )}
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

function PageZoomOverlay({
  asset,
  nativePreviewUrl,
  onClose,
}: {
  asset: PageAsset;
  nativePreviewUrl?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [baseWidth, setBaseWidth] = useState(760);
  const role = getAssetRole(asset);

  useEffect(() => {
    function updateWidth() {
      setBaseWidth(Math.min(860, Math.max(360, window.innerWidth - 96)));
    }

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const pageWidth = Math.round(baseWidth * zoom);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Miniatura ampliada da pagina ${asset.pageNumber}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-border bg-[var(--nexodoc-panel)] shadow-[0_24px_90px_rgb(0_0_0_/_0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {ROLE_LABELS[role]}
              </Badge>
              <span className="text-xs font-semibold">Pag. {asset.pageNumber}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {asset.sourceFileName}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Reduzir"
              onClick={() => setZoom((current) => Math.max(0.75, Number((current - 0.15).toFixed(2))))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs tabular-nums"
              title="Ajustar"
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="mr-1 h-3.5 w-3.5" />
              {Math.round(zoom * 100)}%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Ampliar"
              onClick={() => setZoom((current) => Math.min(1.8, Number((current + 0.15).toFixed(2))))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Fechar"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 overflow-auto bg-muted/25 p-4">
          <div className="mx-auto w-fit overflow-hidden rounded-sm border bg-white shadow-[0_18px_50px_rgb(0_0_0_/_0.35)]">
            {nativePreviewUrl ? (
              <NativePdfPageFrame
                src={nativePreviewUrl}
                pageNumber={asset.pageNumber}
                className="h-[78vh]"
                style={{ width: pageWidth }}
              />
            ) : (
              <Page
                pageNumber={asset.pageNumber}
                width={pageWidth}
                loading={<TraySkeleton />}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NativePdfPageFrame({
  src,
  pageNumber,
  className,
  style,
}: {
  src: string;
  pageNumber: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <iframe
      title={`Preview da pagina ${pageNumber}`}
      src={`${src}#page=${pageNumber}&zoom=page-fit&toolbar=0&navpanes=0&scrollbar=0`}
      className={`pointer-events-none block border-0 bg-white ${className ?? ""}`}
      style={style}
    />
  );
}
