"use client";

/**
 * Drawer de ferramentas DEV (atrás de `NEXT_PUBLIC_NEXO_DEBUG=1`). Contém só o
 * intake de PROJETO INTEIRO — Anexar PDFs (identidade via memorial) / Anexar
 * pasta (estrutura por volume) + Dossiê detectado + Estrutura por volume. É o
 * único caminho NÃO conversacional (caso raro: 600+ PDFs). A geração
 * (LD/capa/conferência/volume/auditoria) mora no chat — o antigo SelosPanel foi
 * dissolvido (item 3).
 *
 * Os `<input type=file>` escondidos vivem no NexoWorkspace (compartilhados com o
 * fluxo do chat); aqui só disparamos via callbacks.
 */

import {
  Upload,
  FolderUp,
  FileText,
  Trash2,
  Loader2,
  AlertTriangle,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function NexoDebugDrawer({
  files,
  folderCount,
  dossie,
  loading,
  error,
  onPickFiles,
  onPickFolder,
  onRemoveFile,
}: {
  files: File[];
  folderCount: number;
  dossie: NexoDossieDraft | null;
  loading: boolean;
  error: string | null;
  onPickFiles: () => void;
  onPickFolder: () => void;
  onRemoveFile: (index: number) => void;
}) {
  const classificationByName = new Map(
    (dossie?.arquivos ?? []).map((a) => [a.fileName, a]),
  );
  const totalArquivos = folderCount || files.length;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[540px] max-w-[92vw] flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4 shadow-[var(--shadow-overlay)]">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        Intake (dev)
      </p>

      <div className="space-y-3">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Entrada
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPickFiles}
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-ring"
          >
            <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium">Anexar PDFs</span>
            <span className="text-xs text-muted-foreground">le identidade</span>
          </button>
          <button
            type="button"
            onClick={onPickFolder}
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-ring"
          >
            <FolderUp className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium">Anexar pasta</span>
            <span className="text-xs text-muted-foreground">projeto inteiro</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lendo...
          </div>
        )}

        {folderCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Pasta com{" "}
            <span className="font-mono tabular-nums">{folderCount}</span> PDFs.
          </p>
        )}

        {/* Lista por-arquivo (so no modo "Anexar PDFs") */}
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
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(index)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${file.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {found && <FileChips found={found} />}
                </li>
              );
            })}
          </ul>
        )}

        {/* Dossie detectado */}
        {dossie && (
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Dossie detectado
              </span>
              <Badge variant="outline">intake dev</Badge>
            </div>
            <dl className="grid gap-1.5 text-sm">
              <DossieRow label="Obra" value={dossie.obra} />
              <DossieRow label="Orgao" value={dossie.orgao} />
              <DossieRow label="Municipio" value={dossie.municipio} />
              <DossieRow label="Codigo" value={dossie.codigo} />
              <DossieRow label="Revisao" value={dossie.revisao} />
              <DossieRow
                label="Disciplinas"
                value={dossie.disciplinas.length ? dossie.disciplinas.join(", ") : undefined}
              />
              <DossieRow label="Arquivos" value={totalArquivos ? String(totalArquivos) : undefined} />
            </dl>
          </div>
        )}
      </div>

      {/* Estrutura por volume */}
      {dossie && dossie.volumes.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Estrutura do projeto ({dossie.volumes.length} volumes)
            </span>
          </div>
          <ul className="divide-y divide-border">
            {dossie.volumes.map((v) => (
              <li key={v.numero} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{v.rotulo}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.disciplinas.map((d) => (
                      <Badge key={d} variant="outline">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {[
                    v.contagem.memoriais && `${v.contagem.memoriais} memorial`,
                    v.contagem.capas && `${v.contagem.capas} capa`,
                    v.contagem.separatrizes && `${v.contagem.separatrizes} sep.`,
                    v.contagem.pranchas && `${v.contagem.pranchas} pranchas`,
                    v.contagem.volumes && `${v.contagem.volumes} vol.`,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </div>
              </li>
            ))}
            {dossie.semVolume.length > 0 && (
              <li className="px-4 py-3 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{dossie.semVolume.length}</span>{" "}
                sem volume (memorial / avulsos)
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function FileChips({ found }: { found: NexoFileClassification }) {
  if (found.foraDeEscopo) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
        <Badge variant="outline">{found.tipoLabel}</Badge>
        <span className="text-xs text-muted-foreground">fora do escopo do Nexo</span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
      <Badge variant="outline">{found.tipoLabel}</Badge>
      {found.volume && <Badge variant="outline">vol {found.volume}</Badge>}
      {found.disciplinas.map((d) => (
        <Badge key={d} variant="outline">
          {d.toUpperCase()}
        </Badge>
      ))}
      {found.revisao && <Badge variant="outline">rev {found.revisao}</Badge>}
      {found.pageCount > 0 && <Badge variant="outline">{found.pageCount} pag.</Badge>}
      <Badge variant={CONFIANCA_BADGE[found.confianca]}>{found.confianca}</Badge>
      {found.assinado && <Badge variant="outline">assinado</Badge>}
      {found.precisaOcr && <Badge variant="warning">precisa OCR</Badge>}
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
