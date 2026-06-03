"use client";

import { useState, useMemo, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { List, Grid, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfPageThumbnailGridProps {
  file: File;
  pageCount: number;
  selectedPages?: number[];
  onPageSelect?: (page: number) => void;
  onRangeSelect?: (start: number, end: number) => void;
}

type ViewMode = "list" | "grid";

export default function PdfPageThumbnailGridInternal({
  file,
  pageCount,
  selectedPages = [],
  onPageSelect,
  onRangeSelect,
}: PdfPageThumbnailGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const pagesPerLoad = 20;
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");

  const startPage = Math.max(1, currentPage - Math.floor(pagesPerLoad / 2));
  const endPage = Math.min(pageCount, startPage + pagesPerLoad - 1);

  const loadedPages = useMemo(() => {
    const pages = new Set<number>();
    for (let i = startPage; i <= endPage; i++) {
      pages.add(i);
    }
    return pages;
  }, [startPage, endPage]);

  const handlePageClick = useCallback(
    (page: number) => {
      if (onPageSelect) {
        onPageSelect(page);
      }
    },
    [onPageSelect]
  );

  const handleRangeSelect = useCallback(() => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);

    if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end) {
      if (onRangeSelect) {
        onRangeSelect(start, end);
      }
    }
  }, [rangeStart, rangeEnd, onRangeSelect]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - pagesPerLoad));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(pageCount, prev + pagesPerLoad));
  };

  if (pageCount === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Carregando informações do PDF...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4 mr-1" />
            Miniaturas
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-1" />
            Lista
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={startPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {startPage}-{endPage} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={endPage === pageCount}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {onRangeSelect && (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <Input
            type="number"
            placeholder="Início"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="w-24"
            min={1}
            max={pageCount}
          />
          <span className="text-sm text-muted-foreground">até</span>
          <Input
            type="number"
            placeholder="Fim"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="w-24"
            min={1}
            max={pageCount}
          />
          <Button size="sm" onClick={handleRangeSelect}>
            Selecionar intervalo
          </Button>
        </div>
      )}

      <Document
        file={file}
        loading={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
        error={
          <div className="text-center py-8 text-destructive">
            <p>Erro ao carregar PDF</p>
          </div>
        }
      >
        {viewMode === "grid" ? (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from(loadedPages).map((pageNumber) => (
              <div
                key={pageNumber}
                className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                  selectedPages.includes(pageNumber)
                    ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)] ring-2 ring-[var(--nexodoc-tertiary)]/25"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => handlePageClick(pageNumber)}
              >
                <Page
                  pageNumber={pageNumber}
                  width={120}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div className="w-[120px] h-[160px] flex items-center justify-center bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  }
                />
                <div
                  className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-center backdrop-blur-sm ${
                    selectedPages.includes(pageNumber)
                      ? "bg-[var(--nexodoc-tertiary-bg)]"
                      : "bg-background/90"
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      selectedPages.includes(pageNumber)
                        ? "text-[var(--nexodoc-tertiary)]"
                        : ""
                    }`}
                  >
                    {pageNumber}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from(loadedPages).map((pageNumber) => (
              <div
                key={pageNumber}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedPages.includes(pageNumber)
                    ? "border-[var(--nexodoc-tertiary-strong)] bg-[var(--nexodoc-tertiary-bg)]"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
                onClick={() => handlePageClick(pageNumber)}
              >
                <div className="flex-shrink-0 w-12 h-16 border rounded overflow-hidden">
                  <Page
                    pageNumber={pageNumber}
                    width={48}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                    }
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Página {pageNumber}</p>
                  {selectedPages.includes(pageNumber) && (
                    <p className="text-xs font-medium text-[var(--nexodoc-tertiary)]">Selecionada</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Document>
    </div>
  );
}
