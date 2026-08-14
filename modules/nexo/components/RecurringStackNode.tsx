"use client";

/**
 * O MESMO erro em várias páginas: uma pilha, não N cards iguais.
 *
 * Um memorial reaproveitado repete "Centro Dia do Idoso" em cinco lugares. Cinco
 * cards idênticos empurrariam o resto da auditoria para fora da tela e diriam
 * cinco problemas onde há um só, espalhado. A pilha diz o contrário: um achado,
 * ×5 páginas — e sai uma linha para cada página.
 *
 * AS CAMADAS PARARAM DE GIRAR.
 *
 * Elas se revezavam à frente num ciclo de 6s, e o cursor pausava. O movimento
 * não dizia nada que o "×5" já não dissesse, e numa tela cujo defeito histórico
 * é excesso de movimento (o "piscando" que custou uma investigação inteira),
 * animação contínua que só decora é a primeira a sair. A pilha continua sendo
 * três camadas — a leitura de "isto é vários" vem da FORMA, não da rotação.
 *
 * NO LUGAR, PÍLULAS QUE NAVEGAM: cada página do erro vira um chip clicável que
 * leva a câmera até aquele nó. A lista de páginas era texto, e texto não leva a
 * lugar nenhum — quem via "p. 3, 7, 14, 22" tinha de achar as quatro à mão num
 * canvas de 28 páginas.
 */

import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { PONTO_DA_SEVERIDADE } from "@/lib/audit-status";
import { cn } from "@/lib/utils";
import type { AuditSeverity } from "@/server/nexo/audit/build-audit-graph";
import { LARGURA_PAGINA, ALTURA_PILHA, idDaPagina } from "../lib/layout-auditoria";
import { useAlgumAceso, useRealce } from "./audit-canvas-realce";

export type RecurringStackNodeData = {
  grupoId: string;
  achadoIds: string[];
  severity: AuditSeverity;
  tipo: string;
  evidencia: string;
  count: number;
  pages: number[];
} & Record<string, unknown>;

/** Três camadas bastam para ler "pilha"; o número exato está no ×N. */
const CAMADAS = 3;
/** O quanto cada camada de trás escapa da da frente. */
const DESLOCAMENTO = 4;
/** Quantas pílulas cabem antes de virar "e mais N". */
const PILULAS_VISIVEIS = 4;

export function RecurringStackNode({ data }: NodeProps<Node<RecurringStackNodeData>>) {
  // Aceso = alguma das páginas deste erro está em foco. Ver o porquê de vir do
  // contexto em [[audit-canvas-realce.tsx]].
  const aceso = useAlgumAceso(data.achadoIds);
  const { acender, apagar } = useRealce();
  const { fitView } = useReactFlow();

  const visiveis = data.pages.slice(0, PILULAS_VISIVEIS);
  const resto = data.pages.length - visiveis.length;

  /*
   * A CÂMERA VAI ATÉ A PÁGINA, e o achado acende junto.
   *
   * `fitView` com um nó só é o `setCenter` sem ter de ler a posição à mão — ele
   * já sabe onde o nó está e respeita o zoom máximo. Sem o `maxZoom` ele
   * aproximaria até a página encher a tela, e quem salta de um erro repetido
   * quer ver a página NO contexto das vizinhas.
   */
  const irParaPagina = (pagina: number) => {
    void fitView({ nodes: [{ id: idDaPagina(pagina) }], duration: 400, maxZoom: 1 });
  };

  return (
    <div
      className={cn("relative cursor-pointer", aceso && "[--nx-edge:var(--ring)]")}
      style={{ width: LARGURA_PAGINA, height: ALTURA_PILHA }}
    >
      {/* As camadas de trás: só moldura, sem conteúdo — o conteúdo é do topo.
          Deslocadas em vez de giradas: a pilha se lê parada. */}
      {Array.from({ length: CAMADAS - 1 }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 nx-edge-6"
          style={{
            transform: `translate(${(i + 1) * DESLOCAMENTO}px, ${(i + 1) * DESLOCAMENTO}px)`,
          }}
        />
      ))}

      <div
        // Marca a camada da frente: o portão precisa medi-la, e contar filhos
        // pegava o conector que o React Flow injeta no nó.
        data-pilha="topo"
        className="absolute inset-0 overflow-hidden nx-edge-6"
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
            AS PÁGINAS VIRARAM BOTÕES. Eram texto — "p. 3, 7, 14, 22" — e quem
            queria conferir a página 14 tinha de achá-la à mão entre 28. Cada
            pílula leva a câmera até lá.

            `nodrag` é do React Flow: sem ela, apertar a pílula arrasta a pilha.
            E o `stopPropagation` impede que o clique suba para `onNodeClick`, que
            abriria o parecer em vez de mover a câmera.
          */}
          <div className="mt-auto flex flex-wrap items-center gap-1">
            {visiveis.map((pagina) => (
              <button
                key={pagina}
                type="button"
                onMouseEnter={() => acender(data.achadoIds)}
                onMouseLeave={apagar}
                onClick={(ev) => {
                  ev.stopPropagation();
                  irParaPagina(pagina);
                }}
                aria-label={`Ir para a página ${pagina}`}
                className="nodrag nx-cut-4 bg-[var(--nexodoc-raised)] px-1.5 py-0.5 font-mono text-[11px] uppercase tabular-nums tracking-[0.05em] text-muted-foreground transition-colors hover:bg-[var(--muted)] hover:text-foreground"
              >
                p. {pagina}
              </button>
            ))}
            {resto > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                +{resto}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Uma linha por página: é o que mostra o alcance do erro. */}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
