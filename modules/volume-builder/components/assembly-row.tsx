"use client";

import type { AssemblyRow, PageAsset } from "@/modules/volume-builder/lib/volume/volume-types";
import { StatusBadge } from "@/modules/volume-builder/shared/status-badge";
import { AssemblyCellDropZone } from "./assembly-cell-drop-zone";
import { AssemblyBlockCard } from "./assembly-block-card";
import { createEmptyBlock } from "@/modules/volume-builder/lib/volume/assembly-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

interface AssemblyRowProps {
  row: AssemblyRow;
  pageAssets: PageAsset[];
  onUpdate: (row: AssemblyRow) => void;
  onRemove: (rowId: string) => void;
}

export function AssemblyRowComponent({
  row,
  pageAssets,
  onUpdate,
  onRemove,
}: AssemblyRowProps) {
  function handleAddBlock() {
    const newBlock = createEmptyBlock(row.blocks.length + 1);
    onUpdate({ ...row, blocks: [...row.blocks, newBlock] });
  }

  function handleOutputFileNameChange(value: string) {
    onUpdate({ ...row, outputFileName: value });
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-sm font-medium text-muted-foreground">
              {String(row.order).padStart(2, "0")}
            </span>
            <Input
              value={row.outputFileName}
              onChange={(e) => handleOutputFileNameChange(e.target.value)}
              placeholder="nome_final.pdf"
              className="h-8 min-w-0 w-[min(320px,60vw)] text-xs"
            />
            <StatusBadge status={row.status} />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemove(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-md border bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Sequencia do volume
            </p>
            <span className="text-[11px] text-muted-foreground">
              Capa, separatriz, LD e pranchas
            </span>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[132px_minmax(0,1fr)]">
            <AssemblyCellDropZone
              label="Capa"
              type="cover"
              dropZoneId={`cover:${row.id}`}
              slot={row.cover}
              pageAssets={pageAssets}
              density="compact"
              onSlotChange={(slot) => onUpdate({ ...row, cover: slot })}
            />

            <div className="min-w-0 space-y-2">
              {row.blocks.map((block) => (
                <AssemblyBlockCard
                  key={block.id}
                  block={block}
                  pageAssets={pageAssets}
                  onUpdate={(updatedBlock) => {
                    onUpdate({
                      ...row,
                      blocks: row.blocks.map((b) =>
                        b.id === updatedBlock.id ? updatedBlock : b
                      ),
                    });
                  }}
                  onRemove={() => {
                    onUpdate({
                      ...row,
                      blocks: row.blocks.filter((b) => b.id !== block.id),
                    });
                  }}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={handleAddBlock}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar grupo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
