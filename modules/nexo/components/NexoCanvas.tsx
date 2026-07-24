"use client";

/**
 * Canvas tipo FigJam da organização dos arquivos (Apêndice G) — o CENTRO do
 * layout active. Mostra os artefatos GERADOS + as pranchas anexadas como nós, na
 * ordem canônica do volume (capa → separatriz → LD → pranchas), com setas de
 * sequência, pan + zoom. v1 = READ-ONLY (drag-to-reorder é v1.5).
 *
 * Linha d'água (Apêndice H): o frame de DADO é MATTE. Invariante Artifact vs
 * Attachment (§4): as pranchas do usuário viram UM nó leve (stack + contagem),
 * nunca N frames pesados; só capa/separatriz/LD ganham miniatura real.
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
import { Waypoints, Layers, Maximize2, Pencil } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { useComposer } from "../state/composer-controller";
import { ArtifactThumb } from "./ArtifactThumb";

/** Ordem canônica do volume: define o x dos nós e a direção das setas. */
const CANONICAL_RANK: Record<NexoArtifactKind, number> = {
  capa: 0,
  separatriz: 1,
  ld: 2,
  volume: 5,
  conferencia: 6,
  auditoria: 7,
};
const PRANCHAS_RANK = 3;

/** Rótulo do artefato p/ a frase de edição no composer ("Altera <isto>: "). */
const KIND_EDIT_LABEL: Partial<Record<NexoArtifactKind, string>> = {
  capa: "a capa",
  ld: "a LD",
  separatriz: "a separatriz",
  volume: "o volume",
  conferencia: "a conferência",
  auditoria: "a auditoria",
};

type ArtifactNodeData = CanvasArtifact & Record<string, unknown>;
type StackNodeData = { count: number } & Record<string, unknown>;

/**
 * Nó de artefato. A MINIATURA abre o PDF em tamanho real (resolve o "não dá pra
 * visualizar"); "Alterar no chat" pré-preenche o composer pra editar aquele
 * documento em conversa (o agente re-propõe → regera → o canvas atualiza).
 * `nodrag nopan` nos interativos p/ o React Flow não sequestrar o clique.
 */
function ArtifactNode({ data }: NodeProps<Node<ArtifactNodeData>>) {
  const composer = useComposer();
  const editLabel = KIND_EDIT_LABEL[data.kind] ?? "o documento";

  const openPreview = () => {
    if (data.pdfUrl) window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
  };
  const editInChat = () => {
    composer.fill(`Altera ${editLabel}: `);
    composer.focus();
  };

  return (
    <div className="w-[200px] overflow-hidden rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={openPreview}
        disabled={!data.pdfUrl}
        aria-label={data.pdfUrl ? `Abrir ${data.label} em tamanho real` : String(data.label)}
        className="nodrag nopan group relative block aspect-[3/4] w-full overflow-hidden border-b border-border enabled:cursor-zoom-in disabled:cursor-default"
      >
        <ArtifactThumb
          pdfUrl={data.pdfUrl}
          pageNumber={data.pageNumber}
          kind={data.kind}
          width={200}
        />
        {data.pdfUrl && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-[var(--shadow-panel)]">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              Ver
            </span>
          </span>
        )}
      </button>
      <div className="p-2">
        <p className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.05em]">
          {data.label}
        </p>
        {data.detail && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {data.detail}
          </p>
        )}
        <button
          type="button"
          onClick={editInChat}
          className="nodrag nopan mt-1.5 flex items-center gap-1 rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          Alterar no chat
        </button>
      </div>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

/** Pranchas do usuário = UM nó leve (stack + contagem), nunca N frames. */
function StackNode({ data }: NodeProps<Node<StackNodeData>>) {
  return (
    <div className="relative w-[180px]">
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-md border border-border bg-card/70" />
      <div className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-md border border-border bg-card/85" />
      <div className="relative flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-md border border-border bg-card">
        <Layers className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <p className="font-mono text-sm font-medium tabular-nums">
          {data.count} prancha{data.count === 1 ? "" : "s"}
        </p>
        <p className="text-[11px] text-muted-foreground">selos lidos</p>
      </div>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { artifact: ArtifactNode, stack: StackNode };

export function NexoCanvas({ pranchasCount = 0 }: { pranchasCount?: number }) {
  const { artifacts } = useArtifactStore();

  const { nodes, edges } = useMemo(() => {
    type Item = { id: string; rank: number; type: "artifact" | "stack"; data: unknown };
    const items: Item[] = artifacts.map((a) => ({
      id: a.id,
      rank: CANONICAL_RANK[a.kind] ?? 9,
      type: "artifact",
      data: a,
    }));
    if (pranchasCount > 0) {
      items.push({
        id: "pranchas",
        rank: PRANCHAS_RANK,
        type: "stack",
        data: { count: pranchasCount },
      });
    }
    items.sort((a, b) => a.rank - b.rank);

    const nodes: Node[] = items.map((it, i) => ({
      id: it.id,
      type: it.type,
      position: { x: i * 260, y: 0 },
      data: it.data as Record<string, unknown>,
      draggable: false,
    }));
    const edges: Edge[] = items.slice(1).map((it, i) => ({
      id: `${items[i].id}->${it.id}`,
      source: items[i].id,
      target: it.id,
      style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
    }));
    return { nodes, edges };
  }, [artifacts, pranchasCount]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card text-center">
        <Waypoints className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <p className="max-w-xs text-sm text-muted-foreground">
          Anexe as pranchas e gere os documentos — eles aparecem aqui como um mapa
          do volume (capa → LD → pranchas).
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-md border border-border bg-[var(--nexodoc-recessed)]">
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
