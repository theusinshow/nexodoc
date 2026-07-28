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
import { AcaoDoNo } from "./AcaoDoNo";

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
            ajuda="Troca o título que a IA leu do carimbo. O texto novo sai na LD gerada depois."
            onClick={() => {
              setTexto(data.titulo);
              setCorrigindo(true);
            }}
          />
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
