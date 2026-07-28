"use client";

/**
 * Canvas tipo FigJam da organização dos arquivos (Apêndice G) — o CENTRO do
 * layout active. Mostra os artefatos GERADOS + as pranchas anexadas como nós, na
 * ordem canônica do volume (capa → separatriz → LD → pranchas), com setas de
 * sequência, pan + zoom. v1 = READ-ONLY (drag-to-reorder é v1.5).
 *
 * Linha d'água (Apêndice H): o frame de DADO é MATTE. As pranchas do usuário
 * viram UM NÓ POR FOLHA (texto puro, sem miniatura) — a pilha única de antes não
 * era manipulável, e o sub-projeto 4 precisa endereçar folha a folha. Só
 * capa/separatriz/LD ganham miniatura real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Waypoints, Maximize2, Pencil, Trash2, SlidersHorizontal } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { useComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
import { agruparPorTomo, tomoDoArtefato } from "../lib/results";
import { orfaosAposDivisao } from "../lib/edicao";
import { camposDoArtefato, aplicarEdicaoNoNo } from "../lib/editar-artefato";
import { EditorDoNo } from "./EditorDoNo";
import { AgentPopover } from "@/components/ui/agent-popover";
import { buildBalancedQuantities } from "@/lib/ld/ld-rules";
import { gruposDasFolhas, type Folha, type FolhaId } from "../lib/folhas";
import {
  alturaDaFileira,
  larguraDaGrade,
  posicaoNaGrade,
  topoDasFileiras,
} from "../lib/layout-canvas";
import { FolhaNode, type FolhaNodeData } from "./FolhaNode";
import { ArtifactThumb } from "./ArtifactThumb";
import { NavegacaoDoCanvas, type FileiraNavegavel } from "./NavegacaoDoCanvas";

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

type ArtifactNodeData = CanvasArtifact & {
  /** Só capa/LD/separatriz abrem editor; volume é derivado. */
  editavel?: boolean;
  params?: Record<string, unknown>;
  templates?: { id: string; nome: string }[];
  tomosExistentes?: number[];
  selos?: Folha[];
} & Record<string, unknown>;

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
 * Rótulo da fileira: diz de que tomo é aquele volume. "Sem tomo" nomeia o que
 * sobrou de uma divisão anterior — é resto, e o engenheiro precisa saber disso
 * para excluir em vez de achar que faz parte.
 */
function RotuloNode({
  data,
}: NodeProps<Node<{ tomo: number; folhas: number } & Record<string, unknown>>>) {
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
      {/* A contagem era o que a pilha dava de relance; ela morreu, isto fica. */}
      {data.folhas > 0 && (
        <p className="mt-0.5 text-[10px] leading-tight tabular-nums text-muted-foreground">
          {data.folhas} folha{data.folhas === 1 ? "" : "s"}
        </p>
      )}
      {ehResto && (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          gerado antes de dividir
        </p>
      )}
    </div>
  );
}

const nodeTypes = { artifact: ArtifactNode, rotulo: RotuloNode, folha: FolhaNode };

const EDITAVEIS: NexoArtifactKind[] = ["capa", "ld", "separatriz"];

