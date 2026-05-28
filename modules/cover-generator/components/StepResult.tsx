"use client";

import { useState } from "react";
import { FileText, FileCheck, FolderArchive, Download, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import type { GeneralData, CoverPage } from "../types";
import { Button } from "@/components/ui/button";
import { getFileName } from "../hooks/helpers";

const CHECKLIST_ITEMS = [
  "Abrir ODT no LibreOffice",
  "Conferir todas as capas",
  "Conferir ordem das paginas",
  "Conferir orgao e secretaria",
  "Conferir nome da obra",
  "Conferir fase do projeto",
  "Conferir mes/ano",
  "Conferir codigo exibido",
  "Conferir titulo, tomo e volume de cada capa",
  "Conferir rodape e propriedades do documento",
  "Conferir PDF gerado",
];

interface StepResultProps {
  generalData: GeneralData;
  totalPages: number;
  pages: CoverPage[];
  templateFields: string[];
  onReset: () => void;
}

export function StepResult({
  generalData,
  pages,
  onReset,
}: StepResultProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [generatingFormat, setGeneratingFormat] = useState<"odt" | "pdf" | "zip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfWarning, setPdfWarning] = useState<string | null>(null);

  const { codigoInterno, siglaArquivo, revisao } = generalData;
  const sigla = siglaArquivo || "";
  const rev = revisao || "r";
  const code = codigoInterno || "codigo";

  function toggleItem(index: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleDownload(outputFormat: "odt" | "pdf" | "zip") {
    setGeneratingFormat(outputFormat);
    setError(null);
    setPdfWarning(null);

    try {
      const response = await fetch("/api/capas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalData, pages, outputFormat }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Erro ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const isZip = contentType.includes("application/zip");
      const isPdf = contentType.includes("application/pdf");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getFileName(code, sigla, rev, isZip ? "zip" : isPdf ? "pdf" : "odt");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const pdfHeaderError = response.headers.get("X-PDF-Error");
      if (pdfHeaderError) {
        setPdfWarning(
          outputFormat === "zip"
            ? `${pdfHeaderError}. Baixei o ODT para voce conferir enquanto o PDF fica indisponivel.`
            : pdfHeaderError
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar arquivos");
    } finally {
      setGeneratingFormat(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resultado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha exatamente o arquivo que deseja baixar. O ZIP inclui ODT e
          PDF quando a conversao estiver disponivel.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {pdfWarning && (
        <div className="flex items-start gap-2 border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] p-3 text-sm" style={{ color: "var(--nexodoc-tertiary-strong)" }}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{pdfWarning}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: FileText, label: "ODT", ext: "odt", description: "Documento editavel" },
          { icon: FileCheck, label: "PDF", ext: "pdf", description: "Arquivo final para envio" },
          { icon: FolderArchive, label: "ZIP", ext: "zip", description: "ODT + PDF no mesmo pacote" },
        ].map(({ icon: Icon, label, ext, description }) => {
          const isGeneratingThis = generatingFormat === ext;
          return (
          <div
            key={ext}
            className="border border-border bg-card p-4 text-center"
          >
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center border border-primary/25 bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
              {getFileName(code, sigla, rev, ext)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{description}</p>
            <Button
              className="mt-4 w-full"
              variant={ext === "zip" ? "default" : "outline"}
              onClick={() => handleDownload(ext as "odt" | "pdf" | "zip")}
              disabled={generatingFormat !== null}
            >
              {isGeneratingThis ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              {isGeneratingThis ? "Gerando..." : `Baixar ${label}`}
            </Button>
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Iniciar nova geracao
        </Button>
      </div>

      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Checklist de conferencia
            </span>
            <span className="font-mono text-xs text-muted-foreground">(pos-download)</span>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {checkedItems.size}/{CHECKLIST_ITEMS.length}
          </span>
        </div>
        <div className="divide-y divide-border">
          {CHECKLIST_ITEMS.map((item, index) => (
            <label
              key={index}
              className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <input
                type="checkbox"
                checked={checkedItems.has(index)}
                onChange={() => toggleItem(index)}
                className="h-4 w-4 accent-primary"
              />
              <span
                className={`text-sm ${
                  checkedItems.has(index)
                    ? "line-through decoration-muted-foreground/40"
                    : ""
                }`}
              >
                {item}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
