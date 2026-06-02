"use client";

import type { DragEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import type {
  AssemblySlot,
  AssemblySlotType,
  PageAsset,
} from "@/modules/volume-builder/lib/volume/volume-types";
import { createPageSelectionFromAsset } from "@/modules/volume-builder/lib/volume/page-assets";
import { formatPageSelection } from "@/modules/volume-builder/lib/utils/parse-page-selection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, GripVertical, X } from "lucide-react";

interface AssemblyCellDropZoneProps {
  label: string;
  type: AssemblySlotType;
  dropZoneId: string;
  slot?: AssemblySlot;
  pageAssets: PageAsset[];
  acceptMultiple?: boolean;
  density?: "default" | "compact";
  onAssetsDrop?: (assets: PageAsset[]) => void;
  onSlotChange: (slot: AssemblySlot | undefined) => void;
}

export function AssemblyCellDropZone({
  label,
  type,
  dropZoneId,
  slot,
  pageAssets,
  acceptMultiple = false,
  density = "default",
  onAssetsDrop,
  onSlotChange,
}: AssemblyCellDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropZoneId,
  });

  function getDroppedAssets(event: DragEvent<HTMLDivElement>) {
    const raw = event.dataTransfer.getData("application/x-volume-pages");
    if (!raw) {
      return [];
    }

    try {
      const ids = JSON.parse(raw) as string[];
      return ids
        .map((id) => pageAssets.find((asset) => asset.id === id))
        .filter((asset): asset is PageAsset => Boolean(asset));
    } catch {
      return [];
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const assets = getDroppedAssets(event);
    if (assets.length === 0) {
      return;
    }

    if (acceptMultiple && onAssetsDrop) {
      onAssetsDrop(assets);
      return;
    }

    const asset = assets[0];
    onSlotChange({
      id: `slot-${Date.now()}-${asset.id}`,
      type,
      label,
      selection: createPageSelectionFromAsset(asset),
      warnings: [],
    });
  }

  if (slot?.selection) {
    return (
      <div
        ref={setNodeRef}
        className={`h-full rounded-md border bg-background p-2 transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out ${
          isOver
            ? "scale-[1.015] border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] ring-2 ring-[var(--nexodoc-tertiary)]/25"
            : ""
        }`}
        onDragEnter={(event) => event.preventDefault()}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleDrop}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {slot.type.toUpperCase()}
          </Badge>
        </div>
        <div
          className={`flex gap-2 rounded-md border bg-muted/30 p-2 ${
            density === "compact" ? "h-[92px] flex-col justify-between" : "items-center"
          }`}
        >
          <div
            className={`flex shrink-0 items-center justify-center rounded border bg-background text-[10px] font-medium ${
              density === "compact" ? "h-10 w-8" : "h-12 w-9"
            }`}
          >
            {slot.selection.pages?.[0] ?? slot.selection.startPage ?? 1}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-xs font-medium">{slot.selection.sourceFileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatPageSelection(slot.selection)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-600 hover:text-red-700"
              onClick={() => onSlotChange(undefined)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center rounded-md border border-dashed bg-muted/20 p-2 text-center transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out hover:border-primary/60 hover:bg-primary/5 ${
        density === "compact" ? "h-full min-h-[132px]" : "min-h-[68px]"
      } ${
        isOver
          ? "scale-[1.015] border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] ring-2 ring-[var(--nexodoc-tertiary)]/25"
          : ""
      }`}
      onDragEnter={(event) => event.preventDefault()}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      <div className="space-y-1">
        <FilePlus2 className="mx-auto h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          Arraste {acceptMultiple ? "uma ou mais paginas" : "uma pagina"}
        </p>
      </div>
    </div>
  );
}
