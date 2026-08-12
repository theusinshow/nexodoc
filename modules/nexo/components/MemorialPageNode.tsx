"use client";

/**
 * Nó de PÁGINA do memorial na auditoria visual: a miniatura real da página com
 * os achados marcados por cima, no trecho.
 *
 * O pin sai de `locateTermOnPage` sobre a camada de texto que a miniatura
 * entrega (`onTextLayer`) — nada de coordenada vinda do modelo. Não localizou o
 * trecho, o achado não some: vira contagem no rodapé do nó. Melhor dizer "há 2
 * achados nesta página, sem o trecho" do que cravar um pin no lugar errado.
 */

import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { COR_DA_SEVERIDADE } from "@/lib/audit-status";
import { useRealce } from "./audit-canvas-realce";
import { locateTermOnPage, type PinPosition } from "@/server/nexo/audit/locate-term";
import type { AuditSeverity } from "@/server/nexo/audit/build-audit-graph";
import { LARGURA_PAGINA } from "../lib/layout-auditoria";
import { ArtifactThumb } from "./ArtifactThumb";

export type AchadoNaPagina = {
  id: string;
  severity: AuditSeverity;
  tipo: string;
  evidencia: string;
  termoBusca?: string;
};

export type MemorialPageNodeData = {
  pdfUrl?: string;
  pageNumber: number;
  achados: AchadoNaPagina[];
} & Record<string, unknown>;

export function MemorialPageNode({ data, selected }: NodeProps<Node<MemorialPageNodeData>>) {
  /*
   * O que está aceso vem do CONTEXTO, não de `data`. Enfiado nos dados, cada
   * movimento do ponteiro recriava os 32 nós e o React Flow redesenhava as 28
   * miniaturas de PDF junto — ver [[audit-canvas-realce.tsx]].
   */
  const { acesos } = useRealce();
  const temAceso = acesos.length > 0 && data.achados.some((a) => acesos.includes(a.id));
  const [pinos, setPinos] = useState<Record<string, PinPosition>>({});
  // Distingue "ainda não li a camada de texto" de "li e não achei o trecho": sem
  // isso o rodapé acusaria achado sem pin enquanto o PDF ainda carrega.
  const [lido, setLido] = useState(false);

  const semPino = lido ? data.achados.filter((a) => !pinos[a.id]) : [];

  return (
    /*
     * A página com um achado aceso ganha o mesmo contorno do card que a acendeu
     * — é o par que se enxerga. Nada escurece: o realce é aditivo.
     */
    <div
      className={cn(
        "nx-edge-6 overflow-hidden transition-[--nx-edge]",
        selected || temAceso ? "[--nx-edge:var(--ring)]" : "[--nx-edge:var(--border)]",
      )}
      style={{ width: LARGURA_PAGINA }}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden border-b border-border">
        <ArtifactThumb
          pdfUrl={data.pdfUrl}
          pageNumber={data.pageNumber}
          kind="auditoria"
          width={LARGURA_PAGINA}
          onTextLayer={(camada) => {
            const achados: Record<string, PinPosition> = {};
            for (const achado of data.achados) {
              const termo = achado.termoBusca ?? achado.evidencia;
              if (!termo) continue;
              const pos = locateTermOnPage({
                items: camada.items,
                pageWidth: camada.viewport.width,
                pageHeight: camada.viewport.height,
                termo,
              });
              if (pos) achados[achado.id] = pos;
            }
            setPinos(achados);
            setLido(true);
          }}
        />

        {data.achados.map((achado) => {
          const pos = pinos[achado.id];
          if (!pos) return null;
          const aceso = acesos.includes(achado.id);
          return (
            /*
             * O pin é MARCA, não conteúdo: o card logo abaixo já diz tipo,
             * evidência e página, e acender um acende o outro. Duplicar isso no
             * leitor de tela encheria a árvore de acessibilidade com 122 rótulos
             * repetidos, empurrando o texto que importa para longe.
             */
            /*
             * O pin ACESO cresce e ganha um halo; o apagado fica como sempre
             * esteve. Antes era o contrário — o não-aceso caía para 25%, e com
             * dezenas de pins a tela inteira piscava a cada movimento.
             */
            <span
              key={achado.id}
              aria-hidden
              data-pin={achado.id}
              data-aceso={aceso ? "" : undefined}
              className={cn(
                "pointer-events-none absolute block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-transform",
                aceso && "scale-150 ring-2 ring-[var(--ring)]",
              )}
              style={{
                left: `${pos.xPct * 100}%`,
                top: `${pos.yPct * 100}%`,
                backgroundColor: COR_DA_SEVERIDADE[achado.severity],
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="font-mono text-xs font-medium uppercase tabular-nums tracking-[0.05em]">
          p. {data.pageNumber}
        </p>
        {semPino.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Badge variant="outline">{semPino.length} sem trecho</Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px]">
              {semPino.length === 1 ? "Um achado desta" : `${semPino.length} achados desta`} página
              não teve o trecho localizado no texto — a página está certa, o ponto exato não.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Os cards ficam ABAIXO (a linha sai por baixo); as pilhas dos
          recorrentes ficam ACIMA (a linha chega por cima). */}
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
