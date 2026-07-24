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

import { useEffect, useMemo, useState } from "react";
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
import { Waypoints, Layers, FileStack } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { NexoAgentProposal, NexoArtifactKind, LdPreviewData } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { ArtifactThumb } from "./ArtifactThumb";
import { ConfirmationCard, type NexoTemplateOption } from "./ConfirmationCard";

/** Uma proposta atual + a prévia de folhas (LD) associada — vira card no canvas. */
export interface CanvasProposal {
  proposal: NexoAgentProposal;
  ldPreview?: LdPreviewData;
}

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

type ArtifactNodeData = CanvasArtifact & Record<string, unknown>;
type StackNodeData = { count: number } & Record<string, unknown>;

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

/**
 * CANVAS = área de trabalho dos artefatos (Apêndice G, redirecionamento
 * 2026-07-24). O chat virou diálogo puro; aqui moram os DOCUMENTOS: cada
 * proposta é um card (confere os parâmetros, gera, baixa) e o "Mapa do volume"
 * (FigJam read-only) mostra o que já foi gerado com miniatura. Ordem canônica.
 */
export function NexoCanvas({
  pranchasCount = 0,
  proposals = [],
  selos,
  pranchaFiles = [],
  memorialFile = null,
}: {
  pranchasCount?: number;
  proposals?: CanvasProposal[];
  selos: SeloForLd[];
  pranchaFiles?: File[];
  memorialFile?: File | null;
}) {
  const [templates, setTemplates] = useState<NexoTemplateOption[]>([]);
  useEffect(() => {
    fetch("/api/capas/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-md">
      {/* Documentos: propostas → confirmar / gerar / baixar (o que se ACIONA). */}
      <section className="min-h-0">
        <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <FileStack className="h-3.5 w-3.5" aria-hidden />
          Documentos
        </h2>
        {proposals.length === 0 ? (
          <EmptyState
            className="py-10"
            description="Peça no chat (ex.: “cria a LD e a capa”). As propostas aparecem aqui — você confere, gera e baixa cada documento."
          />
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            {proposals.map((cp, i) => (
              <ConfirmationCard
                key={`${cp.proposal.kind}-${i}`}
                proposal={cp.proposal}
                selos={selos}
                templates={templates}
                ldPreview={cp.ldPreview}
                pranchaFiles={pranchaFiles}
                memorialFile={memorialFile}
              />
            ))}
          </div>
        )}
      </section>

      {/* Mapa do volume: FigJam read-only do que já foi gerado (com miniatura). */}
      <section className="shrink-0">
        <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <Waypoints className="h-3.5 w-3.5" aria-hidden />
          Mapa do volume
        </h2>
        <div className="h-[300px]">
          <VolumeMap pranchasCount={pranchasCount} />
        </div>
      </section>
    </div>
  );
}

function VolumeMap({ pranchasCount = 0 }: { pranchasCount?: number }) {
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
    <div className="h-full w-full overflow-hidden rounded-md border border-border bg-[var(--nexodoc-recessed)]">
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
