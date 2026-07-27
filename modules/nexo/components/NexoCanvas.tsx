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

import { useMemo, useState } from "react";
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
import { Waypoints, Layers, Maximize2, Pencil, Trash2 } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { useComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
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

/** Info lida (por IA, do carimbo) de UMA prancha anexada — mostrada no canvas. */
export interface PranchaInfo {
  folha: number | null;
  descricao: string;
  disciplina: string;
}

type ArtifactNodeData = CanvasArtifact & Record<string, unknown>;
type StackNodeData = { count: number; infos: PranchaInfo[] } & Record<string, unknown>;

/**
 * Nó de artefato. A MINIATURA abre o PDF em tamanho real (resolve o "não dá pra
 * visualizar"); "Alterar no chat" pré-preenche o composer pra editar aquele
 * documento em conversa (o agente re-propõe → regera → o canvas atualiza).
 * `nodrag nopan` nos interativos p/ o React Flow não sequestrar o clique.
 */
function ArtifactNode({ data, selected }: NodeProps<Node<ArtifactNodeData>>) {
  const composer = useComposer();
  const { removeResult } = useConversation();
  const editLabel = KIND_EDIT_LABEL[data.kind] ?? "o documento";
  // Confirmação INLINE, no próprio nó. Excluir aqui é reversível (o card volta a
  // proposta e regerar é um clique), então um diálogo modal custaria mais
  // atenção do que a decisão merece.
  const [confirmando, setConfirmando] = useState(false);

  const openPreview = () => {
    if (data.pdfUrl) window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
  };
  const editInChat = () => {
    composer.fill(`Altera ${editLabel}: `);
    composer.focus();
  };

  return (
    <div
      className={
        selected
          ? "w-[200px] overflow-hidden rounded-md border border-[var(--ring)] bg-card"
          : "w-[200px] overflow-hidden rounded-md border border-border bg-card"
      }
    >
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
        {/* Título DOCUMENTAL: o que sai impresso, e o que o engenheiro precisa
            conferir de relance. `pre-line` porque ele tem parágrafos. */}
        {data.titulo && (
          <p className="mt-1 whitespace-pre-line text-[11px] leading-tight text-foreground">
            {data.titulo}
          </p>
        )}
        {data.detail && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {data.detail}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={editInChat}
            className="nodrag nopan flex items-center gap-1 rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Alterar no chat
          </button>
          {/* Só o nó SELECIONADO oferece excluir: a ação some do caminho de quem
              está só olhando o mapa do volume. */}
          {selected && !confirmando && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="nodrag nopan flex items-center gap-1 rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Excluir
            </button>
          )}
        </div>
        {selected && confirmando && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Excluir?</span>
            <button
              type="button"
              onClick={() => removeResult(data.id)}
              className="nodrag nopan rounded-sm font-medium text-destructive underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="nodrag nopan rounded-sm text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              Não
            </button>
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

/**
 * Pranchas anexadas = UM nó leve com a INFO lida do carimbo de cada folha (imagem
 * PADRÃO = ícone, sem renderizar PDF). Mostra o que a IA leu (folha + descrição).
 */
function StackNode({ data }: NodeProps<Node<StackNodeData>>) {
  const disciplina = data.infos.find((p) => p.disciplina)?.disciplina;
  return (
    <div className="w-[228px] overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-[var(--nexodoc-recessed)]">
          <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] tabular-nums">
            {data.count} prancha{data.count === 1 ? "" : "s"}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            selos lidos{disciplina ? ` · ${disciplina}` : ""}
          </p>
        </div>
      </div>
      {data.infos.length > 0 && (
        <div className="nowheel max-h-[210px] overflow-y-auto">
          {data.infos.map((p, i) => (
            <div
              key={i}
              className="flex gap-2 border-b border-border/50 px-2.5 py-1.5 last:border-0"
            >
              <span className="w-6 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {p.folha != null ? String(p.folha).padStart(2, "0") : "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]" title={p.descricao}>
                {p.descricao || "—"}
              </span>
            </div>
          ))}
        </div>
      )}
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { artifact: ArtifactNode, stack: StackNode };

export function NexoCanvas({
  pranchasCount = 0,
  pranchas = [],
}: {
  pranchasCount?: number;
  pranchas?: PranchaInfo[];
}) {
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
        data: { count: pranchasCount, infos: pranchas },
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
  }, [artifacts, pranchasCount, pranchas]);

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
        elementsSelectable
        panOnScroll
        zoomOnScroll
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
