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

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileText, Layers, ScanLine, AlertTriangle } from "lucide-react";

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

export interface ArtifactThumbProps {
  pdfUrl?: string;
  pageNumber?: number;
  width?: number;
  kind: NexoArtifactKind;
}

export default function ArtifactThumbInternal({
  pdfUrl,
  pageNumber = 1,
  width = 200,
  kind,
}: ArtifactThumbProps) {
  const [failed, setFailed] = useState(false);

  if (!pdfUrl || failed) {
    const Icon = KIND_ICON[kind] ?? FileText;
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--nexodoc-recessed)]">
        <Icon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }

  return (
    <Document
      file={pdfUrl}
      loading={null}
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
        loading={null}
        onRenderError={() => setFailed(true)}
      />
    </Document>
  );
}
