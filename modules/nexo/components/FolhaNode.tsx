"use client";

/**
 * Uma folha (prancha) como nó do canvas. BARATO de propósito: texto puro, nenhum
 * PDF renderizado — um projeto pode ter 200+ folhas, e miniatura em todas
 * trocaria este trabalho por um trabalho sobre performance.
 *
 * O nó mostra o que o selo diz. Quando algum campo veio de ajuste manual
 * (`editado`), ele se marca — sem a marca o usuário não distingue o que o sistema
 * leu do que ele mesmo mudou.
 */

import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { AgentPopover } from "@/components/ui/agent-popover";
import { Button } from "@/components/ui/button";
import type { FolhaId } from "../lib/folhas";
import { corDaDisciplina, siglaDaDisciplina } from "../lib/disciplina-cor";
import { AcaoDoNo } from "./AcaoDoNo";

export type FolhaNodeData = {
  id: FolhaId;
  /** Número da folha resolvido (`resolveSheetNumbers`), ou null quando não há. */
  numero: number | null;
  /** Total de folhas do conjunto — o "24" de "05/24". */
  total?: number | null;
  titulo: string;
  /** Disciplina lida do carimbo: vira a sigla e o fio de cor no topo. */
  disciplina?: string | null;
  editado: boolean;
  /** Falso na conversa restaurada: os bytes da prancha não persistem. */
  podeAbrir: boolean;
  onAbrir: (id: FolhaId) => void;
  /** Código da prancha (campo ARQUIVO do carimbo) — sai na coluna ARQUIVOS da LD. */
  arquivo?: string | null;
  /** Criada à mão: não há PDF por trás dela, então ela não entra no volume. */
  avulsa?: boolean;
  /** Campo VAZIO desfaz aquele ajuste e devolve o que o selo dizia. */
  onCorrigir: (
    id: FolhaId,
    patch: {
      titulo?: string;
      numero?: string;
      total?: string;
      arquivo?: string;
      disciplina?: string;
    },
  ) => void;
  /** Tira a folha do conjunto (ou apaga de vez, se ela foi criada à mão). */
  onRemover: (id: FolhaId) => void;
} & Record<string, unknown>;

/**
 * As disciplinas do escritório, para a lista de sugestão do campo.
 *
 * É `datalist` e não `select`: a lista fechada recusaria a disciplina que o
 * escritório ainda não catalogou, e a folha ficaria sem bloco por causa de um
 * campo — o pior jeito de perder um documento.
 */
const DISCIPLINAS_SUGERIDAS = [
  "Arquitetonico",
  "Urbanismo",
  "Paisagismo",
  "Maquete",
  "Fundacoes",
  "Estrutural",
  "Estrutura metalica",
  "Eletrico",
  "Cabeamento estruturado",
  "CFTV",
  "Hidrossanitario",
  "Preventivo contra incendio",
  "SPDA",
  "Climatizacao",
  "Gases medicinais",
  "Topografia",
  "Sondagem",
  "Levantamento",
  "Geometrico",
  "Terraplenagem",
  "Drenagem",
  "Pavimentacao",
];

