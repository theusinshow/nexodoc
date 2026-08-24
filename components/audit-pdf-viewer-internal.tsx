"use client";

import { useCallback, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Skeleton } from "@/components/ui/skeleton";
import { marcacaoDoTrecho, type FaixasDaMarcacao } from "@/lib/marcacao-do-trecho";
import type { ItemDeTexto } from "@/lib/texto-do-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// IMPORTANTE: o worker precisa casar com a versão do pdfjs que o react-pdf usa
// (nested 5.4.296), não com o engine 5.7.284 do repo — senão dá
// "API version does not match Worker version" e nada renderiza. Este arquivo é
// cópia do worker do próprio react-pdf.
pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdfjs/pdf.worker.react-pdf.mjs";

/**
 * A largura de uma página em 100%. 520px numa gaveta de 560 é a página inteira
 * à vista, que é o enquadramento certo para "onde está o trecho". Para LER o
 * trecho é que existe o zoom — e é por isso que ele multiplica este número em
 * vez de substituí-lo.
 */
export const LARGURA_BASE_DA_PAGINA = 520;

type AuditPdfViewerInternalProps = {
  url: string;
  page: number;
  highlight?: string;
  /** Multiplicador da largura da página. 1 = a página inteira na gaveta. */
  zoom?: number;
  /**
   * Quantas páginas o documento tem — sobe para o dono montar a régua de
   * achados na margem. A posição de um pin é uma FRAÇÃO do documento, e só
   * quem abriu o PDF sabe o tamanho dele.
   */
  onNumPages?: (n: number) => void;
};

function escaparHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Visor embutido de PDF da auditoria: renderiza a página do achado e marca o
 * trecho citado como evidência.
 *
 * COMO A MARCAÇÃO FUNCIONA — e por que ela mudou (24/08/2026).
 *
 * Antes: uma expressão regular com o trecho inteiro E cada palavra dele com 4
 * letras ou mais, aplicada a cada span isoladamente. O remendo da palavra solta
 * existia porque o pdf.js corta o texto em spans e uma frase raramente cabe num
 * só — mas numa página de memorial "revestimento" e "conforme" aparecem dezenas
 * de vezes, e a folha inteira acendia. O relato foi "a marcação está ficando
 * imprecisa"; o diagnóstico é que ela nunca soube ONDE o trecho estava.
 *
 * Agora: `onGetTextSuccess` entrega os itens da página ANTES de o texto ser
 * pintado, `marcacaoDoTrecho` costura esses itens na ordem de leitura (com a
 * mesma medida da extração) e devolve as faixas de caractere da ÚNICA ocorrência
 * certa. O `customTextRenderer` recebe `itemIndex` e recorta só o que é dele.
 *
 * Sem os itens ainda (primeiro quadro) não marca nada: o estado chega logo
 * depois e o React repinta. Marca nenhuma por um quadro é melhor que a marca
 * errada, que é o que se está consertando.
 */
export default function AuditPdfViewerInternal({
  url,
  page,
  highlight,
  zoom = 1,
  onNumPages,
}: AuditPdfViewerInternalProps) {
  const [numPages, setNumPages] = useState(0);
  const [itens, setItens] = useState<ItemDeTexto[] | null>(null);
  const needle = (highlight ?? "").trim();

  /*
   * A página muda: os itens da anterior não valem mais. Sem isto o visor
   * marcaria, por um quadro, faixas calculadas sobre outra folha — que é pior
   * que não marcar, porque parece certo.
   */
  const [paginaDosItens, setPaginaDosItens] = useState(0);

  const faixas: FaixasDaMarcacao | null = useMemo(() => {
    if (!itens || paginaDosItens !== page || needle.length < 3) return null;
    return marcacaoDoTrecho(itens, needle);
  }, [itens, paginaDosItens, page, needle]);

  const textRenderer = useCallback(
    ({ str, itemIndex }: { str: string; itemIndex: number }) => {
      const trechos = faixas?.get(itemIndex);
      if (!trechos || trechos.length === 0) return escaparHtml(str);

      /*
       * Montado por FATIA, e não por `replace`: as faixas vêm em índice de
       * caractere, e reconstruir o texto pedaço a pedaço é o que garante que a
       * marca caia exatamente onde o casamento caiu — inclusive no meio de uma
       * palavra que o pdf.js entregou colada a outra.
       */
      let saida = "";
      let cursor = 0;
      for (const [inicio, fim] of trechos) {
        saida += escaparHtml(str.slice(cursor, inicio));
        saida += `<mark>${escaparHtml(str.slice(inicio, fim))}</mark>`;
        cursor = fim;
      }
      return saida + escaparHtml(str.slice(cursor));
    },
    [faixas],
  );

  const safePage = numPages > 0 ? Math.min(Math.max(1, page), numPages) : Math.max(1, page);

  return (
    <Document
      file={url}
      onLoadSuccess={(pdf) => {
        setNumPages(pdf.numPages);
        onNumPages?.(pdf.numPages);
      }}
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
        width={Math.round(LARGURA_BASE_DA_PAGINA * zoom)}
        onGetTextSuccess={(conteudo) => {
          /*
           * `TextMarkedContent` vem misturado aos itens de texto e não tem
           * `str` — o predicado o descarta. O `unknown` no meio é por causa do
           * `dir`/`fontName` do tipo do pdf.js, que `ItemDeTexto` não declara
           * de propósito: ele é o SUBCONJUNTO que a costura usa, e é o que
           * mantém o módulo puro provável sem pdf.js.
           */
          const lidos = (conteudo?.items ?? []).filter(
            (item) => typeof (item as { str?: unknown }).str === "string",
          ) as unknown as ItemDeTexto[];
          setItens(lidos);
          setPaginaDosItens(safePage);
        }}
        customTextRenderer={textRenderer}
        renderAnnotationLayer={false}
        className="shadow-sm"
      />
    </Document>
  );
}