function CanvasInterno({
  folhas = [],
  numeros = {},
  arquivosDisponiveis,
  onAbrirFolha,
  onCorrigirFolha,
}: {
  /** A projeção (selo + ajuste). É a MESMA lista que a montagem lê. */
  folhas?: Folha[];
  /** Número da folha resolvido por `resolveSheetNumbers`, por id. */
  numeros?: Record<FolhaId, number | null>;
  /** Nomes de arquivo com bytes em memória — sem eles não dá para abrir a página. */
  arquivosDisponiveis?: ReadonlySet<string>;
  onAbrirFolha?: (id: FolhaId) => void;
  onCorrigirFolha?: (id: FolhaId, titulo: string) => void;
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

  /*
   * Estáveis de propósito: eles entram no `data` de cada nó de folha, e uma
   * função nova a cada render recriaria todos os nós — o mesmo defeito que fazia
   * o popover fechar no instante em que abria.
   */
  const abrirFolha = useCallback((id: FolhaId) => onAbrirFolha?.(id), [onAbrirFolha]);
  const corrigirFolha = useCallback(
    (id: FolhaId, titulo: string) => onCorrigirFolha?.(id, titulo),
    [onCorrigirFolha],
  );

  const { nodes, edges, fileiras } = useMemo(() => {
    type Item = { id: string; rank: number; type: "artifact"; data: unknown };

    /*
     * UMA FILEIRA POR TOMO. Cada tomo é um volume físico (capa → separatriz →
     * LD → suas folhas); desenhar tudo numa fileira só misturava três volumes
     * distintos numa esteira única, e não dava para ver o que pertencia a quê.
     *
     * O grupo "sem tomo" fica por último: são artefatos gerados ANTES da divisão
     * e que sobraram. Escondê-los faria o canvas mentir sobre o que existe.
     */
    const grupos = agruparPorTomo(artifacts);
    const fileiras: FileiraNavegavel[] = [];
    const tomosReais = grupos.filter((g) => g.tomo > 0).length;

    /*
     * A divisão sai de `gruposDasFolhas`, não mais de `faixasDosTomos`: ela
     * respeita o `grupo` manual e só cai na divisão por quantidade quando não há
     * nenhum. Sem grupo manual as duas dão o mesmo resultado — há teste para essa
     * igualdade. Sem esta troca, arrastar uma folha (sub-projeto 4) faria ela
     * voltar para o lugar, porque a tela continuaria dividindo por contagem.
     */
    const divisao =
      tomosReais > 1 ? gruposDasFolhas(folhas, tomosReais, buildBalancedQuantities) : [];
    const porId = new Map(folhas.map((f) => [f.id, f]));

    // As folhas de cada fileira, decididas ANTES de posicionar: a altura da
    // fileira depende de quantas folhas ela tem.
    const folhasPorFileira = grupos.map((grupo) => {
      // Com vários tomos, a folha pertence a UM tomo. A fileira "fora da divisão"
      // não recebe folha nenhuma: id repetido em duas fileiras quebra o React
      // Flow, e uma folha em dois volumes seria mentira sobre a montagem.
      if (tomosReais > 1) {
        return grupo.tomo > 0
          ? (divisao[grupo.tomo - 1] ?? [])
              .map((id) => porId.get(id))
              .filter((f): f is Folha => f !== undefined)
          : [];
      }
      return folhas;
    });

    const topos = topoDasFileiras(folhasPorFileira.map((fs) => alturaDaFileira(fs.length)));

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
            selos: folhas,
          } as unknown,
        }))
        .sort((a, b) => a.rank - b.rank);

      const y = topos[linha];
      const daFileira = folhasPorFileira[linha];

      // A grade das folhas entra na posição canônica (depois da LD, antes do
      // volume): os documentos antes dela, os de depois deslocados pela largura.
      const antes = items.filter((it) => it.rank < PRANCHAS_RANK);
      const depois = items.filter((it) => it.rank > PRANCHAS_RANK);

      let cursorX = 0;
      let anterior: string | null = null;
      const idsDaFileira: string[] = [];

      const empurrar = (it: Item) => {
        nodes.push({
          id: it.id,
          type: it.type,
          position: { x: cursorX, y },
          data: it.data as Record<string, unknown>,
          draggable: false,
          selected: it.id === selecionadoId,
        });
        if (anterior) {
          edges.push({
            id: `${anterior}->${it.id}`,
            source: anterior,
            target: it.id,
            style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
        anterior = it.id;
        idsDaFileira.push(it.id);
        cursorX += 260;
      };

      antes.forEach(empurrar);

      daFileira.forEach((f, i) => {
        const p = posicaoNaGrade(i);
        const id = `folha:${f.id}`;
        nodes.push({
          id,
          type: "folha",
          position: { x: cursorX + p.x, y: y + p.y },
          data: {
            id: f.id,
            numero: numeros[f.id] ?? null,
            titulo: f.conteudo ?? "",
            editado: f.editado,
            podeAbrir: arquivosDisponiveis?.has(f.fileName) ?? false,
            onAbrir: abrirFolha,
            onCorrigir: corrigirFolha,
          } satisfies FolhaNodeData,
          draggable: false,
          selected: id === selecionadoId,
        });
        idsDaFileira.push(id);
        // Só a PRIMEIRA folha recebe a seta: uma seta por folha viraria 200
        // linhas cruzando a grade, e a sequência já é dada pela leitura dela.
        if (i === 0 && anterior) {
          edges.push({
            id: `${anterior}->${id}`,
            source: anterior,
            target: id,
            style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
        if (i === daFileira.length - 1) anterior = id;
      });

      if (daFileira.length > 0) cursorX += larguraDaGrade(daFileira.length) + 60;

      depois.forEach(empurrar);

      // A fileira também vira destino de navegação (barra e teclas 1-9).
      fileiras.push({ tomo: grupo.tomo, ids: idsDaFileira });

      // Rótulo da fileira. Só aparece quando há divisão — com um volume só ele
      // seria ruído.
      if (grupos.length > 1) {
        nodes.push({
          id: `rotulo:${grupo.tomo}`,
          type: "rotulo",
          position: { x: -150, y: y + 130 },
          data: { tomo: grupo.tomo, folhas: daFileira.length },
          draggable: false,
          selectable: false,
        });
      }
    });

    return { nodes, edges, fileiras };
  }, [
    artifacts,
    folhas,
    numeros,
    arquivosDisponiveis,
    abrirFolha,
    corrigirFolha,
    results,
    templates,
    selecionadoId,
  ]);

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
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-md border border-border bg-[var(--nexodoc-recessed)]">
      <NavegacaoDoCanvas fileiras={fileiras} />
      <ReenquadrarAoCrescer quantidade={nodes.length} />
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
        {/*
         * SEM MINIMAPA, de propósito — tentei e não funciona daqui.
         *
         * `MiniMapNode` descarta todo nó cujo objeto não declare dimensões
         * (`nodeHasDimensions(userNode)`), e lê isso do nó QUE NÓS passamos, não
         * do interno já medido. Como os nós aqui saem de um `useMemo` derivado e
         * não voltam por `onNodesChange`, `measured` nunca chega neles: o
         * minimapa desenhava só a moldura e o retângulo do viewport, vazio.
         *
         * As saídas seriam fixar width/height em cada nó — o que passaria a
         * DITAR o tamanho real deles, hoje dado pelo conteúdo — ou tornar os nós
         * estado mutável. A segunda é justamente o que o Document State e
         * "página como nó" fazem; o minimapa volta lá, quando tiver como
         * funcionar. A orientação por tomo fica com a `NavegacaoDoCanvas`.
         */}
      </ReactFlow>
    </div>
  );
}

