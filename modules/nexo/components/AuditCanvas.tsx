"use client";

/**
 * A auditoria vista NO DOCUMENTO: cada página com achado vira um nó com a
 * miniatura real, os achados marcados no trecho e, logo abaixo, um card por
 * achado ligado à sua página. Passar o cursor acende o par e apaga o resto.
 *
 * O modelo já vem pronto de `buildAuditGraph` e a geometria de
 * `layoutDaAuditoria`: esta camada não decide severidade, veredito, recorrência
 * nem posição. Só desenha.
 */

import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { AuditReport } from "@/lib/audit-report";
import { buildAuditGraph, type AuditSeverity } from "@/server/nexo/audit/build-audit-graph";
import { layoutDaAuditoria } from "../lib/layout-auditoria";
import { MemorialPageNode, type MemorialPageNodeData } from "./MemorialPageNode";
import { FindingCardNode, type FindingCardNodeData } from "./FindingCardNode";
import { RotuloDoCanvas, type RotuloDoCanvasData } from "./RotuloDoCanvas";

const nodeTypes = {
  paginaMemorial: MemorialPageNode,
  achado: FindingCardNode,
  rotulo: RotuloDoCanvas,
};

const COR_DA_LINHA: Record<AuditSeverity, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};

const idDaPagina = (pagina: number) => `p${pagina}`;
const idDoAchado = (achado: string) => `a-${achado}`;

function CanvasInterno({ report, pdfUrl }: { report: AuditReport; pdfUrl?: string }) {
  const grafo = useMemo(() => buildAuditGraph(report), [report]);
  /*
   * O achado sob o cursor. Mora aqui, e não em CSS, porque o par a acender é
   * dinâmico: qual página combina com qual card só se sabe do grafo.
   */
  const [emDestaque, setEmDestaque] = useState<string | null>(null);

  const layout = useMemo(
    () =>
      layoutDaAuditoria({
        paginas: grafo.pageNodes,
        semPagina: grafo.unplaced.map((a) => a.id),
      }),
    [grafo],
  );

  const nodes = useMemo<Node[]>(() => {
    const porId = new Map([...grafo.findingNodes, ...grafo.unplaced].map((f) => [f.id, f]));

    const paginas: Node<MemorialPageNodeData>[] = grafo.pageNodes.map((pagina) => ({
      id: idDaPagina(pagina.pageNumber),
      type: "paginaMemorial",
      position: layout.paginas[pagina.pageNumber],
      data: {
        pdfUrl,
        pageNumber: pagina.pageNumber,
        emDestaque,
        achados: pagina.findingIds.flatMap((id) => {
          const a = porId.get(id);
          return a
            ? [
                {
                  id: a.id,
                  severity: a.severity,
                  tipo: a.tipo,
                  evidencia: a.evidencia,
                  termoBusca: a.termoBusca,
                },
              ]
            : [];
        }),
      },
    }));

    const cards: Node<FindingCardNodeData>[] = [...grafo.findingNodes, ...grafo.unplaced].map(
      (achado) => ({
        id: idDoAchado(achado.id),
        type: "achado",
        position: layout.achados[achado.id],
        data: {
          achadoId: achado.id,
          severity: achado.severity,
          tier: achado.tier,
          tipo: achado.tipo,
          evidencia: achado.evidencia,
          pageNumber: achado.pageNumber,
          emDestaque,
        },
      }),
    );

    const rotulos: Node<RotuloDoCanvasData>[] = layout.topoSemPagina
      ? [
          {
            id: "rotulo-sem-pagina",
            type: "rotulo",
            position: { x: layout.topoSemPagina.x, y: layout.topoSemPagina.y - 30 },
            data: {
              texto: `Sem página localizada (${grafo.unplaced.length})`,
              ajuda: "A auditoria apontou estes achados sem dizer em que página estão.",
            },
          },
        ]
      : [];

    return [...paginas, ...cards, ...rotulos];
  }, [grafo, layout, pdfUrl, emDestaque]);

  const edges = useMemo<Edge[]>(
    () =>
      grafo.findingNodes.map((achado) => {
        const aceso = !emDestaque || emDestaque === achado.id;
        return {
          id: `e-${achado.id}`,
          source: idDaPagina(achado.pageNumber as number),
          target: idDoAchado(achado.id),
          style: {
            stroke: COR_DA_LINHA[achado.severity],
            strokeWidth: emDestaque === achado.id ? 2 : 1,
            opacity: aceso ? 0.8 : 0.15,
          },
        };
      }),
    [grafo, emDestaque],
  );

  const acender: NodeMouseHandler = (_, node) => {
    const dados = node.data as { achadoId?: string };
    if (dados.achadoId) setEmDestaque(dados.achadoId);
  };
  const apagar = () => setEmDestaque(null);

  if (grafo.pageNodes.length === 0 && grafo.unplaced.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum achado para mostrar no documento.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/*
        O veredito acompanha a vista: quem está olhando as páginas não devia ter
        de voltar ao parecer pra saber se o documento pode ser emitido.
      */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-2 rounded-md border border-border bg-card/90 px-2.5 py-1.5 shadow-[var(--shadow-panel)] backdrop-blur">
        <span aria-hidden>{grafo.verdict.emoji}</span>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em]">
          {grafo.verdict.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {grafo.pageNodes.length} página(s) com achado
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeMouseEnter={acender}
        onNodeMouseLeave={apagar}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        /*
         * O piso do zoom é o que decide se a vista cabe: com 0.2, o pior caso
         * (achado em quase toda página) ficava com 78 nós fora do quadro. Quem
         * quiser ler uma página aproxima; quem abre precisa ver o tamanho do
         * problema.
         */
        minZoom={0.08}
        maxZoom={2}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnScroll
        zoomOnScroll
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function AuditCanvas(props: { report: AuditReport; pdfUrl?: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}
