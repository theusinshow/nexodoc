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
  useOnViewportChange,
  useUpdateNodeInternals,
  useStoreApi,
  Handle,
  Position,
  MarkerType,
  ViewportPortal,
  type Node,
  type Edge,
  type NodeProps,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useReducedMotion } from "motion/react";
import { FileSearch, Waypoints, Maximize2, MessageSquare, Trash2, SlidersHorizontal } from "lucide-react";

import type { NexoArtifactKind } from "../types";
import { DURACAO_DA_APROXIMACAO_MS, EVENTO_APROXIMAR, EVENTO_DEVOLVER } from "../lib/aproximar-no-tour";
import { useArtifactStore, type CanvasArtifact } from "../state/artifact-store";
import { useComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
import { agruparPorTomo, tomoDoArtefato, tomosDeFileira } from "../lib/results";
import { orfaosAposDivisao } from "../lib/edicao";
import { camposDoArtefato, aplicarEdicaoNoNo } from "../lib/editar-artefato";
import { parametrosDaEntrega } from "../lib/editaveis-consolidados";
import { redeParaGerar } from "../lib/rede-da-conversa";
import { aplicarIdentidade, separarIdentidade } from "../lib/identidade";
import { summarizeSelos } from "../lib/agent-context";
import type { ParagrafoDoModelo } from "@/server/odt/layout";
import { textoEmLinhasDaCapa } from "@/server/nexo/capa-linhas";
import { EditorDoNo } from "./EditorDoNo";
import { AcaoDoNo } from "./AcaoDoNo";
import { AgentPopover } from "@/components/ui/agent-popover";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildBalancedQuantities, planoPorDisciplina, repartirPorBlocos } from "@/lib/ld/ld-rules";
import { codigoNoVolume, ocultoPeloPar, repartirDaLista } from "../lib/blocos";
import { codigoDaFolha } from "../lib/disciplina-da-folha";
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
  documentoEnvelheceu,
  type FileiraDoDrop,
  type GradeDoDrop,
} from "../lib/drop-folhas";
import {
  ALTURA_DA_CABECA,
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
import { idDoVolume as idDoVolumeDe, sufixoDoTomoNoCanvas } from "../lib/tomos-do-volume";
import { CabecaDoTomo, EnchimentoDoVolume, VolumeVazioNode, useTrilho } from "./CabecaDoTomo";
import { useFasesDaMontagem, useGeradorDoPlano } from "../state/montadores-de-volume";
import { siglaDaDisciplina } from "../lib/disciplina-cor";
import type { OrigemDoNumero } from "@/server/nexo/parse-filename";
import { ehDigitacao, passoDoTeclado } from "../lib/navegacao-por-teclado";
import { divergenciasPorFolha } from "../lib/conferencia-por-folha";
import { ColunaDaConferencia, type LinhaDaConferencia } from "./ColunaDaConferencia";
import { ArtifactThumb } from "./ArtifactThumb";
import { NavegacaoDoCanvas, type FileiraNavegavel } from "./NavegacaoDoCanvas";
import { LinhaDoArrasto, type ControleDaLinha } from "./LinhaDoArrasto";
import { ArestaDaFileira } from "./ArestaDaFileira";

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
  const { fases } = useFasesDaMontagem();
  const trilho = useTrilho(data.id, 0);
  const faseDoVolume = data.kind === "volume" ? fases[data.id] : undefined;

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
        {data.kind === "volume" && <EnchimentoDoVolume fase={faseDoVolume} preenchimento={trilho.preenchimento} />}
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
      {/*
        AS SETAS CORREM NA LINHA DAS FOLHAS (07/10/2026). Capa, LD e volume são
        altos e a fileira de folhas é baixa: com a alça no meio do documento, a
        seta da LD subia ~150 px num vão de 60 e chegava torta na primeira folha.
        Todas as alças da fileira ficam no meio da primeira linha de folhas.
      */}
      <Handle type="target" position={Position.Left} className="!opacity-0" style={{ top: ALTURA_FOLHA / 2 }} />
      <Handle type="source" position={Position.Right} className="!opacity-0" style={{ top: ALTURA_FOLHA / 2 }} />
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
        /* O MESMO template que deu o layout dá o nome: dois `find` divergiriam
           no dia em que um deles mudasse de critério. */
        prefeitura={
          (data.templates ?? []).find(
            (t) => t.id === String((data.params as { templateId?: unknown })?.templateId ?? ""),
          )?.nome ?? null
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
            rede: redeParaGerar(conv.decisoes, parametrosDaEntrega(conv.results)),
            templateId: parametrosDaEntrega(conv.results).templateId,
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
}: NodeProps<Node<{ tomo: number; folhas: number; documentos?: string[] } & Record<string, unknown>>>) {
  const ehResto = data.tomo === 0;
  const { removeResult } = useConversation();
  // Excluir as sobras de uma vez (o "Excluir os 2" do Mapa do volume no lab), com
  // o mesmo "Excluir? Sim / Não" do nó: a proposta volta ao chat se precisar.
  const [confirmando, setConfirmando] = useState(false);
  const sobras = ehResto ? (data.documentos ?? []) : [];
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
        <p
          className="mt-0.5 text-[10px] leading-tight text-muted-foreground"
          title="Gerados quando a obra ainda tinha volume único. Os tomos têm capa e LD próprias; estes não entram em volume nenhum."
        >
          gerado antes de dividir, sem volume
        </p>
      )}
      {sobras.length > 0 &&
        (confirmando ? (
          <p className="mt-1 flex justify-end gap-2 text-[11px]">
            <span className="text-muted-foreground">Excluir?</span>
            <button
              type="button"
              onClick={() => sobras.forEach((id) => removeResult(id))}
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
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="nodrag nopan mt-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            {sobras.length === 1 ? "Excluir este" : `Excluir os ${sobras.length}`}
          </button>
        ))}
    </div>
  );
}

