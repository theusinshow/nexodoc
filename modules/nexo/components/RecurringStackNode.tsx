"use client";

/**
 * O MESMO erro em várias páginas: uma pilha, não N cards iguais.
 *
 * Um memorial reaproveitado repete "Centro Dia do Idoso" em cinco lugares. Cinco
 * cards idênticos empurrariam o resto da auditoria para fora da tela e diriam
 * cinco problemas onde há um só, espalhado. A pilha diz o contrário: um achado,
 * ×5 páginas — e sai uma linha para cada página.
 *
 * As camadas se revezam à frente num ciclo contínuo. O cursor PAUSA o ciclo e
 * abre a lista das páginas; `prefers-reduced-motion` congela na pilha parada (o
 * repouso já é o estado legível — ver o keyframe em globals.css).
 */

import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import type { AuditSeverity } from "@/server/nexo/audit/build-audit-graph";
import { LARGURA_PAGINA, ALTURA_PILHA } from "../lib/layout-auditoria";

export type RecurringStackNodeData = {
  grupoId: string;
  achadoIds: string[];
  severity: AuditSeverity;
  tipo: string;
  evidencia: string;
  count: number;
  pages: number[];
  /** Ids acesos; null = todos acesos. */
  acesos?: string[] | null;
} & Record<string, unknown>;

const COR: Record<AuditSeverity, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};

/** Três camadas bastam para ler "pilha"; o número exato está no ×N. */
const CAMADAS = 3;
const DURACAO_S = 6;

export function RecurringStackNode({ data }: NodeProps<Node<RecurringStackNodeData>>) {
  const [aberta, setAberta] = useState(false);
  const aceso = !data.acesos || data.acesos.some((id) => data.achadoIds.includes(id));
  const cor = COR[data.severity];

  return (
    <div
      className="relative"
      style={{ width: LARGURA_PAGINA, height: ALTURA_PILHA, opacity: aceso ? 1 : 0.3 }}
      onMouseEnter={() => setAberta(true)}
      onMouseLeave={() => setAberta(false)}
    >
      {/* As camadas de trás: só moldura, sem conteúdo — o conteúdo é do topo. */}
      {Array.from({ length: CAMADAS - 1 }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 rounded-md border border-border bg-card"
          style={{
            borderLeft: `3px solid ${cor}`,
            animation: `nexodoc-pilha-ciclo ${DURACAO_S}s linear infinite`,
            animationDelay: `-${((i + 1) * DURACAO_S) / CAMADAS}s`,
            animationPlayState: aberta ? "paused" : "running",
          }}
        />
      ))}

      <div
        // Marca a camada da frente: o portão precisa medir o ciclo nela, e
        // contar filhos pegava o conector que o React Flow injeta no nó.
        data-pilha="topo"
        className="absolute inset-0 overflow-hidden rounded-md border border-border bg-card"
        style={{
          borderLeft: `3px solid ${cor}`,
          animation: `nexodoc-pilha-ciclo ${DURACAO_S}s linear infinite`,
          animationPlayState: aberta ? "paused" : "running",
        }}
      >
        <div className="flex h-full flex-col gap-0.5 px-2 py-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <p className="truncate text-[11px] font-medium leading-tight">{data.tipo}</p>
            <Badge variant="secondary">×{data.count}</Badge>
          </div>
          {data.evidencia && (
            <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
              “{data.evidencia}”
            </p>
          )}
          <p className="mt-auto truncate font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
            {aberta
              ? `p. ${data.pages.join(", ")}`
              : `${data.count} páginas · passe o cursor`}
          </p>
        </div>
      </div>

      {/* Uma linha por página: é o que mostra o alcance do erro. */}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
