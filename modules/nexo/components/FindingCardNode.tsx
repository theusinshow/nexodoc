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

const COR: Record<AuditSeverity, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};

export function FindingCardNode({ data }: NodeProps<Node<FindingCardNodeData>>) {
  const aceso = !data.acesos || data.acesos.includes(data.achadoId);

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-card transition-opacity"
      style={{
        width: LARGURA_PAGINA,
        height: ALTURA_CARTAO,
        opacity: aceso ? 1 : 0.3,
        // A faixa de cor é a severidade — a mesma do pin, para o olho ligar os
        // dois sem legenda.
        borderLeft: `3px solid ${COR[data.severity]}`,
      }}
    >
      <div className="flex h-full flex-col gap-0.5 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="truncate text-[11px] font-medium leading-tight">{data.tipo}</p>
          {/* A validação REBAIXA o incerto em vez de apagar (item 4). O canvas
              precisa dizer qual é qual, senão a sugestão vira achado. */}
          {data.tier === "sugestao" && <Badge variant="outline">Sugestão</Badge>}
        </div>
        {data.evidencia && (
          <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
            “{data.evidencia}”
          </p>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