const nodeTypes = {
  artifact: ArtifactNode,
  rotulo: RotuloNode,
  folha: FolhaNode,
  cabeca: CabecaDoTomo,
  volumeVazio: VolumeVazioNode,
};

/** Até onde a porta da fresta "pega" a ponta do cabo, da porta da folha na mão (unidades do canvas). */
const RAIO_DO_IMA = LARGURA_FOLHA * 1.6;

/** Toda seta do canvas é da fileira: as pontas saem da caixa do nó, não da alça medida. */
const edgeTypes = { default: ArestaDaFileira };

const EDITAVEIS: NexoArtifactKind[] = ["capa", "ld", "separatriz"];

/*
 * As medidas da grade viajam INJETADAS até o módulo puro do drop: ele roda em
 * Node pelado no teste e não pode importar valor de outro módulo.
 */
const GRADE: GradeDoDrop = { passoX: PASSO_X, passoY: PASSO_Y };

function CanvasInterno({
  folhas = [],
  numeros = {},
  origens = {},
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
  conferencia,
  memorial = null,
  memorialArquivo = null,
}: {
  /** Os bytes do memorial, para o palco mostrar a capa enquanto a ficha é conferida. */
  memorialArquivo?: File | null;
  /**
   * O memorial desta conversa, quando há. Sem pranchas, o palco vazio fala da
   * AUDITORIA, e não do volume: uma conversa de memorial mostrava "Anexe as
   * pranchas e gere os documentos… (capa → LD → pranchas)", como se o pedido
   * fosse outro (produção, 02/10/2026).
   */
  memorial?: string | null;
  /**
   * O resultado da conferência leve que JÁ RODOU nesta conversa.
   *
   * Chega pronto de propósito: recomputar no cliente criaria uma segunda
   * verdade sobre as mesmas regras de nome, e as duas divergiriam na primeira
   * regra nova. Ausente = a conferência não foi feita, e a coluna não aparece —
   * que é diferente de "foi feita e não achou nada".
   */
  conferencia?: { findings: { severidade: string; campo: string; mensagem: string; folhas?: string[] }[] };
  /** A projeção (selo + ajuste). É a MESMA lista que a montagem lê. */
  folhas?: Folha[];
  /** Número da folha resolvido por `resolveSheetNumbers`, por id. */
  numeros?: Record<FolhaId, number | null>;
  /**
   * DE ONDE veio cada número — mão, nome do arquivo, carimbo ou ordem da
   * página. Deduzido pela mesma corrida que resolveu o número, e não por uma
   * segunda regra que poderia discordar dela.
   */
  origens?: Record<FolhaId, OrigemDoNumero | null>;
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
  const { artifacts: todosOsArtefatos } = useArtifactStore();
  const { results, blocosFundidos, juntarBlocos, separarBlocos } = useConversation();
  // A LD e a separatriz do segundo código de um par saem de cena enquanto o par
  // existe — sem apagar: separar as traz de volta (09/10/2026).
  const artifacts = useMemo(
    () => todosOsArtefatos.filter((a) => !ocultoPeloPar(a.id, blocosFundidos)),
    [todosOsArtefatos, blocosFundidos],
  );
  // O par juntado é UMA disciplina para o corte de tomos e para o "envelheceu".
  const codigoDe = useMemo(() => {
    const noVolume = codigoNoVolume(blocosFundidos);
    return (f: Folha) => noVolume(codigoDaFolha(f));
  }, [blocosFundidos]);

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

  /*
   * QUAL FOLHA ESTÁ EM CORREÇÃO — uma, no máximo.
   *
   * Sai do nó e vem para cá porque o teclado precisa de um lugar que saiba
   * QUANTOS nós estão selecionados: `E` com quarenta folhas marcadas abriria
   * quarenta formulários, e nenhum deles seria o que a pessoa quis.
   */
  const [noEmCorrecao, setNoEmCorrecao] = useState<FolhaId | null>(null);
  const pedirCorrecao = useCallback((id: FolhaId) => setNoEmCorrecao(id), []);
  const fecharCorrecao = useCallback(() => setNoEmCorrecao(null), []);

  /*
   * O QUE PESA SOBRE CADA FOLHA, vindo da conferência que já rodou.
   *
   * REUSA o resultado, não recomputa: a conferência leve é a fonte única das
   * regras de nome, e uma segunda implementação no cliente divergiria dela na
   * primeira regra nova. O índice só traduz o agregado ("pranchas com revisões
   * divergentes") para a prancha, pelo `label` que os dois lados já usam — o
   * nome do arquivo.
   */
  const porFolha = useMemo(
    () => divergenciasPorFolha(conferencia?.findings ?? []),
    [conferencia],
  );
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

  /*
   * A DIVISÃO DO PLANO antes de gerar (§7): sem capa nem LD gerados e com um
   * plano no chat, o canvas já desenha uma fileira por tomo. A capa em si fica
   * no chat (o frame do plano) — editável em cada tomo do canvas ficou confuso.
   */
  const { gerador } = useGeradorDoPlano();
  const semDocumentos = !artifacts.some((a) => a.kind === "capa" || a.kind === "ld");
  const previaNumTomos = semDocumentos && gerador?.frame ? gerador.frame.numTomos : null;
  const previaTomoInicial = gerador?.frame?.tomoInicial ?? 1;
  const previa = useMemo(
    () => (previaNumTomos === null ? null : { numTomos: previaNumTomos, tomoInicial: previaTomoInicial }),
    [previaNumTomos, previaTomoInicial],
  );

  const { nodes: derivados, edges, fileiras, fileirasDoDrop, folhasPorTomo, volumeDaFolha } = useMemo(() => {
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
    // ANTES DE GERAR, a divisão é a do plano (06/10/2026, §7): o canvas mostrava
    // "Volume · 16 folhas" com o plano propondo 2 tomos.
    if (previa && previa.numTomos > 1) for (let t = 1; t <= Math.min(99, previa.numTomos); t++) declarados.add(t);

    // Um tomo só não é divisão (ver `tomosDeFileira`): sem isto a LD de um
    // volume único aparecia "fora da divisão" e desatualizada.
    const grupos = agruparPorTomo(artifacts, tomosDeFileira([...declarados], artifacts.map((a) => a.id)));
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
      tomosReais > 1
        ? gruposDasFolhas(
            folhas,
            tomosReais,
            // O corte cai ENTRE disciplinas -- ver `repartirPorBlocos`.
            repartirDaLista(folhas, codigoDe, repartirPorBlocos, buildBalancedQuantities),
            // As disciplinas pequenas juntas, a grande separada — ver `planoPorDisciplina`.
            (l) => planoPorDisciplina(l.map(codigoDe)),
          )
        : [];
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

    // Cada fileira ganha uma faixa em cima para o cabeçalho do tomo (06/10/2026).
    const topos = topoDasFileiras(folhasPorFileira.map((fs) => alturaDaFileira(fs.length) + ALTURA_DA_CABECA));
    const codigoDoVolume = summarizeSelos(folhas).codigo;

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
      // O mesmo recorte que o documento descreve (a LD de um bloco é só da disciplina dele).
      return documentoEnvelheceu(gravada, porTomo.get(tomo) ?? folhas, codigoDe);
    };

    const nodes: Node[] = [];
    /** De que volume é cada folha, e a posição dela na fileira (para a onda). */
    const volumeDaFolha = new Map<string, { volume: string; indice: number }>();
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

      const y = topos[linha] + ALTURA_DA_CABECA;
      const ehResto = grupo.tomo === 0 && grupos.length > 1;
      const idDoVolume = idDoVolumeDe(codigoDoVolume, sufixoDoTomoNoCanvas(grupo.tomo));
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
            data: { volume: idDoVolume },
            style: { stroke: "var(--ds-nexo)", strokeWidth: 2, opacity: 0.8 },
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
            origemDoNumero: origens[f.id] ?? null,
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
            /*
             * `f.id`, e NÃO `id`: o nó se chama `folha:<id>` e a folha se chama
             * `<id>`. Comparar com o id do nó nunca casava, e o `E` chegava ao
             * canvas sem abrir nada — silêncio que parecia tecla morta. Foi a
             * prova de navegador que separou "não chegou" de "chegou e não
             * casou"; nenhum teste puro veria isso.
             */
            divergencia: porFolha.get(f.fileName),
            emCorrecao: noEmCorrecao === f.id,
            onPedirCorrecao: pedirCorrecao,
            onFecharCorrecao: fecharCorrecao,
            onCorrigir: corrigirFolha,
            onRemover: removerFolha,
          } satisfies FolhaNodeData,
          draggable: true,
        });
        volumeDaFolha.set(id, { volume: idDoVolume, indice: i });
        idsDaFileira.push(id);
        // Só a PRIMEIRA folha recebe a seta: uma seta por folha viraria 200
        // linhas cruzando a grade, e a sequência já é dada pela leitura dela.
        if (i === 0 && anterior) {
          edges.push({
            id: `${anterior}->${id}`,
            source: anterior,
            target: id,
            data: { volume: idDoVolume },
            style: { stroke: "var(--ds-nexo)", strokeWidth: 2, opacity: 0.8 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
        // A seta para o volume sai do FIM DA PRIMEIRA LINHA da grade, na altura
        // do volume — da última folha ela cruzava a grade na diagonal (06/10/2026).
        if (i === Math.min(colunas, daFileira.length) - 1) anterior = id;
      });

      if (daFileira.length > 0) cursorX += larguraDaGrade(daFileira.length, colunas) + 60;

      depois.forEach(empurrar);

      // O LUGAR DO VOLUME antes dele existir: a fileira termina onde ele vai nascer.
      if (!ehResto && daFileira.length > 0 && !grupo.itens.some((a) => a.kind === "volume")) {
        const id = `volume-vazio:${grupo.tomo}`;
        nodes.push({ id, type: "volumeVazio", position: { x: cursorX, y }, data: { idDoVolume, folhas: daFileira.length }, draggable: false, selectable: false });
        if (anterior) {
          edges.push({
            id: `${anterior}->${id}`,
            source: anterior,
            target: id,
            data: { volume: idDoVolume },
            style: { stroke: "var(--ds-nexo)", strokeWidth: 2, opacity: 0.45, strokeDasharray: "4 4" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
        idsDaFileira.push(id);
        cursorX += 260;
      }

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
      if (ehResto) {
        nodes.push({
          id: `rotulo:${grupo.tomo}`,
          type: "rotulo",
          position: { x: -150, y: y + 130 },
          data: { tomo: grupo.tomo, folhas: daFileira.length, documentos: grupo.itens.map((a) => a.id) },
          draggable: false,
          selectable: false,
        });
      } else if (daFileira.length > 0 || grupo.itens.length > 0) {
        const kinds = new Set(grupo.itens.map((a) => a.kind));
        nodes.push({
          id: `cabeca:${grupo.tomo}`,
          type: "cabeca",
          position: { x: 0, y: topos[linha] },
          data: {
            tomo: grupo.tomo,
            unico: tomosReais <= 1,
            folhas: daFileira.length,
            idDoVolume,
            pecas: { capa: kinds.has("capa"), separatriz: kinds.has("separatriz"), ld: kinds.has("ld") },
          },
          draggable: false,
          selectable: false,
        });
      }
    });

    return { nodes, edges, fileiras, fileirasDoDrop, folhasPorTomo, volumeDaFolha };
  }, [
    artifacts,
    folhas,
    numeros,
    origens,
    totais,
    arquivosDisponiveis,
    abrirFolha,
    corrigirFolha,
    removerFolha,
    /*
     * `noEmCorrecao` remonta os nós ao abrir e ao fechar a correção — e isso é
     * aceitável porque abrir a correção é um gesto raro e deliberado, não algo
     * que acontece a cada quadro. Sem ele na lista, abrir pelo teclado não
     * chegava ao nó: a derivação ficava com o valor velho e o formulário não
     * aparecia. Os dois callbacks são estáveis (`useCallback` sem dependência).
     */
    noEmCorrecao,
    porFolha,
    pedirCorrecao,
    fecharCorrecao,
    results,
    codigoDe,
    templates,
    tomosDeclarados,
    previa,
  ]);

  /*
   * A FILEIRA VIVA (06/10/2026): durante "juntando" as setas correm e as folhas
   * acendem em onda; durante "conferindo" uma varredura passa folha a folha.
   * Fica FORA do memo do layout: mudar de fase não pode recalcular o mapa.
   */
  const { fases } = useFasesDaMontagem();
  /*
   * Enquanto uma folha está na mão, a seta FIXA presa a ela some: esticada atrás
   * do arrasto, ela virava uma segunda linha competindo com a do gesto.
   */
  const [naMao, setNaMao] = useState<ReadonlySet<string>>(() => new Set());
  const edgesVivas = useMemo(
    () =>
      edges.map((e) => {
        if (naMao.has(e.source) || naMao.has(e.target)) {
          return { ...e, style: { ...e.style, opacity: 0 } };
        }
        const f = fases[(e.data as { volume?: string } | undefined)?.volume ?? ""];
        return f === "juntando" || f === "conferindo"
          ? { ...e, animated: true, style: { ...e.style, stroke: "var(--ds-nexo)", opacity: 0.9 } }
          : e;
      }),
    [edges, fases, naMao],
  );
  const derivadosVivos = useMemo(
    () =>
      derivados.map((n) => {
        const v = volumeDaFolha.get(n.id);
        const f = v ? fases[v.volume] : undefined;
        if (!v || (f !== "juntando" && f !== "conferindo")) return n;
        return {
          ...n,
          className: f === "juntando" ? "nx-onda" : "nx-varredura",
          style: { ...n.style, ["--onda-i" as string]: v.indice },
        };
      }),
    [derivados, volumeDaFolha, fases],
  );

  /*
   * O CANVAS SEGUE O TOMO EM CURSO: no "montar todos", desliza de um tomo para
   * o seguinte. Sem animação para quem reduz movimento.
   */
  const { setCenter, getZoom } = useReactFlow();
  const reduzido = useReducedMotion();
  const volumeEmCurso = Object.entries(fases).find(
    ([, f]) => f === "conferindo-versao" || f === "preparando" || f === "juntando" || f === "conferindo",
  )?.[0];
  useEffect(() => {
    if (!volumeEmCurso) return;
    const cabeca = derivados.find((n) => n.type === "cabeca" && (n.data as { idDoVolume?: string }).idDoVolume === volumeEmCurso);
    if (!cabeca) return;
    void setCenter(cabeca.position.x + 440, cabeca.position.y + 220, { zoom: getZoom(), duration: reduzido ? 0 : 600 });
  }, [volumeEmCurso, derivados, setCenter, getZoom, reduzido]);

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
      setNodes((atuais) => reconciliar(derivadosVivos, atuais)),
    );
    return () => cancelAnimationFrame(raf);
  }, [derivadosVivos, reconciliar, setNodes]);

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

  /*
   * A LINHA DO ARRASTO (Parte 8): só escuta. A origem é o centro das folhas
   * arrastadas no instante em que saem da grade; a ponta é a folha na mão, e a
   * fresta — quando há — a atrai.
   */
  const linha = useRef<ControleDaLinha>(null);
  const aoComecarArrasto = useCallback<OnNodeDrag>(
    (_, no, arrastados) => {
      if (no.type !== "folha") return;
      const folhasNaMao = arrastados.filter((n) => n.type === "folha");
      setNaMao(new Set((folhasNaMao.length > 0 ? folhasNaMao : [no]).map((n) => n.id)));
      const centros = (folhasNaMao.length > 0 ? folhasNaMao : [no]).map(centroDoNo);
      // A linha nasce na VAGA que a folha deixou: o centro dela, agora vazio.
      linha.current?.comecar(
        {
          x: centros.reduce((s, c) => s + c.x, 0) / centros.length,
          y: centros.reduce((s, c) => s + c.y, 0) / centros.length,
        },
        centros.length,
      );
    },
    [centroDoNo],
  );

  const aoArrastar = useCallback<OnNodeDrag>(
    (_, no) => {
      if (no.type !== "folha") return;
      const centro = centroDoNo(no);
      const alvo = alvoDoDrop(centro, fileirasDoDrop, GRADE);
      const posicao = alvo ? posicaoDaFresta(alvo, fileirasDoDrop, GRADE, ALTURA_FOLHA) : null;
      setFresta(posicao);
      /*
       * A PONTA SOLTA fica na borda esquerda da folha na mão — no centro ela
       * ficava escondida sob o cartão. O ÍMÃ só pega perto: `alvoDoDrop` devolve
       * destino de qualquer distância (a fileira mais próxima), e usá-lo como
       * raio fazia a linha apontar para uma fresta fora da tela em vez de seguir
       * o documento. A ponta presa encaixa no TOPO da fresta, que fica visível.
       */
      const mao = { x: no.position.x, y: no.position.y + (no.measured?.height ?? ALTURA_FOLHA) / 2 };
      const porta = posicao ? { x: posicao.x, y: posicao.y + posicao.altura / 2 } : null;
      const perto = porta && Math.hypot(mao.x - porta.x, mao.y - porta.y) <= RAIO_DO_IMA;
      linha.current?.mover(mao, perto ? porta : null);
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
      if (no.type === "folha") {
        // O cabo segue o que o drop FEZ: com destino, conecta na porta da fresta.
        const posicao = alvo ? posicaoDaFresta(alvo, fileirasDoDrop, GRADE, ALTURA_FOLHA) : null;
        linha.current?.soltar(posicao ? { x: posicao.x, y: posicao.y + posicao.altura / 2 } : null);
      }
      setNaMao(new Set());
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

  /*
   * O TECLADO, para conferir um lote sem tirar a mão dele.
   *
   * Setas andam nó a nó na ordem do canvas, `Enter` abre a página original e
   * `E` abre a correção do carimbo. A decisão de QUAL nó é a seta seleciona
   * mora em `lib/navegacao-por-teclado.ts` e é provada sem navegador.
   *
   * O ouvinte é do CONTÊINER, e não da janela: o Nexo tem um compositor de
   * conversa na mesma tela, e um atalho global roubaria a seta de quem está
   * escrevendo. `ehDigitacao` é a segunda guarda, para o campo que mora DENTRO
   * do canvas (o formulário de correção).
   */
  const idsEmOrdem = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const selecionados = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  /*
   * JUNTAR BLOCOS (09/10/2026): as folhas selecionadas cobrem exatamente duas
   * disciplinas, nenhuma delas já num par → o chip oferece juntá-las.
   */
  const juntar = useMemo(() => {
    const porIdDaFolha = new Map(folhas.map((f) => [f.id, f]));
    const jaEmPar = new Set(blocosFundidos.flat());
    const codigos = new Set<string>();
    for (const n of selecionados) {
      if (n.type !== "folha") continue;
      const folha = porIdDaFolha.get((n.data as { id?: string }).id ?? "");
      const codigo = folha ? codigoDaFolha(folha).trim().toLowerCase() : "";
      if (codigo) codigos.add(codigo);
    }
    if (codigos.size !== 2 || [...codigos].some((c) => jaEmPar.has(c))) return undefined;
    const [a, b] = [...codigos];
    return { rotulo: `Juntar ${a.toUpperCase()} e ${b.toUpperCase()}`, aoJuntar: () => juntarBlocos(a, b) };
  }, [selecionados, folhas, blocosFundidos, juntarBlocos]);
  const pares = useMemo(
    () =>
      blocosFundidos.map(([a, b]) => ({
        rotulo: `${a.toUpperCase()} + ${b.toUpperCase()}`,
        aoSeparar: () => separarBlocos(a),
      })),
    [blocosFundidos, separarBlocos],
  );
  /** Só há "o nó selecionado" quando é UM. Com quarenta marcados, `E` não tem alvo. */
  const alvoDoTeclado = selecionados.length === 1 ? selecionados[0] : null;
  const fluxoDoTeclado = useReactFlow();

  const aoTeclar = useCallback(
    (evento: React.KeyboardEvent<HTMLDivElement>) => {
      if (ehDigitacao(evento.target as HTMLElement | null)) return;

      const passo = passoDoTeclado(evento.key, idsEmOrdem, alvoDoTeclado?.id ?? null);
      if (passo.consumiu) {
        evento.preventDefault();
        const destino = passo.proximo;
        if (!destino) return;
        setNodes((atuais) => atuais.map((n) => ({ ...n, selected: n.id === destino })));
        const no = nodes.find((n) => n.id === destino);
        if (no) {
          /*
           * Centrar SEM mexer no zoom: quem confere escolheu a aproximação, e
           * reenquadrar a cada seta faria a tela pular de perto para longe a
           * cada folha. A duração curta mantém a noção de para onde se andou.
           */
          const c = centroDoNo(no);
          fluxoDoTeclado.setCenter(c.x, c.y, {
            zoom: fluxoDoTeclado.getZoom(),
            duration: 180,
          });
        }
        return;
      }

      if (!alvoDoTeclado) return;

      if (evento.key === "Enter") {
        const dados = alvoDoTeclado.data as Partial<FolhaNodeData>;
        // Folha restaurada de outra máquina não tem PDF: abrir seria prometer
        // uma aba que nasce vazia.
        if (alvoDoTeclado.type === "folha" && dados.podeAbrir && dados.id) {
          evento.preventDefault();
          abrirFolha(dados.id);
        }
        return;
      }

      if (evento.key === "e" || evento.key === "E") {
        const dados = alvoDoTeclado.data as Partial<FolhaNodeData>;
        if (alvoDoTeclado.type === "folha" && dados.id) {
          evento.preventDefault();
          pedirCorrecao(dados.id);
        }
      }
    },
    [
      abrirFolha,
      alvoDoTeclado,
      centroDoNo,
      fluxoDoTeclado,
      idsEmOrdem,
      nodes,
      pedirCorrecao,
      setNodes,
    ],
  );

  /*
   * AS LINHAS DA COLUNA saem dos MESMOS nós, na MESMA ordem.
   *
   * Montar a lista de outra fonte (as folhas cruas, por exemplo) criaria duas
   * ordens para a mesma coisa, e a coluna passaria a discordar do mapa
   * justamente quando o engenheiro reordenasse um tomo — que é quando ele mais
   * precisa que as duas concordem.
   */
  const linhasDaConferencia = useMemo<LinhaDaConferencia[]>(
    () =>
      nodes
        .filter((n) => n.type === "folha")
        .map((n) => {
          const d = n.data as Partial<FolhaNodeData>;
          return {
            idDoNo: n.id,
            numero: d.numero ?? null,
            sigla: siglaDaDisciplina(d.disciplina),
            titulo: d.titulo ?? "",
            divergencia: d.divergencia,
          };
        }),
    [nodes],
  );

  const escolherPelaColuna = useCallback(
    (idDoNo: string) => {
      setNodes((atuais) => atuais.map((n) => ({ ...n, selected: n.id === idDoNo })));
      const no = nodes.find((n) => n.id === idDoNo);
      if (no) {
        const c = centroDoNo(no);
        // O zoom é de quem confere: clicar na linha aproxima a folha sem
        // reenquadrar o volume inteiro por baixo dela.
        fluxoDoTeclado.setCenter(c.x, c.y, { zoom: fluxoDoTeclado.getZoom(), duration: 180 });
      }
    },
    [centroDoNo, fluxoDoTeclado, nodes, setNodes],
  );

  // O tomo que o "+ Tomo" vai criar: o próximo depois do maior que existe.
  const maiorTomo = fileiras.reduce((maior, f) => Math.max(maior, f.tomo), 0);

  if (nodes.length === 0 && memorial) {
    return (
      <div className="nx-palco-vazio" data-palco-vazio="memorial">
        {memorialArquivo ? <CapaDoMemorial arquivo={memorialArquivo} /> : <FileSearch aria-hidden />}
        <p>
          <b>{memorial}</b>
          O parecer da auditoria aparece aqui. Confira a ficha do memorial no chat; estando certa, clique em “Conferi — auditar”.
        </p>
      </div>
    );
  }

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
    <div
      /*
       * `tabIndex` para o contêiner poder RECEBER a tecla. Sem ele o canvas
       * nunca tem foco e o ouvinte abaixo nunca dispara — o atalho existiria só
       * no código.
       */
      tabIndex={0}
      onKeyDown={aoTeclar}
      role="application"
      aria-label="Mapa do volume — setas andam entre as folhas, Enter abre a página, E corrige o carimbo"
      className="group flex h-full min-h-[320px] w-full gap-2 overflow-hidden rounded-md border border-border bg-[var(--nexodoc-recessed)] p-0 outline-none focus-visible:border-[var(--ring)]"
    >
      {/* O fluxo e o que flutua sobre ELE (barra, dica, fresta) ficam numa
          caixa própria: a coluna é irmã, não sobreposta. */}
      <div className="relative min-w-0 flex-1">
      {/*
        A DICA APARECE QUANDO O ATALHO ESTÁ VIVO.
 
        Permanente, ela seria ruído sobre duzentas folhas; escondida atrás de um
        "?" que ninguém abre, seria documentação para ninguém. Com
        `focus-within` ela nasce no instante em que o canvas passa a receber
        tecla — que é exatamente quando a informação vale.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-3 right-3 z-10 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground opacity-0 transition-opacity duration-[var(--duration-base)] group-focus-within:opacity-100"
      >
        setas andam · enter abre · e corrige
      </div>
      <NavegacaoDoCanvas
        temFolhas={folhas.length > 0}
        fileiras={fileiras}
        proximoTomo={maiorTomo + 1}
        temGrupoManual={folhas.some((f) => f.grupo !== undefined)}
        onVoltarAoAutomatico={onVoltarAoAutomatico}
        onCriarTomo={onCriarTomo ? () => onCriarTomo(maiorTomo + 1) : undefined}
        onCriarFolha={onCriarFolha}
        removidas={removidas}
        onRestaurarFolhas={onRestaurarFolhas}
        juntar={juntar}
        pares={pares}
      />
      <ReenquadrarAoCrescer quantidade={nodes.length} />
      <AproximarNoTour />
      <RemedirAlcas ids={idsEmOrdem} />
      <ReactFlow
        nodes={nodes}
        edges={edgesVivas}
        onNodesChange={onNodesChange}
        onNodeDragStart={aoComecarArrasto}
        onNodeDrag={aoArrastar}
        onNodeDragStop={aoSoltar}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        /*
         * O TECLADO É DO CANVAS, não de cada nó.
         *
         * A a11y de teclado do xyflow move o NÓ com as setas. Aqui a posição é
         * derivada do arranjo em fileiras (o `useMemo` que monta os nós), então
         * mover por tecla escrevia uma coordenada que o próximo render
         * descartava — gesto sem efeito, competindo com a navegação que a
         * conferência precisa.
         */
        disableKeyboardA11y
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
        <ViewportPortal>
          <LinhaDoArrasto ref={linha} reduzido={Boolean(reduzido)} />
        </ViewportPortal>
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
                {/* A fresta é só a ranhura: o anel e o raio do cabo são o sinal forte. */}
                <div className="absolute inset-y-[8px] left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-[var(--ds-nexo)] opacity-60" />
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
      {conferencia && (
        <ColunaDaConferencia
          linhas={linhasDaConferencia}
          selecionado={alvoDoTeclado?.id ?? null}
          onEscolher={escolherPelaColuna}
        />
      )}
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
/**
 * O tour pede para chegar perto de um nó (o cabeçalho do tomo, a 0,4 de zoom,
 * era um risco sob o holofote) e depois devolve o enquadramento que a pessoa
 * tinha. Ver [[aproximar-no-tour.ts]].
 */
function AproximarNoTour() {
  const fluxo = useReactFlow();
  const reduzido = useReducedMotion();
  useEffect(() => {
    let salvo: Viewport | null = null;
    const duracao = reduzido ? 0 : DURACAO_DA_APROXIMACAO_MS;
    /*
     * CHEGA PERTO DO ALVO, e não do nó (10/10/2026). Era `fitView` no nó — mas o
     * nó é a fileira do tomo, com todas as folhas: com 6 tomos o "Montar" saía
     * com 50px e o cabeçalho, um risco. Agora centra o próprio alvo, no zoom em
     * que ele ocupa até 85% da largura do mapa, sem passar de 1:1.
     */
    const aproximar = (e: Event) => {
      const seletor = (e as CustomEvent<string>).detail;
      const alvo = document.querySelector<HTMLElement>(seletor);
      const caixa = alvo?.closest<HTMLElement>(".react-flow");
      if (!alvo || !caixa) return;
      const vp = fluxo.getViewport();
      const rc = caixa.getBoundingClientRect();
      const ra = alvo.getBoundingClientRect();
      if (rc.width === 0 || ra.width === 0) return;
      // Um `zoom` de CSS num ancestral (o `.ds`) muda a escala entre a tela e o fluxo.
      const escala = caixa.offsetWidth / rc.width;
      const cx = ((ra.left + ra.width / 2 - rc.left) * escala - vp.x) / vp.zoom;
      const cy = ((ra.top + ra.height / 2 - rc.top) * escala - vp.y) / vp.zoom;
      const larguraNoFluxo = (ra.width * escala) / vp.zoom;
      // O piso é o enquadramento da PESSOA, e não o atual: o passo anterior pode
      // ter chegado a 1:1, e um alvo mais largo precisa afastar para caber.
      salvo ??= vp;
      const zoom = Math.min(1, Math.max(salvo.zoom, (caixa.offsetWidth * 0.85) / larguraNoFluxo));
      void fluxo.setCenter(cx, cy, { zoom, duration: duracao });
    };
    const devolver = () => {
      if (!salvo) return;
      void fluxo.setViewport(salvo, { duration: duracao });
      salvo = null;
    };
    window.addEventListener(EVENTO_APROXIMAR, aproximar);
    window.addEventListener(EVENTO_DEVOLVER, devolver);
    return () => {
      window.removeEventListener(EVENTO_APROXIMAR, aproximar);
      window.removeEventListener(EVENTO_DEVOLVER, devolver);
    };
  }, [fluxo, reduzido]);
  return null;
}

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
 * REMEDE AS ALÇAS quando a vista assenta ou o palco muda de tamanho.
 *
 * O React Flow mede a posição de cada alça uma vez e só volta a medir quando o
 * NÓ muda de tamanho. Medida num momento em que a tela e o zoom guardado não
 * batem, a alça fica deslocada para sempre: a seta nascia ~30 px fora da capa e
 * da LD (07/10/2026, visto no navegador do Matheus; não reproduzido no headless).
 * Remedir no fim de cada movimento e de cada redimensionamento custa uma leitura
 * de DOM por nó, fora do gesto.
 */
function RemedirAlcas({ ids }: { ids: string[] }) {
  const remedir = useUpdateNodeInternals();
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);
  const tudo = useCallback(() => {
    if (idsRef.current.length > 0) remedir(idsRef.current);
  }, [remedir]);
  useOnViewportChange({ onEnd: tudo });
  const { domNode } = useStoreApi().getState();
  useEffect(() => {
    if (!domNode) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tudo);
    });
    ro.observe(domNode);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [domNode, tudo]);
  return null;
}

