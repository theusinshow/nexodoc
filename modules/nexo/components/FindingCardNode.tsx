"use client";

/**
 * Card de UM achado no canvas da auditoria. Fica logo abaixo da página a que
 * pertence, ligado a ela por uma linha — passar o cursor acende o par e apaga o
 * resto (Modelo 2 do spec).
 *
 * O card diz O QUÊ; o pin na miniatura diz ONDE. Sem o card, a vista dependia do
 * tooltip do pin, que some quando o cursor sai — e um achado que só existe
 * enquanto o mouse está parado em cima não é uma leitura, é um esconde-esconde.
 */

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { PONTO_DA_SEVERIDADE } from "@/lib/audit-status";
import { cn } from "@/lib/utils";
import type { AuditSeverity } from "@/server/nexo/audit/build-audit-graph";
import type { FindingTier } from "@/lib/audit-report";
import { LARGURA_PAGINA, ALTURA_CARTAO } from "../lib/layout-auditoria";

export type FindingCardNodeData = {
  achadoId: string;
  severity: AuditSeverity;
  tier: FindingTier;
  tipo: string;
  evidencia: string;
  /** Página do achado; ausente no bloco "sem página localizada". */
  pageNumber?: number | null;
  /** Ids acesos; null = todos acesos. */
  acesos?: string[] | null;
} & Record<string, unknown>;

export function FindingCardNode({ data }: NodeProps<Node<FindingCardNodeData>>) {
  const aceso = !data.acesos || data.acesos.includes(data.achadoId);

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-card transition-opacity"
      style={{ width: LARGURA_PAGINA, height: ALTURA_CARTAO, opacity: aceso ? 1 : 0.3 }}
    >
      <div className="flex h-full flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {/*
            A severidade é um PONTO, não uma faixa lateral: borda de acento com
            mais de 1px é proibida (DESIGN.md §11), e o ponto é o mesmo sinal que
            o veredito e o pin usam — o olho liga os três sem legenda.
          */}
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", PONTO_DA_SEVERIDADE[data.severity])}
          />
          <p className="truncate text-xs font-medium leading-tight">{data.tipo}</p>
          {/* A validação REBAIXA o incerto em vez de apagar (item 4). O canvas
              precisa dizer qual é qual, senão a sugestão vira achado. */}
          {data.tier === "sugestao" && (
            <Badge variant="outline" className="ml-auto">
              Sugestão
            </Badge>
          )}
        </div>
        {data.evidencia && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            “{data.evidencia}”
          </p>
        )}
        {/* A página no próprio card: a linha até a miniatura pode estar longe
            do olho, e o card precisa se sustentar sozinho. */}
        <p className="mt-auto font-mono text-[11px] uppercase tabular-nums tracking-[0.05em] text-muted-foreground">
          {data.pageNumber ? `p. ${data.pageNumber}` : "sem página"}
        </p>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
