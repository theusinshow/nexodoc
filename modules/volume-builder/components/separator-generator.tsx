"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateSeparatorPdf } from "@/modules/volume-builder/lib/pdf/generate-separator";
import { Download, Eye } from "lucide-react";

interface SeparatorGeneratorProps {
  title: string;
  onChange: (title: string) => void;
  pageSize?: "A4" | "A3";
  onPageSizeChange?: (size: "A4" | "A3") => void;
}

export function SeparatorGenerator({
  title,
  onChange,
  pageSize = "A4",
  onPageSizeChange,
}: SeparatorGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGeneratePdf() {
    if (!title.trim()) return;

    setIsGenerating(true);
    try {
      const pdfBytes = await generateSeparatorPdf({ title, pageSize });
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `separatriz_${title.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar separatriz:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePreview() {
    if (!title.trim()) return;

    setIsGenerating(true);
    try {
      const pdfBytes = await generateSeparatorPdf({ title, pageSize });
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      window.open(url, "_blank");
    } catch (error) {
      console.error("Erro ao gerar preview:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Titulo da separatriz</Label>
        <Badge variant="secondary" className="text-[10px]">
          Gerada automaticamente
        </Badge>
      </div>

      <Input
        value={title}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: PROJETO DE ESTRUTURAS DE CONCRETO"
        className="h-7 text-xs"
      />

      {title && (
        <div className="rounded border bg-muted/30 p-2">
          <p className="text-[10px] text-muted-foreground mb-1">Previa:</p>
          <p className="text-xs font-bold text-center uppercase">
            {title}
          </p>
        </div>
      )}

      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Tamanho:</Label>
          <div className="flex gap-1">
            <Button
              variant={pageSize === "A4" ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => onPageSizeChange("A4")}
            >
              A4
            </Button>
            <Button
              variant={pageSize === "A3" ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => onPageSizeChange("A3")}
            >
              A3
            </Button>
          </div>
        </div>
      )}

      {title && (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs flex-1"
            onClick={handlePreview}
            disabled={isGenerating}
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs flex-1"
            onClick={handleGeneratePdf}
            disabled={isGenerating}
          >
            <Download className="h-3 w-3 mr-1" />
            Baixar PDF
          </Button>
        </div>
      )}
    </div>
  );
}
