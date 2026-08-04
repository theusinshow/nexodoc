"use client";

/**
 * Miniatura de UM artefato gerado, via react-pdf. Carregado SÓ no cliente (o
 * wrapper usa dynamic ssr:false) porque o pdfjs precisa do DOM.
 *
 * Worker: o do PRÓPRIO react-pdf (pdfjs 5.4.296), NUNCA o engine do selo (5.7.284)
 * — mismatch = "API version does not match Worker version" e tela branca (risco #1
 * documentado). Degrada para um ícone do kind em QUALQUER falha (sem PDF, erro de
 * load/render) — nunca quebra o canvas.
 */

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileText, Layers, ScanLine, AlertTriangle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import type { NexoArtifactKind } from "../types";

pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/pdf.worker.react-pdf.mjs";

const KIND_ICON: Record<NexoArtifactKind, typeof FileText> = {
  ld: FileText,
  capa: FileText,
  separatriz: FileText,
  volume: Layers,
  conferencia: ScanLine,
  auditoria: AlertTriangle,
};

/**
 * Camada de texto da página, em unidades do PDF. É o que a auditoria visual usa
 * pra ancorar o pin do achado no trecho (ver server/nexo/audit/locate-term.ts).
 * Tipado estruturalmente de propósito: a miniatura não conhece a auditoria.
 */
export interface ThumbTextLayer {
  items: { str: string; transform: number[]; width: number; height: number }[];
  viewport: { width: number; height: number };
}

export interface ArtifactThumbProps {
  pdfUrl?: string;
  pageNumber?: number;
  width?: number;
  kind: NexoArtifactKind;
  /**
   * Dispara uma vez por página renderizada com a camada de texto. Opcional: quem
   * só quer a imagem não paga o getTextContent. A camada de texto NÃO é
   * desenhada no DOM — sai daqui como dado, e quem chamou desenha por cima.
   */
  onTextLayer?: (layer: ThumbTextLayer) => void;
}

export default function ArtifactThumbInternal({
  pdfUrl,
  pageNumber = 1,
  width = 200,
  kind,
  onTextLayer,
}: ArtifactThumbProps) {
  const [failed, setFailed] = useState(false);
  // O onLoadSuccess do react-pdf reroda em re-render; a extração é assíncrona e
  // pode voltar depois do nó sumir do canvas. Estes dois guardam contra entregar
  // texto duas vezes, ou pra um componente que já morreu.
  const entregue = useRef<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  if (!pdfUrl || failed) {
    const Icon = KIND_ICON[kind] ?? FileText;
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--nexodoc-recessed)]">
        <Icon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }

  /*
   * Esqueleto da forma final enquanto o pdfjs abre e desenha (DESIGN.md §7):
   * numa vista com dezenas de páginas, `loading={null}` deixava uma parede de
   * caixas vazias por segundos, indistinguível de erro.
   */
  const esqueleto = <Skeleton className="h-full w-full rounded-none" />;

  return (
    <Document
      file={pdfUrl}
      loading={esqueleto}
      error={null}
      noData={null}
      onLoadError={() => setFailed(true)}
      onSourceError={() => setFailed(true)}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={esqueleto}
        onRenderError={() => setFailed(true)}
        onLoadSuccess={
          onTextLayer
            ? async (page) => {
                const chave = `${pdfUrl}#${pageNumber}`;
                if (entregue.current === chave) return;
                entregue.current = chave;
                try {
                  const texto = await page.getTextContent();
                  if (!vivo.current) return;
                  const vp = page.getViewport({ scale: 1 });
                  onTextLayer({
                    // O textContent mistura itens de texto com marcações
                    // estruturais (sem `str`); só o texto ancora pin.
                    items: texto.items.filter(
                      (item): item is Extract<typeof item, { str: string }> => "str" in item,
                    ),
                    viewport: { width: vp.width, height: vp.height },
                  });
                } catch {
                  // Página sem camada de texto (PDF escaneado) não é erro: a
                  // auditoria cai no badge de página e a miniatura segue válida.
                }
              }
            : undefined
        }
      />
    </Document>
  );
}
