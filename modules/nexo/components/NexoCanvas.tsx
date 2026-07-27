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
import { Waypoints, Layers, Maximize2, Pencil, Trash2, SlidersHorizontal } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { useComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
import { agruparPorTomo, tomoDoArtefato } from "../lib/results";
import { orfaosAposDivisao } from "../lib/edicao";
import { camposDoArtefato, aplicarEdicaoNoNo } from "../lib/editar-artefato";
import { EditorDoNo } from "./EditorDoNo";
import { AgentPopover } from "@/components/ui/agent-popover";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { faixasDosTomos } from "@/lib/ld/ld-rules";
import { ArtifactThumb } from "./ArtifactThumb";

/** Ordem canônica do volume: define o x dos nós e a direção das setas. */
/*
 * Ordem da fileira. O VOLUME é o último: ele é o resultado de tudo que veio
 * antes (capa → separatriz → LD → folhas), e vê-lo no meio sugere que ainda vem
 * documento depois dele.
 */
const CANONICAL_RANK: Record<NexoArtifactKind, number> = {
  capa: 0,
  separatriz: 1,
  ld: 2,
  conferencia: 5,
  auditoria: 6,
  volume: 9,
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

type ArtifactNodeData = CanvasArtifact & {
  /** Só capa/LD/separatriz abrem editor; volume é derivado. */
  editavel?: boolean;
  params?: Record<string, unknown>;
  templates?: { id: string; nome: string }[];
  tomosExistentes?: number[];
  selos?: SeloForLd[];
} & Record<string, unknown>;
type StackNodeData = { count: number; infos: PranchaInfo[] } & Record<string, unknown>;

/**
 * Nó de artefato. A MINIATURA abre o PDF em tamanho real (resolve o "não dá pra
 * visualizar"); "Alterar no chat" pré-preenche o composer pra editar aquele
 * documento em conversa (o agente re-propõe → regera → o canvas atualiza).
 * `nodrag nopan` nos interativos p/ o React Flow não sequestrar o clique.
 */
function ArtifactNode({ data, selected }: NodeProps<Node<ArtifactNodeData>>) {
  const composer = useComposer();
  const conv = useConversation();
  const { removeResult } = conv;
  const [editando, setEditando] = useState(false);
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

  const corpo = (
    <div
      className={
        selected
          ? "w-[200px] overflow-hidden rounded-md border border-[var(--ring)] bg-card"
          : "w-[200px] overflow-hidden rounded-md border border-border bg-card"
      }
    >
      {/*
        A miniatura NÃO é um botão `nodrag`. No React Flow, `nodrag` desliga o
        mesmo manipulador de ponteiro que faz a SELEÇÃO — e como a miniatura é
        quase toda a área do nó, clicar nela (o alvo natural) nunca selecionava
        nada. As ferramentas do nó, que dependem da seleção, simplesmente não
        apareciam.

        Agora clicar na miniatura SELECIONA, e abrir o PDF é um botão próprio.
      */}
      <div className="group relative block aspect-[3/4] w-full overflow-hidden border-b border-border">
        <ArtifactThumb
          pdfUrl={data.pdfUrl}
          pageNumber={data.pageNumber}
          kind={data.kind}
          width={200}
        />
        {data.pdfUrl && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={openPreview}
              aria-label={`Abrir ${data.label} em tamanho real`}
              className="nodrag nopan flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-[var(--shadow-panel)] hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              Ver
            </button>
          </span>
        )}
      </div>
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
          {selected && !confirmando && data.editavel && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="nodrag nopan flex items-center gap-1 rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden />
              Editar aqui
            </button>
          )}
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

  if (!data.editavel) return corpo;

  return (
    <AgentPopover
      open={editando}
      onClose={() => setEditando(false)}
      label={`Editar ${data.kind}`}
      panelClassName="w-[280px]"
      anchor={corpo}
    >
      <EditorDoNo
        kind={data.kind}
        campos={camposDoArtefato({
          kind: data.kind,
          params: data.params,
          templates: data.templates ?? [],
          tomosExistentes: data.tomosExistentes ?? [],
        })}
        onCancelar={() => setEditando(false)}
        onAplicar={async (valores, frase) => {
          await aplicarEdicaoNoNo({
            kind: data.kind,
            artifactId: data.id,
            valores,
            paramsAntigos: data.params,
            selos: data.selos ?? [],
            saveResult: conv.saveResult,
          });
          // A frase vai para o HISTÓRICO: é o que faz o próximo turno do agente
          // enxergar a decisão em vez de re-propor o valor antigo por cima.
          if (frase) {
            conv.appendMessage({
              id: crypto.randomUUID(),
              role: "user",
              content: frase,
            });
          }
          setEditando(false);
        }}
      />
    </AgentPopover>
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

/**
 * Rótulo da fileira: diz de que tomo é aquele volume. "Sem tomo" nomeia o que
 * sobrou de uma divisão anterior — é resto, e o engenheiro precisa saber disso
 * para excluir em vez de achar que faz parte.
 */
function RotuloNode({ data }: NodeProps<Node<{ tomo: number } & Record<string, unknown>>>) {
  const ehResto = data.tomo === 0;
  return (
    <div className="w-[130px] text-right">
      <p
        className={
          ehResto
            ? "font-mono text-[11px] uppercase tracking-[0.07em] text-[var(--status-warning)]"
            : "font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-foreground"
        }
      >
        {ehResto ? "Fora da divisão" : `Tomo ${String(data.tomo).padStart(2, "0")}`}
      </p>
      {ehResto && (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          gerado antes de dividir
        </p>
      )}
    </div>
  );
}

const nodeTypes = { artifact: ArtifactNode, stack: StackNode, rotulo: RotuloNode };

const EDITAVEIS: NexoArtifactKind[] = ["capa", "ld", "separatriz"];

export function NexoCanvas({
  pranchasCount = 0,
  pranchas = [],
  selos = [],
}: {
  pranchasCount?: number;
  pranchas?: PranchaInfo[];
  /** Selos lidos — a regeneração pelo nó precisa deles. */
  selos?: SeloForLd[];
}) {
  const { artifacts } = useArtifactStore();
  const { results } = useConversation();

  /*
   * Seleção CONTROLADA por nós.
   *
   * O React Flow só seleciona por clique dentro do XYDrag, e o XYDrag nem é
   * criado quando o nó não é arrastável (`disabled: !isDraggable` no useDrag).
   * Como a ordem do canvas é canônica — arrastar não faria sentido —, os nós
   * seguem fixos e a seleção passa pelo `onNodeClick`. Sem isto, clicar num
   * documento não fazia nada e as ferramentas do nó nunca apareciam.
   */
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  // Prefeituras: lista fechada do campo da capa no editor do nó.
  const [templates, setTemplates] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    fetch("/api/capas/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  const { nodes, edges } = useMemo(() => {
    type Item = { id: string; rank: number; type: "artifact" | "stack"; data: unknown };

    /*
     * UMA FILEIRA POR TOMO. Cada tomo é um volume físico (capa → separatriz →
     * LD → suas folhas); desenhar tudo numa fileira só misturava três volumes
     * distintos numa esteira única, e não dava para ver o que pertencia a quê.
     *
     * O grupo "sem tomo" fica por último: são artefatos gerados ANTES da divisão
     * e que sobraram. Escondê-los faria o canvas mentir sobre o que existe.
     */
    const grupos = agruparPorTomo(artifacts);
    const tomosReais = grupos.filter((g) => g.tomo > 0).length;

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    grupos.forEach((grupo, linha) => {
      const items: Item[] = grupo.itens
        .map((a) => ({
          id: a.id,
          rank: CANONICAL_RANK[a.kind] ?? 9,
          type: "artifact" as const,
          data: {
            ...a,
            editavel: EDITAVEIS.includes(a.kind),
            params: results.find((r) => r.artifactId === a.id)?.payload as
              | Record<string, unknown>
              | undefined,
            templates,
            tomosExistentes: artifacts.map((x) => tomoDoArtefato(x.id)),
            selos,
          } as unknown,
        }))
        .sort((a, b) => a.rank - b.rank);

      // A pilha de pranchas acompanha o tomo: cada volume leva a SUA fatia.
      if (pranchasCount > 0) {
        const faixa =
          grupo.tomo > 0 && tomosReais > 1
            ? faixasDosTomos(pranchas.length || pranchasCount, tomosReais)[grupo.tomo - 1]
            : null;
        const infos = faixa ? pranchas.slice(faixa.inicio - 1, faixa.fim) : pranchas;
        const count = faixa ? faixa.fim - faixa.inicio + 1 : pranchasCount;
        items.push({
          id: grupo.tomo > 0 ? `pranchas:t${grupo.tomo}` : "pranchas",
          rank: PRANCHAS_RANK,
          type: "stack",
          data: { count, infos },
        });
      }

      const y = linha * 330;
      items.forEach((it, i) => {
        nodes.push({
          id: it.id,
          type: it.type,
          position: { x: i * 260, y },
          data: it.data as Record<string, unknown>,
          draggable: false,
          selected: it.id === selecionadoId,
        });
        if (i > 0) {
          edges.push({
            id: `${items[i - 1].id}->${it.id}`,
            source: items[i - 1].id,
            target: it.id,
            style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
      });

      // Rótulo da fileira. Só aparece quando há divisão — com um volume só ele
      // seria ruído.
      if (grupos.length > 1) {
        nodes.push({
          id: `rotulo:${grupo.tomo}`,
          type: "rotulo",
          position: { x: -150, y: y + 130 },
          data: { tomo: grupo.tomo },
          draggable: false,
          selectable: false,
        });
      }
    });

    return { nodes, edges };
  }, [artifacts, pranchasCount, pranchas, results, templates, selos, selecionadoId]);

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
        onNodeClick={(_, no) => setSelecionadoId(no.id)}
        onPaneClick={() => setSelecionadoId(null)}
        panOnScroll
        zoomOnScroll
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
