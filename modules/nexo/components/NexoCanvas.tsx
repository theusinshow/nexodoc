"use client";

/**
 * Canvas tipo FigJam da prévia (Apêndice G) — os artefatos gerados como nós, na
 * ordem canônica do volume (capa → separatriz → LD → …), com setas de sequência,
 * pan + zoom. v1 = READ-ONLY (o drag-to-reorder ligado ao `assembleVolume` é v1.5).
 *
 * Linha d'água (Apêndice H): o CANVAS/chrome pode ter ambiência, mas o FRAME de
 * DADO é MATTE — cada nó é um card matte com a miniatura real (react-pdf). A
 * miniatura degrada para ícone sozinha (nunca tela branca).
 *
 * Motor: @xyflow/react. Invariante Artifact vs Attachment (§4): só entram aqui os
 * artefatos GERADOS (do store) — pranchas do usuário nunca viram N frames pesados.
 */

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Waypoints } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { ArtifactThumb } from "./ArtifactThumb";

/** Ordem canônica do volume: define o x dos nós e a direção das setas. */
const CANONICAL_RANK: Record<NexoArtifactKind, number> = {
  capa: 0,
  separatriz: 1,
  ld: 2,
  volume: 3,
  conferencia: 4,
  auditoria: 5,
};

type ArtifactNodeData = CanvasArtifact & Record<string, unknown>;

function ArtifactNode({ data }: NodeProps<Node<ArtifactNodeData>>) {
  return (
    <div className="w-[200px] overflow-hidden rounded-md border border-border bg-card">
      <div className="aspect-[3/4] w-full overflow-hidden border-b border-border">
        <ArtifactThumb
          pdfUrl={data.pdfUrl}
          pageNumber={data.pageNumber}
          kind={data.kind}
          width={200}
        />
      </div>
      <div className="p-2">
        <p className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.05em]">
          {data.label}
        </p>
        {data.detail && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {data.detail}
          </p>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { artifact: ArtifactNode };

export function NexoCanvas() {
  const { artifacts } = useArtifactStore();

  const { nodes, edges } = useMemo(() => {
    const ordered = [...artifacts].sort(
      (a, b) => (CANONICAL_RANK[a.kind] ?? 9) - (CANONICAL_RANK[b.kind] ?? 9),
    );
    const nodes: Node<ArtifactNodeData>[] = ordered.map((a, i) => ({
      id: a.id,
      type: "artifact",
      position: { x: i * 260, y: 0 },
      data: a as ArtifactNodeData,
      draggable: false,
    }));
    const edges: Edge[] = ordered.slice(1).map((a, i) => ({
      id: `${ordered[i].id}->${a.id}`,
      source: ordered[i].id,
      target: a.id,
      animated: false,
      style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
    }));
    return { nodes, edges };
  }, [artifacts]);

  if (artifacts.length === 0) {
    return (
      <div className="flex h-[240px] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card text-center">
        <Waypoints className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <p className="max-w-xs text-sm text-muted-foreground">
          Os artefatos gerados aparecem aqui como um mapa do volume (capa → LD → …).
        </p>
      </div>
    );
  }

  return (
    <div className="h-[440px] w-full overflow-hidden rounded-md border border-border bg-[var(--nexodoc-recessed)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