/**
 * O `useReactFlow` só funciona DENTRO de um provider, e navegar
 * programaticamente (ir para um tomo, reenquadrar) depende dele.
 */
export function NexoCanvas(props: {
  folhas?: Folha[];
  numeros?: Record<FolhaId, number | null>;
  origens?: Record<FolhaId, OrigemDoNumero | null>;
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
  conferencia?: { findings: { severidade: string; campo: string; mensagem: string; folhas?: string[] }[] };
  memorial?: string | null;
  memorialArquivo?: File | null;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}

/**
 * A CAPA DO MEMORIAL NO PALCO (auditoria UX do memorial, 07/10/2026, U08).
 *
 * Enquanto a ficha é conferida no chat, o centro da tela era um ícone e uma
 * frase mandando olhar para a direita. A capa real é o que a ficha resume: com
 * ela ao lado, conferir o nome da obra é comparar o que está escrito com o que
 * foi lido — sem abrir o PDF em outro programa.
 */
/*
 * O ENDEREÇO DO ARQUIVO SÓ SAI QUANDO NINGUÉM MAIS O USA. Revogar na limpeza do
 * efeito quebrava a capa no StrictMode do dev: o React monta, desmonta e monta
 * de novo, e a segunda montagem reaproveitava o `blob:` já revogado ("Unexpected
 * server response (0) while retrieving PDF"). A revogação espera um quadro e
 * confere se alguma montagem voltou a usá-lo.
 */
const usosDaCapa = new Map<string, number>();

function CapaDoMemorial({ arquivo }: { arquivo: File }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);
  useEffect(() => {
    usosDaCapa.set(url, (usosDaCapa.get(url) ?? 0) + 1);
    return () => {
      usosDaCapa.set(url, (usosDaCapa.get(url) ?? 1) - 1);
      setTimeout(() => {
        if ((usosDaCapa.get(url) ?? 0) > 0) return;
        usosDaCapa.delete(url);
        URL.revokeObjectURL(url);
      }, 0);
    };
  }, [url]);
  return (
    <div className="nx-capa-do-memorial" aria-label={`Capa de ${arquivo.name}`}>
      <ArtifactThumb pdfUrl={url} pageNumber={1} width={300} kind="auditoria" />
    </div>
  );
}
