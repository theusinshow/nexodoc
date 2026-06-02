"use client";

import type { AssemblyRow, VolumeMetadata } from "@/modules/volume-builder/lib/volume/volume-types";
import { generateOutputFileName } from "@/modules/volume-builder/lib/volume/volume-naming";
import { Card, CardContent } from "@/components/ui/card";

interface NamingPreviewProps {
  rows: AssemblyRow[];
  metadata: VolumeMetadata;
}

export function NamingPreview({ rows, metadata }: NamingPreviewProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Previa de nomeacao
        </p>
        {rows.map((row, index) => {
          const suggested = generateOutputFileName(
            metadata,
            row.blocks.map((b) => b.disciplineCode).filter(Boolean),
            index + 1
          );
          return (
            <div key={row.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{row.title}:</span>
              <span className="font-mono">
                {row.outputFileName || suggested}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
