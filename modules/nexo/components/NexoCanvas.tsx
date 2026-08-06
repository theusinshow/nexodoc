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
  useNodesState,
  Handle,
  Position,
  MarkerType,
  ViewportPortal,
  type Node,
  type Edge,
  type NodeProps,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Waypoints, Maximize2, MessageSquare, Trash2, SlidersHorizontal } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { useComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
import { agruparPorTomo, tomoDoArtefato } from "../lib/results";
import { orfaosAposDivisao } from "../lib/edicao";
import { camposDoArtefato, aplicarEdicaoNoNo } from "../lib/editar-artefato";
import { aplicarIdentidade, separarIdentidade } from "../lib/identidade";
import { summarizeSelos } from "../lib/agent-context";
import type { ParagrafoDoModelo } from "@/server/odt/layout";
import { textoEmLinhasDaCapa } from "@/server/nexo/capa-linhas";
import { EditorDoNo } from "./EditorDoNo";
import { AcaoDoNo } from "./AcaoDoNo";
import { AgentPopover } from "@/components/ui/agent-popover";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildBalancedQuantities } from "@/lib/ld/ld-rules";
import {
  chaveDeOrdem,
  gruposDasFolhas,
  type Ajuste,
  type Folha,
  type FolhaId,
} from "../lib/folhas";
import {
  ajusteDoDrop,
  alvoDoDrop,
  posicaoDaFresta,
  assinaturaDoTomo,
  type FileiraDoDrop,
  type GradeDoDrop,
} from "../lib/drop-folhas";
import {
  ALTURA_FOLHA,
  colunasDaGrade,
  LARGURA_FOLHA,
  PASSO_X,
  PASSO_Y,
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
  /** `layout` é a estrutura do modelo ODT — é dela que o frame se desenha. */
  templates?: { id: string; nome: string; layout?: ParagrafoDoModelo[] }[];
  tomosExistentes?: number[];
  selos?: Folha[];
  /** As folhas do tomo mudaram desde que este documento foi gerado. */
  desatualizado?: boolean;
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
        {/*
          O documento não descreve mais as folhas que estão no canvas. Fica ANTES
          do rótulo porque é a informação que decide o que fazer com o nó: gerar
          de novo. Sem isso, montar o volume entrega um PDF errado sem aviso.
        */}
        {data.desatualizado && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mb-1 inline-flex">
                <Badge variant="warning">Desatualizado</Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              As folhas deste tomo mudaram depois que este documento foi gerado.
              Gere de novo antes de montar o volume.
            </TooltipContent>
          </Tooltip>
        )}
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
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <AcaoDoNo
            icone={MessageSquare}
            rotulo="Alterar no chat"
            ajuda="Escreve o pedido no chat para o Nexo refazer este documento em conversa."
            onClick={editInChat}
          />
          {/* Só o nó SELECIONADO oferece editar e excluir: as ações somem do
              caminho de quem está só olhando o mapa do volume. */}
          {selected && !confirmando && data.editavel && (
            <AcaoDoNo
              icone={SlidersHorizontal}
              rotulo="Editar aqui"
              ajuda="Abre os campos deste documento (título, prefeitura, nº de tomos) e o regera na hora."
              onClick={() => setEditando(true)}
            />
          )}
          {selected && !confirmando && (
            <AcaoDoNo
              icone={Trash2}
              rotulo="Excluir"
              ajuda="Tira este documento do canvas e do volume. A proposta volta ao chat, então regerar é um clique."
              tom="perigo"
              onClick={() => setConfirmando(true)}
            />
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
      // A capa é editada num FRAME com a forma do documento; ele precisa de mais
      // largura do que a lista de campos que havia antes.
      panelClassName={data.kind === "capa" ? "w-[360px]" : "w-[280px]"}
      anchor={corpo}
    >
      <EditorDoNo
        kind={data.kind}
        /*
         * O MESMO frame do card "Vou gerar", desenhado a partir do modelo desta
         * prefeitura. Dois frames divergiriam — e o antigo, em CSS fixo, passou
         * a mentir no dia em que o modelo ganhou duas linhas de nome de obra.
         */
        layout={
          (data.templates ?? []).find(
            (t) => t.id === String((data.params as { templateId?: unknown })?.templateId ?? ""),
          )?.layout ?? []
        }
        /*
         * O que o CARIMBO diz, por marcador. Os campos de identidade chegam
         * vazios (vazio = "vale o selo"), e num desenho do documento isso se
         * lia como capa sem obra e sem código.
         */
        derivadosDoNo={(() => {
          const ident = summarizeSelos(data.selos ?? []);
          return {
            /*
             * A obra chega JÁ QUEBRADA nas linhas em que será impressa. O
             * carimbo a escreve numa tira só ("A - B") porque a célula dele é
             * uma linha; a capa tem duas. Mostrar a tira aqui faria o frame
             * dizer uma coisa e o PDF sair outra — o defeito que ele existe
             * para não cometer. Mesma regra da geração: [[capa-linhas.ts]].
             */
            NOME_OBRA: textoEmLinhasDaCapa(
              conv.identidade.obra ?? ident.obra ?? "",
            ),
            CODIGO_EXIBIDO: conv.identidade.codigo ?? ident.codigo ?? "",
            TOMO:
              typeof data.tomo === "number" && data.tomo > 0
                ? `TOMO ${String(data.tomo).padStart(2, "0")}`
                : "",
          };
        })()}
        campos={camposDoArtefato({
          kind: data.kind,
          params: data.params,
          templates: data.templates ?? [],
          tomosExistentes: data.tomosExistentes ?? [],
          identidade: conv.identidade,
        })}
        onCancelar={() => setEditando(false)}
        onAplicar={async (valores, frase) => {
          /*
           * A identidade do projeto e os params DESTE documento vivem em lugares
           * diferentes: ela é da conversa, eles são do artefato. Misturá-los faria
           * a correção da obra durar até a próxima geração pelo plano, que
           * reconstrói os params a partir da proposta do agente — aceita e
           * revertida sem aviso.
           */
          const { identidade, resto } = separarIdentidade(valores);
          const corrigida = aplicarIdentidade(conv.identidade, identidade);
          if (Object.keys(identidade).length > 0) conv.corrigirIdentidade(identidade);
          await aplicarEdicaoNoNo({
            kind: data.kind,
            artifactId: data.id,
            valores: resto,
            paramsAntigos: data.params,
            selos: data.selos ?? [],
            saveResult: conv.saveResult,
            totais: conv.totaisPorDisciplina,
            identidade: corrigida,
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

/*
 * As medidas da grade viajam INJETADAS até o módulo puro do drop: ele roda em
 * Node pelado no teste e não pode importar valor de outro módulo.
 */
const GRADE: GradeDoDrop = { passoX: PASSO_X, passoY: PASSO_Y };

function CanvasInterno({
  folhas = [],
  numeros = {},
  totais = {},
  arquivosDisponiveis,
  onAbrirFolha,
  onCorrigirFolha,
  onRemoverFolha,
  onMoverFolhas,
  onVoltarAoAutomatico,
  onCriarTomo,
  onCriarFolha,
  removidas = [],
  onRestaurarFolhas,
  tomosDeclarados = 0,
}: {
  /** A projeção (selo + ajuste). É a MESMA lista que a montagem lê. */
  folhas?: Folha[];
  /** Número da folha resolvido por `resolveSheetNumbers`, por id. */
  numeros?: Record<FolhaId, number | null>;
  /** Total do conjunto por id — o carimbo, ou a correção da disciplina. */
  totais?: Record<FolhaId, number | null>;
  /** Nomes de arquivo com bytes em memória — sem eles não dá para abrir a página. */
  arquivosDisponiveis?: ReadonlySet<string>;
  onAbrirFolha?: (id: FolhaId) => void;
  onCorrigirFolha?: (id: FolhaId, patch: { titulo?: string; numero?: string; total?: string; arquivo?: string; disciplina?: string }) => void;
  /** Tira a folha do conjunto (ou apaga, se ela foi criada à mão). */
  onRemoverFolha?: (id: FolhaId) => void;
  /** O arrasto terminou: escreva estes ajustes. */
  onMoverFolhas?: (entradas: { id: FolhaId; patch: Ajuste }[]) => void;
  /** Apaga os tomos decididos à mão e devolve a divisão ao automático. */
  onVoltarAoAutomatico?: () => void;
  /** Declara mais um tomo: a fileira nasce vazia e vira destino de arrasto. */
  onCriarTomo?: (proximo: number) => void;
  /** Cria uma folha sem PDF (prancha que não foi lida). */
  onCriarFolha?: () => void;
  /** As folhas tiradas do conjunto, para a barra oferecer a volta. */
  removidas?: { id: FolhaId; rotulo: string }[];
  onRestaurarFolhas?: () => void;
  /** Tomos que o usuário declarou pelo canvas (fileiras que ainda estão vazias). */
  tomosDeclarados?: number;
}) {
  const { artifacts } = useArtifactStore();
  const { results } = useConversation();

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
    (
      id: FolhaId,
      patch: {
        titulo?: string;
        numero?: string;
        total?: string;
        arquivo?: string;
        disciplina?: string;
      },
    ) => onCorrigirFolha?.(id, patch),
    [onCorrigirFolha],
  );
  const removerFolha = useCallback(
    (id: FolhaId) => onRemoverFolha?.(id),
    [onRemoverFolha],
  );

  const { nodes: derivados, edges, fileiras, fileirasDoDrop, folhasPorTomo } = useMemo(() => {
    type Item = { id: string; rank: number; type: "artifact"; data: unknown };

    /*
     * UMA FILEIRA POR TOMO. Cada tomo é um volume físico (capa → separatriz →
     * LD → suas folhas); desenhar tudo numa fileira só misturava três volumes
     * distintos numa esteira única, e não dava para ver o que pertencia a quê.
     *
     * O grupo "sem tomo" fica por último: são artefatos gerados ANTES da divisão
     * e que sobraram. Escondê-los faria o canvas mentir sobre o que existe.
     */
    /*
     * Os tomos que EXISTEM mesmo sem documento dentro: os que o usuário declarou
     * em "Nº de tomos" (gravado no payload de quem foi gerado) e aqueles para
     * onde ele já arrastou folha. É isso que dá destino ao arrasto quando o tomo
     * é novo — a fileira nasce vazia, e o gesto a preenche.
     */
    const declarados = new Set<number>();
    for (const r of results) {
      const n = (r.payload as { numTomos?: unknown } | undefined)?.numTomos;
      if (typeof n === "number" && Number.isFinite(n)) {
        for (let t = 1; t <= Math.min(99, Math.floor(n)); t++) declarados.add(t);
      }
    }
    for (const f of folhas) if (f.grupo !== undefined) declarados.add(f.grupo);
    /*
     * Nenhum documento gerado ainda, mas há folhas lidas: uma fileira nasce
     * mesmo assim. Sem isto o canvas ficava vazio entre "os selos foram lidos" e
     * "algo foi gerado" — justamente a hora natural de conferir e corrigir os
     * títulos, e a única em que não dava para mexer em nada.
     */
    if (artifacts.length === 0 && folhas.length > 0) declarados.add(1);
    // Os tomos criados pelo botão "+ Tomo": nascem vazios, e é justamente
    // por existirem vazios que há para onde arrastar.
    for (let t = 1; t <= Math.min(99, tomosDeclarados); t++) declarados.add(t);

    const grupos = agruparPorTomo(artifacts, [...declarados]);
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

    /*
     * Um documento envelheceu quando as folhas do tomo dele não são mais as que
     * ele descreve. A assinatura foi gravada no `payload` na hora de gerar; aqui
     * ela é recalculada a partir da projeção de agora. Só LD e volume listam
     * folhas — capa e separatriz não envelhecem por isso.
     */
    const porTomo = new Map<number, Folha[]>();
    grupos.forEach((g, i) => porTomo.set(g.tomo, folhasPorFileira[i]));
    const estaDesatualizado = (id: string, kind: NexoArtifactKind): boolean => {
      if (kind !== "ld" && kind !== "volume") return false;
      const gravada = (
        results.find((r) => r.artifactId === id)?.payload as { folhas?: unknown } | undefined
      )?.folhas;
      // Documento gerado antes desta versão não tem assinatura: não se inventa
      // marca para ele — uma marca que acende à toa vira ruído que se ignora.
      if (typeof gravada !== "string") return false;
      const tomo = tomoDoArtefato(id);
      return assinaturaDoTomo(porTomo.get(tomo) ?? folhas) !== gravada;
    };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const fileirasDoDrop: FileiraDoDrop[] = [];
    const folhasPorTomo = new Map<number, Folha[]>();

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
            desatualizado: estaDesatualizado(a.id, a.kind),
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

      const gradeX = cursorX;

      // A grade alarga conforme a quantidade: com 6 colunas fixas, um tomo de 200
      // folhas virava 34 linhas e o `fitView` não dava conta do projeto inteiro.
      const colunas = colunasDaGrade(daFileira.length);

      daFileira.forEach((f, i) => {
        const p = posicaoNaGrade(i, colunas);
        const id = `folha:${f.id}`;
        nodes.push({
          id,
          type: "folha",
          position: { x: cursorX + p.x, y: y + p.y },
          data: {
            id: f.id,
            numero: numeros[f.id] ?? null,
            // O total corrigido à mão (por disciplina) vence o do carimbo. A
            // derivação é do dono, não daqui: o canvas não sabe de disciplina.
            total: totais[f.id] ?? f.total ?? null,
            titulo: f.conteudo ?? "",
            disciplina: f.disciplina,
            arquivo: f.arquivo,
            // `editadoTexto`, não `editado`: depois que o primeiro arrasto congela
            // a divisão, TODA folha tem `grupo` — e a marca de "corrigido à mão"
            // acenderia no canvas inteiro, mentindo sobre o que o usuário mexeu.
            editado: f.editadoTexto,
            avulsa: f.avulsa,
            // Folha criada à mão nunca tem página para abrir: `fileName` é vazio
            // e o conjunto de arquivos disponíveis não a contém, mas ser
            // explícito aqui evita depender desse acidente.
            podeAbrir: !f.avulsa && (arquivosDisponiveis?.has(f.fileName) ?? false),
            onAbrir: abrirFolha,
            onCorrigir: corrigirFolha,
            onRemover: removerFolha,
          } satisfies FolhaNodeData,
          draggable: true,
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

      if (daFileira.length > 0) cursorX += larguraDaGrade(daFileira.length, colunas) + 60;

      depois.forEach(empurrar);

      /*
       * A geometria que o drop vai consultar. `gradeX` é o cursor de ANTES dos
       * documentos que vêm depois da grade — por isso é capturado aqui e não
       * recalculado: recalcular seria repetir a regra de layout em dois lugares.
       */
      fileirasDoDrop.push({
        tomo: grupo.tomo,
        topo: y,
        altura: alturaDaFileira(daFileira.length),
        gradeX,
        gradeY: y,
        colunas,
        folhas: daFileira.map((f) => f.id),
      });
      folhasPorTomo.set(grupo.tomo, daFileira);

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

    return { nodes, edges, fileiras, fileirasDoDrop, folhasPorTomo };
  }, [
    artifacts,
    folhas,
    numeros,
    totais,
    arquivosDisponiveis,
    abrirFolha,
    corrigirFolha,
    removerFolha,
    results,
    templates,
    tomosDeclarados,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  /*
   * A DERIVAÇÃO é a verdade: posição, rótulo e conteúdo de cada nó saem dela.
   * O estado existe porque janela de seleção e arrasto são coisas que o React
   * Flow entrega por `onNodesChange` — com nós somente-leitura, nada disso chega.
   *
   * Reconciliar preserva o que é do USUÁRIO (quais nós estão selecionados).
   * Trocar o array inteiro apagaria a seleção sempre que qualquer coisa mudasse —
   * inclusive no meio de um gesto.
   */
  const reconciliar = useCallback((novos: Node[], atuais: Node[]): Node[] => {
    const selecionados = new Set(atuais.filter((n) => n.selected).map((n) => n.id));
    return novos.map((n) => (selecionados.has(n.id) ? { ...n, selected: true } : n));
  }, []);

  /*
   * O `setState` é adiado por rAF porque `setState` SÍNCRONO no corpo do effect é
   * barrado pelo lint do React Compiler — é o mesmo jeito que `use-agent-state`
   * já usa.
   */
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setNodes((atuais) => reconciliar(derivados, atuais)),
    );
    return () => cancelAnimationFrame(raf);
  }, [derivados, reconciliar, setNodes]);

  /*
   * Fim do arrasto: traduz a coordenada em ajuste. O ponto de referência é o
   * CENTRO do nó arrastado, não o canto — soltar "em cima" de uma folha é o que o
   * gesto quer dizer, e o canto fica meio nó à esquerda do que o olho mira.
   */
  /**
   * A FRESTA sob o ponteiro, enquanto o arrasto acontece.
   *
   * Sem ela o gesto era cego: o destino só existia ao SOLTAR, e até lá quem
   * arrastava não tinha como saber entre quais duas folhas ia parar. Num tomo de
   * quinze pranchas isso é adivinhação — soltava-se para descobrir, e desfazia-se
   * para tentar de novo.
   */
  const [fresta, setFresta] = useState<{ x: number; y: number; altura: number } | null>(
    null,
  );

  const centroDoNo = useCallback(
    (no: { position: { x: number; y: number }; measured?: { width?: number; height?: number } }) => ({
      x: no.position.x + (no.measured?.width ?? LARGURA_FOLHA) / 2,
      y: no.position.y + (no.measured?.height ?? ALTURA_FOLHA) / 2,
    }),
    [],
  );

  const aoArrastar = useCallback<OnNodeDrag>(
    (_, no) => {
      if (no.type !== "folha") return;
      const alvo = alvoDoDrop(centroDoNo(no), fileirasDoDrop, GRADE);
      setFresta(
        alvo ? posicaoDaFresta(alvo, fileirasDoDrop, GRADE, ALTURA_FOLHA) : null,
      );
    },
    [centroDoNo, fileirasDoDrop],
  );

  const aoSoltar = useCallback<OnNodeDrag>(
    (_, no, arrastados) => {
      // A barra some ANTES de qualquer coisa: ela descreve uma intenção, e a
      // intenção acabou de virar (ou não) um ajuste.
      setFresta(null);
      const centro = centroDoNo(no);
      const alvo = alvoDoDrop(centro, fileirasDoDrop, GRADE);
      // Sem alvo, nada muda: soltar no vazio não inventa tomo (isso é o 4B). A
      // reconciliação devolve as folhas para a grade.
      if (alvo) {
        const ids = new Set(
          arrastados.filter((n) => n.type === "folha").map((n) => String(n.data.id)),
        );
        const movidas = folhas.filter((f) => ids.has(f.id));
        const destino = folhasPorTomo.get(alvo.tomo) ?? [];
        /*
         * A divisão que está na tela, para o módulo puro CONGELAR o palpite. Com
         * uma fileira só ela é nula: sem divisão, gravar tomo seria inventar uma
         * decisão que o usuário não tomou.
         */
        const comTomo = fileirasDoDrop.filter((f) => f.tomo > 0);
        const divisaoAtual =
          comTomo.length > 1
            ? comTomo.map((f) => ({ tomo: f.tomo, folhas: folhasPorTomo.get(f.tomo) ?? [] }))
            : null;
        const patches = ajusteDoDrop(movidas, alvo, destino, divisaoAtual, chaveDeOrdem);
        if (patches.length > 0) onMoverFolhas?.(patches);
      }
      /*
       * Reconciliar SEMPRE, mesmo sem ajuste: o nó ficou na posição solta e só a
       * derivação sabe a posição de grade. Sem isto, soltar fora deixaria a folha
       * pendurada no vazio.
       */
      setNodes((atuais) => reconciliar(derivados, atuais));
    },
    [
      centroDoNo,
      fileirasDoDrop,
      folhasPorTomo,
      folhas,
      onMoverFolhas,
      derivados,
      reconciliar,
      setNodes,
    ],
  );

  // O tomo que o "+ Tomo" vai criar: o próximo depois do maior que existe.
  const maiorTomo = fileiras.reduce((maior, f) => Math.max(maior, f.tomo), 0);

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
      <NavegacaoDoCanvas
        fileiras={fileiras}
        proximoTomo={maiorTomo + 1}
        temGrupoManual={folhas.some((f) => f.grupo !== undefined)}
        onVoltarAoAutomatico={onVoltarAoAutomatico}
        onCriarTomo={onCriarTomo ? () => onCriarTomo(maiorTomo + 1) : undefined}
        onCriarFolha={onCriarFolha}
        removidas={removidas}
        onRestaurarFolhas={onRestaurarFolhas}
      />
      <ReenquadrarAoCrescer quantidade={nodes.length} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeDrag={aoArrastar}
        onNodeDragStop={aoSoltar}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        elementsSelectable
        /*
         * Botão esquerdo no vazio DESENHA A JANELA de seleção; a tela se move
         * com o botão do meio, o direito, ou espaço + arrastar. É o gesto do
         * AutoCAD, que foi o pedido — e a única coisa que muda de hábito.
         * `selectionKeyCode={null}` evita que Shift+arrastar vire uma segunda
         * janela: Shift é o que SOMA à seleção.
         */
        selectionOnDrag
        selectionKeyCode={null}
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnScroll
      >
        <Background gap={20} size={1} color="var(--border)" />
        {/*
         * A BARRA DE INSERÇÃO. Vive num `ViewportPortal` porque precisa das
         * coordenadas do FLUXO, não da tela: ela tem de acompanhar zoom e
         * deslocamento junto com as folhas, senão aponta para a fresta errada
         * assim que alguém aproxima a vista.
         *
         * Não captura ponteiro: está no meio de um arrasto, e roubar o evento
         * mataria o gesto que ela existe para ajudar.
         */}
        {fresta && (
          <ViewportPortal>
            <div
              aria-hidden
              style={{
                position: "absolute",
                /*
                 * A barra é uma CARETA de inserção, com folga acima e abaixo da
                 * folha: uma linha da altura exata do nó se confunde com a borda
                 * do vizinho, e era por isso que ela parecia não estar
                 * funcionando. As pontas passam do cartão e não deixam dúvida.
                 */
                transform: `translate(${fresta.x - 5}px, ${fresta.y - 8}px)`,
                width: 10,
                height: fresta.altura + 16,
                pointerEvents: "none",
                /*
                 * Acima dos nós. O React Flow dá z-index próprio a cada nó e o
                 * arrastado sobe ainda mais; com z-index baixo, a barra ficava
                 * ATRÁS das folhas — desenhada, e invisível.
                 */
                zIndex: 1500,
              }}
            >
              <div className="relative h-full w-full">
                <div className="absolute inset-x-[3px] inset-y-0 rounded-full bg-[var(--primary)] shadow-[0_0_12px_3px_var(--primary)]" />
                {/* As duas pontas: leem como "entra aqui", não como borda. */}
                <div className="absolute -top-px left-0 h-[10px] w-full rounded-full bg-[var(--primary)]" />
                <div className="absolute -bottom-px left-0 h-[10px] w-full rounded-full bg-[var(--primary)]" />
              </div>
            </div>
          </ViewportPortal>
        )}
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
  totais?: Record<FolhaId, number | null>;
  arquivosDisponiveis?: ReadonlySet<string>;
  onAbrirFolha?: (id: FolhaId) => void;
  onCorrigirFolha?: (id: FolhaId, patch: { titulo?: string; numero?: string; total?: string; arquivo?: string; disciplina?: string }) => void;
  onRemoverFolha?: (id: FolhaId) => void;
  onMoverFolhas?: (entradas: { id: FolhaId; patch: Ajuste }[]) => void;
  onVoltarAoAutomatico?: () => void;
  onCriarTomo?: (proximo: number) => void;
  onCriarFolha?: () => void;
  removidas?: { id: FolhaId; rotulo: string }[];
  onRestaurarFolhas?: () => void;
  tomosDeclarados?: number;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}
