"use client";

import { useCallback, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Skeleton } from "@/components/ui/skeleton";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// IMPORTANTE: o worker precisa casar com a versão do pdfjs que o react-pdf usa
// (nested 5.4.296), não com o engine 5.7.284 do repo — senão dá
// "API version does not match Worker version" e nada renderiza. Este arquivo é
// cópia do worker do próprio react-pdf.
pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/pdf.worker.react-pdf.mjs";

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

  // O pdfjs quebra o texto em vários spans, então o customTextRenderer recebe um
  // fragmento por vez e um termo de várias palavras raramente cai inteiro num só.
  // Solução: destacar o termo inteiro E cada palavra significativa (>= 4 letras,
  // sem stopwords) dele — assim o trecho fica marcado mesmo quando o pdfjs corta.
  const pattern = useMemo(() => {
    if (needle.length < 3) {
      return null;
    }

    const stop = new Set(["para", "pelo", "pela", "com", "sem", "das", "dos", "que", "por", "uma", "num", "nos", "nas"]);
    const words = needle
      .split(/\s+/)
      .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
      .filter((word) => word.length >= 4 && !stop.has(word.toLowerCase()));

    const parts = [...new Set([needle, ...words])]
      .filter((part) => part.length >= 3)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);

    if (parts.length === 0) {
      return null;
    }

    try {
      return new RegExp(`(${parts.join("|")})`, "gi");
    } catch {
      return null;
    }
  }, [needle]);

  const textRenderer = useCallback(
    (textItem: { str: string }) => {
      if (!pattern) {
        return textItem.str;
      }

      /*
       * Sem zerar `lastIndex` à mão: `String.replace` com regex global já o
       * zera antes de casar, então a linha era morta — e mutava um valor vindo
       * do `useMemo`, o que o React Compiler barra com razão. O `pattern` é
       * compartilhado entre todos os itens de texto da página; se alguém
       * trocar este `replace` por `exec` ou `test`, aí sim o estado do regex
       * passa a atravessar chamadas e precisa de cuidado.
       */
      return textItem.str.replace(pattern, "<mark>$1</mark>");
    },
    [pattern],
  );

  const safePage = numPages > 0 ? Math.min(Math.max(1, page), numPages) : Math.max(1, page);

  return (
    <Document
      file={url}
      onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
      loading={
        <div className="p-3">
          <Skeleton className="mx-auto h-[70vh] w-full max-w-[560px]" />
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
