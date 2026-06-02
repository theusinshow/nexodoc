"use client";

import { useState } from "react";
import type { AssemblyBlock, AssemblySlot, PageAsset } from "@/modules/volume-builder/lib/volume/volume-types";
import { AssemblyCellDropZone } from "./assembly-cell-drop-zone";
import { createPageSelectionFromAsset } from "@/modules/volume-builder/lib/volume/page-assets";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, FileUp, Trash2, X } from "lucide-react";

interface AssemblyBlockCardProps {
  block: AssemblyBlock;
  pageAssets: PageAsset[];
  onUpdate: (block: AssemblyBlock) => void;
  onRemove: () => void;
}

export function AssemblyBlockCard({
  block,
  pageAssets,
  onUpdate,
  onRemove,
}: AssemblyBlockCardProps) {
  const [showCustomSeparator, setShowCustomSeparator] = useState(Boolean(block.separator));

  function createDocumentSlots(assets: PageAsset[]): AssemblySlot[] {
    return assets.map((asset, index) => ({
      id: `doc-${Date.now()}-${asset.id}-${index}`,
      type: "document",
      label: `Doc ${block.documents.length + index + 1}`,
      selection: createPageSelectionFromAsset(asset),
      warnings: [],
    }));
  }

  function moveDocument(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= block.documents.length) {
      return;
    }

    const documents = [...block.documents];
    const [item] = documents.splice(index, 1);
    documents.splice(targetIndex, 0, item);
    onUpdate({ ...block, documents });
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-[minmax(160px,220px)_80px_minmax(220px,1fr)]">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Grupo</p>
            <Input
              value={block.title}
              onChange={(e) => onUpdate({ ...block, title: e.target.value })}
              placeholder="Nome do grupo"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Codigo</p>
            <Input
              value={block.disciplineCode}
              onChange={(e) =>
                onUpdate({ ...block, disciplineCode: e.target.value })
              }
              placeholder="EST"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                Titulo da separatriz
              </p>
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                Automatica
              </Badge>
            </div>
            <Input
              value={block.separatorTitle}
              onChange={(e) => onUpdate({ ...block, separatorTitle: e.target.value })}
              placeholder="PROJETO DE ESTRUTURAS DE CONCRETO"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border bg-background/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Ordem do grupo
          </p>
          <span className="text-[11px] text-muted-foreground">
            Esquerda para direita
          </span>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[132px_minmax(132px,160px)_minmax(280px,1fr)]">
          {showCustomSeparator ? (
            <div className="space-y-1">
              <AssemblyCellDropZone
                label="Separatriz propria"
                type="separator"
                dropZoneId={`separator:${block.id}`}
                slot={block.separator}
                pageAssets={pageAssets}
                density="compact"
                onSlotChange={(slot) => onUpdate({ ...block, separator: slot })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-full px-1 text-[10px]"
                onClick={() => setShowCustomSeparator(false)}
              >
                <X className="mr-1 h-3 w-3" />
                Fechar troca
              </Button>
            </div>
          ) : (
            <AssemblyAutoSeparatorTile
              title={block.separatorTitle}
              custom={Boolean(block.separator)}
              onToggleCustom={() => setShowCustomSeparator(true)}
              onClearCustom={() => onUpdate({ ...block, separator: undefined })}
            />
          )}

          <AssemblyCellDropZone
            label="LD"
            type="ld"
            dropZoneId={`ld:${block.id}`}
            slot={block.ld}
            pageAssets={pageAssets}
            density="compact"
            onSlotChange={(slot) => onUpdate({ ...block, ld: slot })}
          />

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Pranchas</p>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {block.documents.length}
              </Badge>
            </div>
            <div className="flex min-h-[132px] gap-2 overflow-x-auto rounded-md border bg-muted/10 p-2">
              {block.documents.map((doc, index) => (
                <div key={doc.id} className="w-32 shrink-0 space-y-1">
                  <AssemblyCellDropZone
                    label={`P${index + 1}`}
                    type="document"
                    dropZoneId={`document:${block.id}:${index}`}
                    slot={doc}
                    pageAssets={pageAssets}
                    density="compact"
                    onSlotChange={(slot) => {
                      const docs = [...block.documents];
                      if (slot) {
                        docs[index] = slot;
                      } else {
                        docs.splice(index, 1);
                      }
                      onUpdate({ ...block, documents: docs });
                    }}
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => moveDocument(index, -1)}
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === block.documents.length - 1}
                      onClick={() => moveDocument(index, 1)}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="w-32 shrink-0">
                <AssemblyCellDropZone
                  label="Adicionar"
                  type="document"
                  dropZoneId={`documents:${block.id}`}
                  pageAssets={pageAssets}
                  acceptMultiple
                  density="compact"
                  onAssetsDrop={(assets) => {
                    onUpdate({
                      ...block,
                      documents: [...block.documents, ...createDocumentSlots(assets)],
                    });
                  }}
                  onSlotChange={(slot) => {
                    if (!slot) {
                      return;
                    }
                    onUpdate({ ...block, documents: [...block.documents, slot] });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssemblyAutoSeparatorTile({
  title,
  custom,
  onToggleCustom,
  onClearCustom,
}: {
  title: string;
  custom: boolean;
  onToggleCustom: () => void;
  onClearCustom: () => void;
}) {
  return (
    <div className="flex h-full min-h-[132px] flex-col justify-between rounded-md border border-[var(--nexodoc-tertiary-strong)]/45 bg-[var(--nexodoc-tertiary-bg)] p-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs font-medium text-[var(--nexodoc-tertiary)]">
          Separatriz
        </p>
        <Badge
          variant="outline"
          className="h-5 border-[var(--nexodoc-tertiary-strong)]/50 px-1.5 text-[9px] text-[var(--nexodoc-tertiary)]"
        >
          Auto
        </Badge>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="flex h-12 w-9 items-center justify-center rounded-sm border border-[var(--nexodoc-tertiary-strong)]/35 bg-background/80">
          <FileText className="h-4 w-4 text-[var(--nexodoc-tertiary)]" />
        </div>
        <p className="line-clamp-3 text-[10px] font-semibold uppercase leading-snug">
          {custom ? "PDF proprio selecionado" : title || "Separatriz automatica"}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-1 text-[10px]"
        onClick={custom ? onClearCustom : onToggleCustom}
      >
        {custom ? (
          <>
            <X className="mr-1 h-3 w-3" />
            Usar automatica
          </>
        ) : (
          <>
            <FileUp className="mr-1 h-3 w-3" />
            Trocar PDF
          </>
        )}
      </Button>
    </div>
  );
}
