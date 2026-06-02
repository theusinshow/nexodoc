"use client";

import type { AssemblyRow, PageAsset } from "@/modules/volume-builder/lib/volume/volume-types";
import { AssemblyRowComponent } from "./assembly-row";

interface AssemblyTableProps {
  rows: AssemblyRow[];
  pageAssets: PageAsset[];
  onUpdateRow: (row: AssemblyRow) => void;
  onRemoveRow: (rowId: string) => void;
}

export function AssemblyTable({
  rows,
  pageAssets,
  onUpdateRow,
  onRemoveRow,
}: AssemblyTableProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Arraste paginas da bandeja para capa, LD e documentos. A ordem dos documentos segue da esquerda para direita.
        </p>
      </div>
      {rows.map((row) => (
        <AssemblyRowComponent
          key={row.id}
          row={row}
          pageAssets={pageAssets}
          onUpdate={onUpdateRow}
          onRemove={onRemoveRow}
        />
      ))}
    </div>
  );
}
