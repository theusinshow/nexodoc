"use client";

/**
 * Rótulo solto no canvas da auditoria — nomeia um bloco (hoje, o dos achados sem
 * página). Não é nó de conteúdo: não seleciona, não arrasta, não recebe linha.
 */

import type { NodeProps, Node } from "@xyflow/react";

export type RotuloDoCanvasData = {
  texto: string;
  ajuda?: string;
} & Record<string, unknown>;

export function RotuloDoCanvas({ data }: NodeProps<Node<RotuloDoCanvasData>>) {
  return (
    <div className="pointer-events-none select-none">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {data.texto}
      </p>
      {data.ajuda && (
        <p className="mt-0.5 max-w-[420px] text-[11px] text-muted-foreground/70">{data.ajuda}</p>
      )}
    </div>
  );
}
