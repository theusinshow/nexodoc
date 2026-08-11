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
import { PONTO_DA_SEVERIDADE } from "@/lib/audit-status";
import { cn } from "@/lib/utils";
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

/** Três camadas bastam para ler "pilha"; o número exato está no ×N. */
const CAMADAS = 3;
const DURACAO_S = 6;

export function RecurringStackNode({ data }: NodeProps<Node<RecurringStackNodeData>>) {
  const [aberta, setAberta] = useState(false);
  const aceso = !data.acesos || data.acesos.some((id) => data.achadoIds.includes(id));

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
          className="absolute inset-0 nx-edge-6"
          style={{
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
        className="absolute inset-0 overflow-hidden nx-edge-6"
        style={{
          animation: `nexodoc-pilha-ciclo ${DURACAO_S}s linear infinite`,
          animationPlayState: aberta ? "paused" : "running",
        }}
      >
        <div className="flex h-full flex-col gap-1 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", PONTO_DA_SEVERIDADE[data.severity])}
            />
            <p className="truncate text-xs font-medium leading-tight">{data.tipo}</p>
            <Badge variant="secondary" className="ml-auto tabular-nums">
              ×{data.count}
            </Badge>
          </div>
          {data.evidencia && (
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              “{data.evidencia}”
            </p>
          )}
          {/*
            As páginas ficam sempre à vista, truncadas; o cursor pausa o ciclo e
            abre a lista inteira. Antes a linha em repouso dizia "passe o cursor"
            — instrução que não existe em tela de toque, ocupando o lugar do dado.
          */}
          <p
            className={cn(
              "mt-auto font-mono text-[11px] uppercase tabular-nums tracking-[0.05em] text-muted-foreground",
              aberta ? "line-clamp-2" : "truncate",
            )}
          >
            p. {data.pages.join(", ")}
          </p>
        </div>
      </div>

      {/* Uma linha por página: é o que mostra o alcance do erro. */}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
