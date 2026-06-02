"use client";

import type { AssemblyRow, VolumeMetadata } from "@/modules/volume-builder/lib/volume/volume-types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface VolumeStructurePreviewProps {
  rows: AssemblyRow[];
  metadata: VolumeMetadata;
  compact?: boolean;
}

export function VolumeStructurePreview({
  rows,
  metadata,
  compact = false,
}: VolumeStructurePreviewProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className={compact ? "py-4 text-center" : "py-8 text-center"}>
          <p className="text-sm text-muted-foreground">
            Nenhuma linha para exibir na previa.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className={compact ? "py-4 space-y-3" : "py-4 space-y-4"}>
        <p className="text-sm font-medium">Previa</p>
        {!compact && metadata.projectCode && (
          <p className="text-xs text-muted-foreground">
            Projeto: {metadata.projectCode} {metadata.projectName && `- ${metadata.projectName}`}
          </p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="rounded border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {row.outputFileName || "sem nome"}
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {row.cover?.selection && (
                <p>Capa: {row.cover.selection.sourceFileName}</p>
              )}
              {row.blocks.map((block) => (
                <div key={block.id} className="ml-3">
                  <p>
                    {block.title} ({block.disciplineCode || "sem disc."})
                  </p>
                  <p className="ml-3">
                    Separatriz: {block.separator?.selection?.sourceFileName ?? `${block.separatorTitle ?? "sem titulo"} (automatica)`}
                  </p>
                  {block.ld?.selection && (
                    <p className="ml-3">LD: {block.ld.selection.sourceFileName}</p>
                  )}
                  {block.documents.map((doc) => (
                    <p key={doc.id} className="ml-3">
                      Doc: {doc.selection?.sourceFileName ?? "vazio"}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
