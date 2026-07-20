"use client";

import type { AssemblyRow, PageAsset } from "@/modules/volume-builder/lib/volume/volume-types";
import { AssemblyTable } from "./assembly-table";

interface AssemblyWorkspaceProps {
  rows: AssemblyRow[];
  pageAssets: PageAsset[];
  onUpdateRow: (row: AssemblyRow) => void;
  onRemoveRow: (rowId: string) => void;
}

export function AssemblyWorkspace({
  rows,
  pageAssets,
  onUpdateRow,
  onRemoveRow,
}: AssemblyWorkspaceProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma linha de montagem criada.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Clique em &quot;+ Adicionar linha&quot; para comecar.
        </p>
      </div>
    );
  }

  return (
    <AssemblyTable
      rows={rows}
      pageAssets={pageAssets}
      onUpdateRow={onUpdateRow}
      onRemoveRow={onRemoveRow}
    />
  );
}