/**
 * Reenquadra QUANDO NASCEM NÓS. Ao gerar documentos, os novos apareciam fora do
 * enquadramento atual e o engenheiro tinha de sair procurando.
 *
 * A condição é estrita — só quando a QUANTIDADE aumenta. Reenquadrar a cada
 * mudança de estado faria o canvas pular sob o cursor de quem está navegando,
 * que é pior do que o problema original.
 */
function ReenquadrarAoCrescer({ quantidade }: { quantidade: number }) {
  const fluxo = useReactFlow();
  const anterior = useRef(quantidade);
  useEffect(() => {
    if (quantidade > anterior.current) {
      const id = requestAnimationFrame(() =>
        fluxo.fitView({ padding: 0.25, duration: 400 }),
      );
      anterior.current = quantidade;
      return () => cancelAnimationFrame(id);
    }
    anterior.current = quantidade;
  }, [quantidade, fluxo]);
  return null;
}

/**
 * O `useReactFlow` só funciona DENTRO de um provider, e navegar
 * programaticamente (ir para um tomo, reenquadrar) depende dele.
 */
export function NexoCanvas(props: {
  folhas?: Folha[];
  numeros?: Record<FolhaId, number | null>;
  arquivosDisponiveis?: ReadonlySet<string>;
  onAbrirFolha?: (id: FolhaId) => void;
  onCorrigirFolha?: (id: FolhaId, titulo: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}
