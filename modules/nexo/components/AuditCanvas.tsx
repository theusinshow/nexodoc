"use client";

/**
 * A auditoria vista NO DOCUMENTO: cada página com achado vira um nó com a
 * miniatura real e os achados marcados no trecho.
 *
 * Primeira fatia do PR7 (spec 2026-07-23). Aqui só o eixo das PÁGINAS — os cards
 * de achado ligados por linha e a pilha dos recorrentes vêm na fatia seguinte.
 * O modelo já vem pronto de `buildAuditGraph`: esta camada não decide severidade,
 * nem veredito, nem o que é recorrente. Só desenha.
 */

import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { AuditReport } from "@/lib/audit-report";
import { buildAuditGraph } from "@/server/nexo/audit/build-audit-graph";
import { colunasDaGrade } from "../lib/layout-canvas";
import {
  MemorialPageNode,
  LARGURA_PAGINA,
  type MemorialPageNodeData,
} from "./MemorialPageNode";

const nodeTypes = { paginaMemorial: MemorialPageNode };

/** Grade: a página é 3/4, então o passo vertical carrega a altura + o rodapé. */
const PASSO_X = LARGURA_PAGINA + 40;
const PASSO_Y = Math.round(LARGURA_PAGINA * (4 / 3)) + 70;

function CanvasInterno({
  report,
  pdfUrl,
}: {
  report: AuditReport;
  pdfUrl?: string;
}) {
  const grafo = useMemo(() => buildAuditGraph(report), [report]);

  const nodes = useMemo<Node<MemorialPageNodeData>[]>(() => {
    const porId = new Map(grafo.findingNodes.map((f) => [f.id, f]));
    /*
     * Colunas pela RAIZ da quantidade, como a grade das folhas. Com 4 colunas
     * fixas, um memorial com achado em 122 páginas virava uma torre de 31 linhas
     * que o enquadramento não fechava — medido em shot-audit-canvas-escala.mjs.
     */
    const colunas = colunasDaGrade(grafo.pageNodes.length);
    return grafo.pageNodes.map((pagina, i) => ({
      id: `p${pagina.pageNumber}`,
      type: "paginaMemorial",
      position: { x: (i % colunas) * PASSO_X, y: Math.floor(i / colunas) * PASSO_Y },
      data: {
        pdfUrl,
        pageNumber: pagina.pageNumber,
        achados: pagina.findingIds.flatMap((id) => {
          const achado = porId.get(id);
          return achado
            ? [
                {
                  id: achado.id,
                  severity: achado.severity,
                  tipo: achado.tipo,
                  evidencia: achado.evidencia,
                  termoBusca: achado.termoBusca,
                },
              ]
            : [];
        }),
      },
    }));
  }, [grafo, pdfUrl]);

  if (grafo.pageNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {grafo.findingNodes.length === 0 && grafo.unplaced.length === 0
            ? "Nenhum achado para mostrar no documento."
            : "Os achados desta auditoria não trazem página — veja o parecer."}
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
        nodeTypes={nodeTypes}
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
