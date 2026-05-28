"use client";

import { useState } from "react";
import { FileText, FileCheck, FolderArchive, Download, Loader2, RotateCcw, AlertTriangle, Ban } from "lucide-react";
import type { GeneralData, CoverPage } from "../types";
import { Button } from "@/components/ui/button";
import { getFileName } from "../hooks/helpers";

interface GeneratedDownload {
  fileName: string;
  url: string;
  kind: "odt" | "pdf" | "zip";
}

interface GenerateResponse {
  files: {
    odt: { name: string; data: string };
    pdf: { name: string; data: string } | null;
    zip: { name: string; data: string };
  };
  error?: string;
}

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
  "Conferir PDF gerado (se disponivel)",
];

interface StepResultProps {
  generalData: GeneralData;
  pages: CoverPage[];
  onReset: () => void;
}

function base64ToObjectUrl(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function StepResult({
  generalData,
  pages,
  onReset,
}: StepResultProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<GeneratedDownload[]>([]);

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

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/capas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalData, pages }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Nao foi possivel gerar os arquivos.");
      }

      const payload = (await response.json()) as GenerateResponse;

      downloads.forEach((d) => URL.revokeObjectURL(d.url));

      setDownloads(
        [
          {
            fileName: payload.files.odt.name,
            kind: "odt" as const,
            url: base64ToObjectUrl(payload.files.odt.data, "application/vnd.oasis.opendocument.text"),
          },
          payload.files.pdf
            ? {
                fileName: payload.files.pdf.name,
                kind: "pdf" as const,
                url: base64ToObjectUrl(payload.files.pdf.data, "application/pdf"),
              }
            : null,
          {
            fileName: payload.files.zip.name,
            kind: "zip" as const,
            url: base64ToObjectUrl(payload.files.zip.data, "application/zip"),
          },
        ].filter((d): d is GeneratedDownload => Boolean(d)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar arquivos");
    } finally {
      setGenerating(false);
    }
  }

  const { codigoInterno: _unused, siglaArquivo: _unused2, ...shownData } = generalData;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resultado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clique em Gerar para criar os arquivos. O ODT sempre estara disponivel.
          O PDF depende do LibreOffice no servidor.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Iniciar nova geracao
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          {generating ? "Gerando..." : "Gerar arquivos"}
        </Button>
      </div>

      {downloads.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <DownloadCard
            icon={FileText}
            label="ODT"
            fileName={getFileName(code, sigla, rev, "odt")}
            description="Documento editavel"
            download={downloads.find((d) => d.kind === "odt")}
          />
          <DownloadCard
            icon={FileCheck}
            label="PDF"
            fileName={getFileName(code, sigla, rev, "pdf")}
            description={downloads.some((d) => d.kind === "pdf") ? "Arquivo final para envio" : "PDF indisponivel (requer LibreOffice no servidor)"}
            download={downloads.find((d) => d.kind === "pdf")}
            unavailable={!downloads.some((d) => d.kind === "pdf")}
          />
          <DownloadCard
            icon={FolderArchive}
            label="ZIP"
            fileName={getFileName(code, sigla, rev, "zip")}
            description={downloads.some((d) => d.kind === "pdf") ? "ODT + PDF no mesmo pacote" : "Apenas ODT (PDF indisponivel)"}
            download={downloads.find((d) => d.kind === "zip")}
            primary
          />
        </div>
      )}

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

function DownloadCard({
  icon: Icon,
  label,
  fileName,
  description,
  download,
  unavailable,
  primary,
}: {
  icon: typeof FileText;
  label: string;
  fileName: string;
  description: string;
  download?: GeneratedDownload;
  unavailable?: boolean;
  primary?: boolean;
}) {
  return (
    <div className="border border-border bg-card p-4 text-center">
      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center border ${
        unavailable ? "border-muted-foreground/25 bg-muted" : "border-primary/25 bg-primary/10"
      }`}>
        <Icon className={`h-4 w-4 ${unavailable ? "text-muted-foreground" : "text-primary"}`} />
      </div>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
        {fileName}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      {download ? (
        <Button
          className="mt-4 w-full"
          variant={primary ? "default" : "outline"}
          asChild
        >
          <a href={download.url} download={download.fileName}>
            <Download className="mr-1.5 h-4 w-4" />
            Baixar {label}
          </a>
        </Button>
      ) : (
        <Button
          className="mt-4 w-full"
          variant="outline"
          disabled
        >
          <Ban className="mr-1.5 h-4 w-4" />
          Indisponivel
        </Button>
      )}
    </div>
  );
}