export function FolhaNode({ data, selected }: NodeProps<Node<FolhaNodeData>>) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState(data.titulo);
  const [numero, setNumero] = useState("");
  const [total, setTotal] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [disciplina, setDisciplina] = useState("");

  /*
   * "Corrigido à mão" é ÊNFASE, não status: o valor não está errado nem certo —
   * ele veio de uma pessoa em vez do carimbo. Era âmbar, e âmbar aqui dizia
   * "atenção, tem algo errado com esta folha", que é justamente o contrário.
   */
  const borda = selected
    ? "border-[var(--ring)]"
    : data.editado
      ? "border-[var(--nexodoc-tertiary-strong)]"
      : "border-border";

  const cor = corDaDisciplina(data.disciplina);
  const sigla = siglaDaDisciplina(data.disciplina);
  const semNumero = data.numero == null;
  /*
   * Folha criada à mão SEM código não sai na LD: a proposta descarta o selo que
   * não tem nem arquivo nem nome, e o código é a única coisa que uma folha sem
   * PDF tem para se identificar. Uma linha que o engenheiro criou e não aparece
   * no documento é pior do que não ter podido criá-la — então isto é dito no nó.
   */
  const semCodigo = data.avulsa === true && !data.arquivo?.trim();

  const corpo = (
    <div className={`w-[120px] overflow-hidden rounded-sm border ${borda} bg-card`}>
      {/*
       * O fio de 2px no topo é a disciplina — a ÚNICA cor do nó, e secundária à
       * sigla: quem não distingue matiz continua lendo "ARQ". Disciplina fora
       * das oito famílias não ganha cor: sem cor é melhor que cor errada.
       */}
      <div
        className="h-0.5 w-full"
        style={{ background: cor ?? "transparent" }}
        aria-hidden
      />
      <div className="px-2 py-1.5">
      <div className="flex items-center gap-1">
        {/* O travessão em rust marca a AUSÊNCIA do número sem chamar de erro:
            a folha continua arrastável e continua entrando no volume. */}
        <span
          className={`font-mono text-[10px] tabular-nums ${
            semNumero
              ? "text-[var(--nexodoc-tertiary-strong)]"
              : "text-muted-foreground"
          }`}
        >
          {semNumero ? "—" : String(data.numero).padStart(2, "0")}
          {data.total ? `/${String(data.total).padStart(2, "0")}` : ""}
        </span>
        {sigla && (
          <span className="font-mono text-[10px] tracking-[0.05em] text-muted-foreground">
            · {sigla}
          </span>
        )}
        {data.editado && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--nexodoc-tertiary-strong)]"
            title="corrigido à mão"
            aria-label="corrigido à mão"
          />
        )}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight" title={data.titulo}>
        {data.titulo || "—"}
      </p>
      {/*
        A folha sem PDF é DIFERENTE das outras e precisa parecer diferente: ela
        entra na lista de documentos e não entra no volume montado. Quem for
        montar tem de saber disso olhando, não descobrindo no PDF final.
      */}
      {data.avulsa && (
        <p
          className={
            semCodigo
              ? "mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--status-warning)]"
              : "mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground"
          }
        >
          {semCodigo ? "sem código · não sai na LD" : "sem PDF · só na LD"}
        </p>
      )}
      {/* As ações só no nó SELECIONADO: com 200 folhas na tela, botões em todas
          seriam ruído maior que o conteúdo. */}
      {selected && !confirmando && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <AcaoDoNo
            icone={ExternalLink}
            rotulo="Abrir"
            ajuda={
              data.avulsa
                ? "Esta folha foi criada à mão: não existe PDF para abrir."
                : data.podeAbrir
                  ? "Abre a página original desta prancha em outra aba."
                  : "Os PDFs anexados não ficam guardados. Reanexe as pranchas para ver a página."
            }
            desabilitado={!data.podeAbrir}
            onClick={() => data.onAbrir(data.id)}
          />
          <AcaoDoNo
            icone={Pencil}
            rotulo="Corrigir"
            ajuda="Corrige o que a IA leu do carimbo: nº da prancha, total do conjunto, código do arquivo, disciplina e título. Os valores novos saem na LD gerada depois."
            onClick={() => {
              setTexto(data.titulo);
              setNumero(data.numero != null ? String(data.numero) : "");
              setTotal(data.total != null ? String(data.total) : "");
              setArquivo(data.arquivo ?? "");
              setDisciplina(data.disciplina ?? "");
              setCorrigindo(true);
            }}
          />
          <AcaoDoNo
            icone={Trash2}
            rotulo="Remover"
            ajuda={
              data.avulsa
                ? "Apaga esta folha criada à mão. Ela não veio de PDF nenhum, então não há o que restaurar."
                : "Tira esta folha da LD, do volume e da conferência. Dá para trazer de volta pela barra do canvas."
            }
            tom="perigo"
            onClick={() => setConfirmando(true)}
          />
        </div>
      )}
      {/*
        Confirmação INLINE, no próprio nó — o mesmo padrão do nó de artefato.
        Remover é reversível (ou, na folha criada à mão, é desfazer o que a
        própria pessoa criou há pouco), então um modal custaria mais atenção do
        que a decisão vale.
      */}
      {selected && confirmando && (
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">
            {data.avulsa ? "Apagar?" : "Remover?"}
          </span>
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              data.onRemover(data.id);
            }}
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
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      </div>
    </div>
  );

  return (
    <AgentPopover
      open={corrigindo}
      onClose={() => setCorrigindo(false)}
      label="Corrigir a folha"
      panelClassName="w-[280px]"
      anchor={corpo}
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          data.onCorrigir(data.id, { titulo: texto, numero, total, arquivo, disciplina });
          setCorrigindo(false);
        }}
      >
        {/*
          Os campos que o carimbo erra e que a tela antiga corrigia: o nº da
          prancha, o código do arquivo, a disciplina e o título. Ficam aqui, no
          lugar onde o engenheiro já corrigia o título — sem tela nova, e sem
          transformar o cartão de confirmação em formulário.
        */}
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
              Nº da prancha
            </span>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="—"
              autoFocus
              className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 font-mono text-[11px] tabular-nums"
            />
          </label>
          {/*
            O TOTAL é o "/24" do carimbo — e é ele que diz quantas folhas
            deveriam existir. Sai do total dominante lido pela IA, e quando o
            OCR erra na maioria das pranchas a conferência acusa folhas
            faltando num conjunto completo. Vale para a DISCIPLINA inteira,
            porque é assim que o carimbo é impresso: todas as folhas de uma
            disciplina dizem o mesmo total.
          */}
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
              de (total)
            </span>
            <input
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="—"
              className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 font-mono text-[11px] tabular-nums"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
            Código do arquivo
          </span>
          <input
            value={arquivo}
            onChange={(e) => setArquivo(e.target.value)}
            placeholder="040_26_arq_005_a"
            className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 font-mono text-[11px]"
          />
        </label>
        {/*
          A DISCIPLINA decide em que bloco do volume a folha entra — e, com ela,
          sob qual separatriz e em qual LD a prancha vai sair impressa. Era o
          único campo do carimbo sem conserto: quando o OCR lia errado, a folha
          ia para o bloco errado do volume e não havia onde dizer que não.
        */}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
            Disciplina
          </span>
          <input
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            list="nexo-disciplinas"
            placeholder="Drenagem"
            className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 text-[11px]"
          />
          <datalist id="nexo-disciplinas">
            {DISCIPLINAS_SUGERIDAS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
            Título
          </span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 text-[11px]"
          />
        </label>
        <p className="text-[10px] leading-4 text-muted-foreground">
          Campo vazio devolve o que o selo dizia. O nº posto aqui vence o carimbo
          e o nome do arquivo; a disciplina posta aqui manda no bloco do volume.
          O <strong className="font-medium text-foreground">total</strong> vale
          para a disciplina inteira — é ele que diz quantas folhas deveriam
          existir, na LD e na conferência.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCorrigindo(false)}
            className="nodrag nopan"
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" className="nodrag nopan">
            Aplicar
          </Button>
        </div>
      </form>
    </AgentPopover>
  );
}
