"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Waypoints,
  Send,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { NexoDossieDraft, NexoFileClassification } from "../types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CONFIANCA_BADGE: Record<
  NexoFileClassification["confianca"],
  "ok" | "warning" | "critical"
> = { alta: "ok", media: "warning", baixa: "critical" };

/**
 * Fase 0/1: o intake ja e REAL — solta os PDFs, o Nexo classifica de forma
 * deterministica (sem IA) e AFIRMA os fatos detectados (tipo, obra, orgao,
 * disciplina, paginas). A conversa (agente) chega na Fase 2.
 */
export function NexoWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [dossie, setDossie] = useState<NexoDossieDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const classificationByName = new Map(
    (dossie?.arquivos ?? []).map((a) => [a.fileName, a]),
  );

  async function classify(nextFiles: File[]) {
    if (nextFiles.length === 0) {
      setDossie(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of nextFiles) form.append("files", file);
      const res = await fetch("/api/nexo/classify", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Falha ao ler os arquivos.");
      }
      const payload = (await res.json()) as { dossie: NexoDossieDraft };
      setDossie(payload.dossie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao classificar.");
    } finally {
      setLoading(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    void classify(next);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    void classify(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
          <Waypoints className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-medium tracking-[-0.01em]">Nexo</h2>
            <Badge variant="warning">Beta</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Solte os PDFs do projeto. O Nexo le e afirma o que detectou (tipo,
            obra, orgao, disciplina) para voce confirmar. A conversa que
            orquestra LD, capas, volume e auditoria chega na proxima fase.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Intake — real */}
        <div className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Arquivos do projeto
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-ring"
          >
            <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium">Anexar PDFs</span>
            <span className="text-xs text-muted-foreground">
              O Nexo classifica cada arquivo automaticamente.
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file, index) => {
                const found = classificationByName.get(file.name);
                return (
                  <li
                    key={`${file.name}-${index}`}
                    className="rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {file.name}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatBytes(file.size)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remover ${file.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {found && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
                        <Badge variant="outline">{found.tipoLabel}</Badge>
                        {found.disciplinaName && (
                          <Badge variant="outline">{found.disciplinaName}</Badge>
                        )}
                        <Badge variant="outline">{found.pageCount} pag.</Badge>
                        <Badge variant={CONFIANCA_BADGE[found.confianca]}>
                          {found.confianca}
                        </Badge>
                        {found.precisaOcr && (
                          <Badge variant="warning">precisa OCR</Badge>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {loading && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lendo arquivos...
            </div>
          )}

          {/* Dossie detectado — o "afirma fatos, pergunta decisoes" */}
          {dossie && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Dossie detectado
                </span>
                <Badge variant="outline">confirmar na Fase 2</Badge>
              </div>
              <dl className="grid gap-1.5 text-sm">
                <DossieRow label="Obra" value={dossie.obra} />
                <DossieRow label="Orgao" value={dossie.orgao} />
                <DossieRow label="Municipio" value={dossie.municipio} />
                <DossieRow label="Codigo" value={dossie.codigo} />
                <DossieRow label="Revisao" value={dossie.revisao} />
                <DossieRow
                  label="Disciplinas"
                  value={
                    dossie.disciplinas.length > 0
                      ? dossie.disciplinas.join(", ")
                      : undefined
                  }
                />
              </dl>
            </div>
          )}
        </div>

        {/* Conversa — placeholder honesto ate a Fase 2 */}
        <div className="flex min-h-[420px] flex-col rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Conversa
            </span>
            <Badge variant="warning">Fase 2</Badge>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Waypoints}
              label="Motor do agente em construcao"
              description="O intake ja le e classifica seus arquivos. Quando o agente entrar (Fase 2), a conversa aqui vai propor LD, capas, volume e auditoria a partir do dossie, confirmando cada passo."
            />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] px-3 py-2 opacity-60">
              <input
                disabled
                placeholder="Ex.: cria as LDs e as capas e junta o volume..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DossieRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 flex-1 font-medium">{value || "—"}</dd>
    </div>
  );
}
