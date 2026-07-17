"use client";

import { useCallback, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/nexodoc-pdf-engine.mjs";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type AuditPdfViewerInternalProps = {
  url: string;
  page: number;
  highlight?: string;
};

// Visor embutido de PDF da auditoria (item 2): renderiza a página exata do achado
// e destaca o termo de busca. O pdfjs quebra o texto em vários spans, então o
// destaque casa por fragmento — o suficiente para o olho localizar o trecho.
export default function AuditPdfViewerInternal({ url, page, highlight }: AuditPdfViewerInternalProps) {
  const [numPages, setNumPages] = useState(0);
  const needle = (highlight ?? "").trim();

  const textRenderer = useCallback(
    (textItem: { str: string }) => {
      if (needle.length < 3) {
        return textItem.str;
      }

      try {
        const pattern = new RegExp(`(${escapeRegExp(needle)})`, "gi");
        return textItem.str.replace(pattern, "<mark>$1</mark>");
      } catch {
        return textItem.str;
      }
    },
    [needle],
  );

  const safePage = numPages > 0 ? Math.min(Math.max(1, page), numPages) : Math.max(1, page);

  return (
    <Document
      file={url}
      onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
      loading={
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando PDF…
        </div>
      }
      error={
        <div className="p-6 text-sm text-muted-foreground">
          Não foi possível abrir o PDF nesta sessão.
        </div>
      }
      className="flex flex-col items-center"
    >
      <Page
        pageNumber={safePage}
        width={520}
        customTextRenderer={textRenderer}
        renderAnnotationLayer={false}
        className="shadow-sm"
      />
    </Document>
  );
}
