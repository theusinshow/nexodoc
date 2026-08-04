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
import { RecurringStackNode, type RecurringStackNodeData } from "./RecurringStackNode";
import { RotuloDoCanvas, type RotuloDoCanvasData } from "./RotuloDoCanvas";

const nodeTypes = {
  paginaMemorial: MemorialPageNode,
  achado: FindingCardNode,
  pilha: RecurringStackNode,
  rotulo: RotuloDoCanvas,
};

const COR_DA_LINHA: Record<AuditSeverity, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};

const idDaPagina = (pagina: number) => `p${pagina}`;
const idDoAchado = (achado: string) => `a-${achado}`;
const idDaPilha = (grupo: string) => `g-${grupo}`;

function CanvasInterno({ report, pdfUrl }: { report: AuditReport; pdfUrl?: string }) {
  const grafo = useMemo(() => buildAuditGraph(report), [report]);
  /*
   * Os achados acesos. Mora aqui, e não em CSS, porque o par a acender é
   * dinâmico: qual página combina com qual card só se sabe do grafo. É uma
   * LISTA porque a pilha de um recorrente acende várias páginas de uma vez.
   */
  const [acesos, setAcesos] = useState<string[] | null>(null);

  const layout = useMemo(
    () =>
      layoutDaAuditoria({
        paginas: grafo.pageNodes,
        semPagina: grafo.unplaced.map((a) => a.id),
        grupos: grafo.recurringGroups,
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
        acesos,
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

    // Quem está numa pilha não ganha card: `layout.achados` nem lhe dá posição.
    const cards: Node<FindingCardNodeData>[] = [...grafo.findingNodes, ...grafo.unplaced]
      .filter((achado) => layout.achados[achado.id])
      .map((achado) => ({
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
          acesos,
        },
      }));

    const pilhas: Node<RecurringStackNodeData>[] = grafo.recurringGroups.map((grupo) => {
      const primeiro = porId.get(grupo.findingIds[0]);
      return {
        id: idDaPilha(grupo.id),
        type: "pilha",
        position: layout.grupos[grupo.id],
        data: {
          grupoId: grupo.id,
          achadoIds: grupo.findingIds,
          severity: grupo.severity,
          tipo: grupo.tipo,
          evidencia: primeiro?.evidencia ?? "",
          count: grupo.count,
          pages: grupo.pages,
          acesos,
        },
      };
    });

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

    return [...paginas, ...cards, ...pilhas, ...rotulos];
  }, [grafo, layout, pdfUrl, acesos]);

  const edges = useMemo<Edge[]>(() => {
    const estilo = (severity: AuditSeverity, aceso: boolean) => ({
      stroke: COR_DA_LINHA[severity],
      strokeWidth: aceso && acesos ? 2 : 1,
      opacity: aceso ? 0.8 : 0.15,
    });

    // Achado solto: da sua página para o card, logo abaixo.
    const dosCards = grafo.findingNodes
      .filter((achado) => layout.achados[achado.id])
      .map((achado) => ({
        id: `e-${achado.id}`,
        source: idDaPagina(achado.pageNumber as number),
        target: idDoAchado(achado.id),
        style: estilo(achado.severity, !acesos || acesos.includes(achado.id)),
      }));

    // Recorrente: UMA linha da pilha para cada página onde o erro aparece — é o
    // desenho que mostra o alcance dele.
    const dasPilhas = grafo.recurringGroups.flatMap((grupo) => {
      const aceso = !acesos || grupo.findingIds.some((id) => acesos.includes(id));
      return grupo.pages.map((pagina) => ({
        id: `e-${grupo.id}-p${pagina}`,
        source: idDaPilha(grupo.id),
        target: idDaPagina(pagina),
        style: estilo(grupo.severity, aceso),
      }));
    });

    return [...dosCards, ...dasPilhas];
  }, [grafo, layout, acesos]);

  const acender: NodeMouseHandler = (_, node) => {
    const dados = node.data as { achadoId?: string; achadoIds?: string[] };
    // A pilha acende o grupo inteiro; o card acende só ele.
    if (dados.achadoIds) setAcesos(dados.achadoIds);
    else if (dados.achadoId) setAcesos([dados.achadoId]);
  };
  const apagar = () => setAcesos(null);

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
