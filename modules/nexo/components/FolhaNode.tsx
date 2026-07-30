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
import { ExternalLink, Pencil } from "lucide-react";

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
  /** Campo VAZIO desfaz aquele ajuste e devolve o que o selo dizia. */
  onCorrigir: (
    id: FolhaId,
    patch: { titulo?: string; numero?: string; arquivo?: string },
  ) => void;
} & Record<string, unknown>;

export function FolhaNode({ data, selected }: NodeProps<Node<FolhaNodeData>>) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [texto, setTexto] = useState(data.titulo);
  const [numero, setNumero] = useState("");
  const [arquivo, setArquivo] = useState("");

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
      {/* As ações só no nó SELECIONADO: com 200 folhas na tela, botões em todas
          seriam ruído maior que o conteúdo. */}
      {selected && (
        <div className="mt-1 flex items-center gap-2">
          <AcaoDoNo
            icone={ExternalLink}
            rotulo="Abrir"
            ajuda={
              data.podeAbrir
                ? "Abre a página original desta prancha em outra aba."
                : "Os PDFs anexados não ficam guardados. Reanexe as pranchas para ver a página."
            }
            desabilitado={!data.podeAbrir}
            onClick={() => data.onAbrir(data.id)}
          />
          <AcaoDoNo
            icone={Pencil}
            rotulo="Corrigir"
            ajuda="Corrige o que a IA leu do carimbo: nº da prancha, código do arquivo e título. Os valores novos saem na LD gerada depois."
            onClick={() => {
              setTexto(data.titulo);
              setNumero(data.numero != null ? String(data.numero) : "");
              setArquivo(data.arquivo ?? "");
              setCorrigindo(true);
            }}
          />
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
          data.onCorrigir(data.id, { titulo: texto, numero, arquivo });
          setCorrigindo(false);
        }}
      >
        {/*
          Os três campos que o carimbo erra e que a tela antiga corrigia: o nº
          da prancha, o código do arquivo e o título. Ficam aqui, no lugar onde
          o engenheiro já corrigia o título — sem tela nova, e sem transformar o
          cartão de confirmação em formulário.
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
          <label className="flex flex-[2] flex-col gap-1">
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
        </div>
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
          e o nome do arquivo.
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
