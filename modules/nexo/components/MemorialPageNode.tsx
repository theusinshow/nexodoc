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
  /**
   * Ids acesos; null = todos acesos. É lista, e não um id só, porque a pilha dos
   * recorrentes acende de uma vez todas as páginas em que o erro aparece.
   */
  acesos?: string[] | null;
} & Record<string, unknown>;

const COR_DO_PIN: Record<AuditSeverity, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};

export function MemorialPageNode({ data, selected }: NodeProps<Node<MemorialPageNodeData>>) {
  const [pinos, setPinos] = useState<Record<string, PinPosition>>({});
  // Distingue "ainda não li a camada de texto" de "li e não achei o trecho": sem
  // isso o rodapé acusaria achado sem pin enquanto o PDF ainda carrega.
  const [lido, setLido] = useState(false);

  const semPino = lido ? data.achados.filter((a) => !pinos[a.id]) : [];

  return (
    <div
      className={
        selected
          ? "overflow-hidden rounded-md border border-[var(--ring)] bg-card"
          : "overflow-hidden rounded-md border border-border bg-card"
      }
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
          const aceso = !data.acesos || data.acesos.includes(achado.id);
          return (
            <Tooltip key={achado.id}>
              <TooltipTrigger asChild>
                <span
                  className="nodrag nopan absolute block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-opacity"
                  style={{
                    left: `${pos.xPct * 100}%`,
                    top: `${pos.yPct * 100}%`,
                    backgroundColor: COR_DO_PIN[achado.severity],
                    opacity: aceso ? 1 : 0.25,
                  }}
                  aria-label={`${achado.tipo} na página ${data.pageNumber}`}
                />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px]">
                <span className="font-medium">{achado.tipo}</span>
                {achado.evidencia && (
                  <span className="mt-0.5 block text-muted-foreground">
                    “{achado.evidencia}”
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 p-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em]">
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
