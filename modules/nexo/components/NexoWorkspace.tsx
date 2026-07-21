"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FolderUp,
  FileText,
  Trash2,
  Waypoints,
  Send,
  Loader2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { NexoDossieDraft, NexoFileClassification } from "../types";
import { extractSelosFromFiles, type SeloResult } from "../lib/selo-render";

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
 * Fase 0/1: intake real. "Anexar PDFs" sobe o conteudo (identidade via memorial);
 * "Anexar pasta" manda so os nomes/caminhos (rapido p/ projeto inteiro) e monta
 * a estrutura por volume. Tudo deterministico, sem IA. O agente chega na Fase 2.
 */
export function NexoWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [dossie, setDossie] = useState<NexoDossieDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  // webkitdirectory nao e prop tipada no React; setar via atributo.
  useEffect(() => {
    if (dirRef.current) {
      dirRef.current.setAttribute("webkitdirectory", "");
      dirRef.current.setAttribute("directory", "");
    }
  }, []);

  const classificationByName = new Map(
    (dossie?.arquivos ?? []).map((a) => [a.fileName, a]),
  );

  async function classifyContent(nextFiles: File[]) {
    if (nextFiles.length === 0) {
      setDossie(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of nextFiles) form.append("files", file);
      form.append(
        "relPaths",
        JSON.stringify(
          nextFiles.map(
            (f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || "",
          ),
        ),
      );
      const res = await fetch("/api/nexo/classify", { method: "POST", body: form });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Falha ao ler os arquivos.");
      }
      const payload = (await res.json()) as { dossie: NexoDossieDraft };
      setDossie(payload.dossie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao classificar.");
    } finally {
      setLoading(false);
    }
  }

  async function classifyFolder(list: FileList) {
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) {
      setError("Nenhum PDF na pasta.");
      return;
    }
    setFiles([]); // pasta nao mantem lista por-arquivo (pode ter centenas)
    setFolderCount(pdfs.length);
    setLoading(true);
    setError(null);
    try {
      const items = pdfs.map((f) => ({
        fileName: f.name,
        relPath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || "",
      }));
      const res = await fetch("/api/nexo/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Falha ao ler a pasta.");
      }
      const payload = (await res.json()) as { dossie: NexoDossieDraft };
      setDossie(payload.dossie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler a pasta.");
    } finally {
      setLoading(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFolderCount(0);
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    void classifyContent(next);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    void classifyContent(next);
  }

  const totalArquivos = folderCount || files.length;

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
            Solte os PDFs ou a pasta do projeto. O Nexo le e afirma o que detectou
            (tipo, obra, disciplinas, volumes) para voce confirmar. A conversa que
            orquestra LD, capas, volume e auditoria chega na proxima fase.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Entrada
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-ring"
            >
              <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium">Anexar PDFs</span>
              <span className="text-xs text-muted-foreground">le identidade</span>
            </button>
            <button
              type="button"
              onClick={() => dirRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-ring"
            >
              <FolderUp className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium">Anexar pasta</span>
              <span className="text-xs text-muted-foreground">projeto inteiro</span>
            </button>
          </div>
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
          <input
            ref={dirRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void classifyFolder(e.target.files);
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
                        onClick={() => removeFile(index)}
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
                  value={dossie.disciplinas.length ? dossie.disciplinas.join(", ") : undefined}
                />
                <DossieRow label="Arquivos" value={totalArquivos ? String(totalArquivos) : undefined} />
              </dl>
            </div>
          )}
        </div>

        {/* Direita: selos (fluxo comum) + estrutura + conversa */}
        <div className="space-y-4">
          <SelosPanel />
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

          <div className="flex min-h-[280px] flex-col rounded-md border border-border bg-card">
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
                description="O intake ja le e estrutura seus arquivos. Quando o agente entrar (Fase 2), a conversa aqui vai propor LD, capas, volume e auditoria a partir do dossie, confirmando cada passo."
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

/**
 * Leitura de selo das pranchas (fluxo canonico). Renderiza o carimbo no browser
 * e OCRa via /api/ld/extract-stamp; mostra o que extraiu de cada folha — a
 * materia-prima da LD (proximo passo: virar proposta de LD + capa).
 */
function SelosPanel() {
  const [results, setResults] = useState<SeloResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function run(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    if (files.length === 0) {
      setError("Selecione PDFs de pranchas.");
      return;
    }
    setError(null);
    setResults([]);
    setBusy(true);
    try {
      const collected: SeloResult[] = [];
      await extractSelosFromFiles(files, (r) => {
        collected.push(r);
        setResults([...collected]);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler selos.");
    } finally {
      setBusy(false);
    }
  }

  const okCount = results.filter((r) => r.extraction).length;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Selos das pranchas
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanLine className="mr-1.5 h-3.5 w-3.5" />
          )}
          {busy ? "Lendo selos..." : "Ler pranchas"}
        </Button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void run(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <div role="alert" className="px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {results.length === 0 && !busy && !error ? (
        <EmptyState
          className="py-8"
          description="Anexe as pranchas de uma disciplina. O Nexo le o selo de cada folha (obra, disciplina, numero, descricao) — base da LD e da capa."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-xs text-muted-foreground">
                <th className="px-3 py-2">Folha</th>
                <th className="px-3 py-2">Descricao</th>
                <th className="px-3 py-2">Disc.</th>
                <th className="px-3 py-2">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={`${r.fileName}-${r.pageNumber}-${i}`} className="border-b border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs tabular-nums whitespace-nowrap">
                    {r.extraction?.numeroFolha ??
                      (r.extraction?.folha != null ? String(r.extraction.folha) : "—")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.error ? (
                      <span className="text-destructive">{r.error}</span>
                    ) : (
                      r.extraction?.conteudo || r.extraction?.tituloSecao || "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.extraction?.disciplina ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.extraction ? (
                      <Badge variant={CONFIANCA_BADGE[r.extraction.confianca]}>
                        {r.extraction.confianca}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(busy || okCount > 0) && (
            <div className="px-4 py-2 font-mono text-xs text-muted-foreground">
              {okCount}/{results.length} folhas lidas{busy ? "…" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
