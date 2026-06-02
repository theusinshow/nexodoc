"use client";

import { useState } from "react";
import type { PageSelection, PageSelectionMode } from "@/modules/volume-builder/lib/volume/volume-types";
import { parsePageSelection, validatePageSelectionAgainstPageCount } from "@/modules/volume-builder/lib/utils/parse-page-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye } from "lucide-react";
import { PdfPageThumbnailGrid } from "./pdf-page-thumbnail-grid";

interface PdfPageSelectorProps {
  fileId: string;
  fileName: string;
  pageCount: number;
  fileData?: File;
  onSelect: (selection: PageSelection) => void;
}

export function PdfPageSelector({
  fileId,
  fileName,
  pageCount,
  fileData,
  onSelect,
}: PdfPageSelectorProps) {
  const [mode, setMode] = useState<PageSelectionMode>("entire_file");
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  function handleModeChange(newMode: PageSelectionMode) {
    setMode(newMode);
    setInputValue("");
    setValidationError(null);
    setSelectedPages([]);
  }

  function handleApply() {
    setValidationError(null);

    if (mode === "entire_file") {
      onSelect({
        sourceFileId: fileId,
        sourceFileName: fileName,
        mode: "entire_file",
      });
      return;
    }

    if (mode === "specific_pages" && selectedPages.length > 0) {
      onSelect({
        sourceFileId: fileId,
        sourceFileName: fileName,
        mode: "specific_pages",
        pages: selectedPages.sort((a, b) => a - b),
      });
      return;
    }

    if (!inputValue.trim()) {
      setValidationError("Informe a selecao de paginas.");
      return;
    }

    const parsed = parsePageSelection(inputValue);
    if (!parsed) {
      setValidationError("Formato invalido. Use: 1, 1-10, 1,3,5 ou 1-5,8,10-12");
      return;
    }

    if (pageCount > 0) {
      const warnings = validatePageSelectionAgainstPageCount(parsed, pageCount);
      if (warnings.length > 0) {
        setValidationError(warnings[0]);
        return;
      }
    }

    onSelect({ ...parsed, sourceFileId: fileId, sourceFileName: fileName });
  }

  function handlePageSelect(page: number) {
    setSelectedPages((prev) => {
      if (prev.includes(page)) {
        return prev.filter((p) => p !== page);
      }
      return [...prev, page];
    });
  }

  function handleRangeSelect(start: number, end: number) {
    setInputValue(`${start}-${end}`);
    setMode("page_range");
  }

  return (
    <div className="space-y-3 rounded border p-3 bg-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium">{fileName}</p>
          {pageCount > 0 && (
            <p className="text-xs text-muted-foreground">{pageCount} paginas</p>
          )}
        </div>
        {fileData && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-3 w-3 mr-1" />
            {showPreview ? "Ocultar" : "Ver"} paginas
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Modo de selecao</Label>
        <div className="flex gap-1">
          <Button
            variant={mode === "entire_file" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => handleModeChange("entire_file")}
          >
            Arquivo inteiro
          </Button>
          <Button
            variant={mode === "page_range" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => handleModeChange("page_range")}
          >
            Intervalo
          </Button>
          <Button
            variant={mode === "specific_pages" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => handleModeChange("specific_pages")}
          >
            Paginas
          </Button>
        </div>
      </div>

      {mode === "page_range" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Intervalo (ex: 1-10)
          </Label>
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setValidationError(null);
            }}
            placeholder="1-10"
            className="h-8 text-sm"
          />
        </div>
      )}

      {mode === "specific_pages" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Paginas (ex: 1,3,5 ou 1-5,8,10-12)
          </Label>
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setValidationError(null);
            }}
            placeholder="1,3,5 ou 1-5,8,10-12"
            className="h-8 text-sm"
          />
          {selectedPages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Paginas selecionadas visualmente: {selectedPages.sort((a, b) => a - b).join(", ")}
            </p>
          )}
        </div>
      )}

      {validationError && (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2">
          <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{validationError}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1"
          onClick={handleApply}
        >
          Aplicar selecao
        </Button>
      </div>

      {showPreview && fileData && (
        <div className="border-t pt-3 mt-3">
          <PdfPageThumbnailGrid
            file={fileData}
            pageCount={pageCount}
            selectedPages={selectedPages}
            onPageSelect={mode === "specific_pages" ? handlePageSelect : undefined}
            onRangeSelect={handleRangeSelect}
          />
        </div>
      )}
    </div>
  );
}
