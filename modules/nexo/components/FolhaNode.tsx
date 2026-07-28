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

import { AgentPopover } from "@/components/ui/agent-popover";
import type { FolhaId } from "../lib/folhas";

export type FolhaNodeData = {
  id: FolhaId;
  /** Número da folha resolvido (`resolveSheetNumbers`), ou null quando não há. */
  numero: number | null;
  titulo: string;
  editado: boolean;
  /** Falso na conversa restaurada: os bytes da prancha não persistem. */
  podeAbrir: boolean;
  onAbrir: (id: FolhaId) => void;
  /** Título vazio DESFAZ o ajuste e devolve o que o selo dizia. */
  onCorrigir: (id: FolhaId, titulo: string) => void;
} & Record<string, unknown>;

export function FolhaNode({ data, selected }: NodeProps<Node<FolhaNodeData>>) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [texto, setTexto] = useState(data.titulo);

  const borda = selected
    ? "border-[var(--ring)]"
    : data.editado
      ? "border-[var(--status-warning)]"
      : "border-border";

  const corpo = (
    <div className={`w-[120px] overflow-hidden rounded-sm border ${borda} bg-card px-2 py-1.5`}>
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {data.numero != null ? String(data.numero).padStart(2, "0") : "—"}
        </span>
        {data.editado && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]"
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
          <button
            type="button"
            disabled={!data.podeAbrir}
            onClick={() => data.onAbrir(data.id)}
            title={
              data.podeAbrir
                ? "Abrir a página original"
                : "Reanexe as pranchas para ver a página"
            }
            className="nodrag nopan rounded-sm text-[10px] text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Abrir
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto(data.titulo);
              setCorrigindo(true);
            }}
            className="nodrag nopan rounded-sm text-[10px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Corrigir
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );

  return (
    <AgentPopover
      open={corrigindo}
      onClose={() => setCorrigindo(false)}
      label="Corrigir o título"
      panelClassName="w-[260px]"
      anchor={corpo}
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          data.onCorrigir(data.id, texto);
          setCorrigindo(false);
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          autoFocus
          className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 text-[11px]"
        />
        <p className="text-[10px] text-muted-foreground">
          Vazio devolve o título que o selo dizia.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCorrigindo(false)}
            className="nodrag nopan rounded-sm text-[11px] text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="nodrag nopan rounded-sm text-[11px] font-medium text-primary"
          >
            Aplicar
          </button>
        </div>
      </form>
    </AgentPopover>
  );
}
