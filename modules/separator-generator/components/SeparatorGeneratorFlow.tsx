"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  FileCheck,
  FolderArchive,
  Download,
  Loader2,
  AlertTriangle,
  Ban,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DisciplineQuickPick } from "@/modules/cover-generator/components/DisciplineQuickPick";

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
  pdfError?: string;
}

interface SeparatorGeneratorFlowProps {
  initialTitles?: string[];
  initialCodigo?: string;
  initialRevisao?: string;
}

function base64ToObjectUrl(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function buildFileName(codigo: string, revisao: string, ext: string): string {
  return (
    [codigo.trim(), "separatrizes", revisao.trim() || "r"]
      .filter(Boolean)
      .join("_") + `.${ext}`
  );
}

export function SeparatorGeneratorFlow({
  initialTitles,
  initialCodigo,
  initialRevisao,
}: SeparatorGeneratorFlowProps) {
  const [titlesText, setTitlesText] = useState(
    (initialTitles ?? []).join("\n")
  );
  const [codigo, setCodigo] = useState(initialCodigo ?? "");
  const [revisao, setRevisao] = useState(initialRevisao ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<GeneratedDownload[]>([]);

  const titles = useMemo(
    () =>
      titlesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [titlesText]
  );

  const canGenerate = titles.length > 0 && !generating;
  const hasPdf = downloads.some((d) => d.kind === "pdf");

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setPdfError(null);

    try {
      const response = await fetch("/api/separatrizes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles, codigo, revisao }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Nao foi possivel gerar as separatrizes.");
      }

      const payload = (await response.json()) as GenerateResponse;

      setDownloads((prev) => {
        prev.forEach((d) => URL.revokeObjectURL(d.url));
        return [
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
        ].filter((d): d is GeneratedDownload => Boolean(d));
      });

      if (payload.pdfError) setPdfError(payload.pdfError);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar separatrizes");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Disciplinas do volume
              <span className="ml-1 font-normal normal-case">(uma por linha — cada uma vira uma folha)</span>
            </label>
            <Textarea
              value={titlesText}
              onChange={(e) => setTitlesText(e.target.value)}
              placeholder={"PROJETO DE INSTALACOES ELETRICAS\nPROJETO DE INSTALACOES DE CABEAMENTO ESTRUTURADO\nPROJETO DE CFTV"}
              rows={6}
              className="font-mono text-sm"
            />
            <DisciplineQuickPick value={titlesText} onChange={setTitlesText} />
            <p className="text-xs text-muted-foreground">
              Dica: o texto da separatriz costuma ser mais completo que o da capa
              (ex.: &quot;PROJETO DE INSTALACOES ELETRICAS&quot; em vez de
              &quot;PROJETO ELETRICO&quot;). Ajuste cada linha como quiser.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Codigo do arquivo
                <span className="ml-1 font-normal normal-case">(opcional)</span>
              </label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="040_26"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Revisao
              </label>
              <Input
                value={revisao}
                onChange={(e) => setRevisao(e.target.value)}
                placeholder="a"
                className="font-mono"
              />
            </div>
            <p className="sm:col-span-2 font-mono text-xs text-muted-foreground">
              Arquivo: {buildFileName(codigo, revisao, "odt")}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="font-mono text-xs text-muted-foreground">
              {titles.length} folha(s) separatriz(es)
            </p>
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              {generating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              {generating ? "Gerando..." : "Gerar separatrizes"}
            </Button>
          </div>

          {downloads.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <DownloadCard
                icon={FileText}
                label="ODT"
                description="Documento editavel"
                download={downloads.find((d) => d.kind === "odt")}
              />
              <DownloadCard
                icon={FileCheck}
                label="PDF"
                description={
                  hasPdf
                    ? "Arquivo final para envio"
                    : pdfError
                      ? `PDF indisponivel: ${pdfError}`
                      : "PDF indisponivel (conversor nao configurado)"
                }
                download={downloads.find((d) => d.kind === "pdf")}
                unavailable={!hasPdf}
              />
              <DownloadCard
                icon={FolderArchive}
                label="ZIP"
                description={hasPdf ? "ODT + PDF" : "Apenas ODT (PDF indisponivel)"}
                download={downloads.find((d) => d.kind === "zip")}
                primary
              />
            </div>
          )}
        </div>

        {/* Previa */}
        <aside className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Previa ({titles.length})
            </h3>
          </div>
          {titles.length === 0 ? (
            <div className="border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
              Informe as disciplinas para ver a previa das folhas.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {titles.map((title, index) => (
                <MiniSeparator key={`${title}-${index}`} title={title} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MiniSeparator({ title }: { title: string }) {
  return (
    <div className="aspect-[210/297] w-full border border-border bg-card p-3 shadow-subtle">
      <div className="flex h-full flex-col">
        <div className="mt-auto pb-[18%] text-right text-[8px] font-bold uppercase leading-tight text-foreground">
          {title}
        </div>
      </div>
    </div>
  );
}

function DownloadCard({
  icon: Icon,
  label,
  description,
  download,
  unavailable,
  primary,
}: {
  icon: typeof FileText;
  label: string;
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
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      {download ? (
        <Button className="mt-4 w-full" variant={primary ? "default" : "outline"} asChild>
          <a href={download.url} download={download.fileName}>
            <Download className="mr-1.5 h-4 w-4" />
            Baixar {label}
          </a>
        </Button>
      ) : (
        <Button className="mt-4 w-full" variant="outline" disabled>
          <Ban className="mr-1.5 h-4 w-4" />
          Indisponivel
        </Button>
      )}
    </div>
  );
}
