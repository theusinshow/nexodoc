"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FolderUp,
  FileText,
  Trash2,
  Waypoints,
  Loader2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { ScanLine, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { NexoDossieDraft, NexoFileClassification } from "../types";
import { extractSelosFromFiles, type SeloResult } from "../lib/selo-render";
import { sheetNumberFromFilename, resolveSheetNumbers } from "@/server/nexo/parse-filename";
import { MESES } from "@/modules/cover-generator/constants";
import type { LightCheckResult } from "@/server/nexo/light-check-core";
import type { AuditReport } from "@/lib/audit-report";
import { runMemorialAudit, type MemorialAuditLevel } from "../lib/audit";
import { NexoChat } from "./NexoChat";

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
  // Selos lidos das pranchas: elevado do SelosPanel para o chat do agente também
  // enxergar (o agente propõe LD/capa a partir deles).
  const [seloResults, setSeloResults] = useState<SeloResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  // SeloForLd[] (fileName + pageNumber + extração) que as rotas consomem.
  const selos = seloResults
    .filter((r) => r.extraction)
    .map((r) => ({ fileName: r.fileName, pageNumber: r.pageNumber, ...r.extraction! }));

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
          <SelosPanel results={seloResults} setResults={setSeloResults} />
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

          <NexoChat selos={selos} />
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

/** Folha resolvida (reconciliação por ordem de página) de cada resultado lido,
 *  alinhada ao array `results`. Fonte única p/ exibir e ordenar a tabela. */
function resolveReadFolhas(results: SeloResult[]): (number | null)[] {
  return resolveSheetNumbers(
    results.map((r) => ({
      fileName: r.fileName,
      pageNumber: r.pageNumber,
      arquivo: r.extraction?.arquivo,
      folha: r.extraction?.folha,
    })),
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
interface LdGenResult {
  resumo: { disciplina: string; codigo: string; revisao: string; totalFolhas: number };
  warnings: string[];
  odtUrl: string;
  odtName: string;
  pdfUrl?: string;
  pdfName?: string;
}

interface NexoTemplateOption {
  id: string;
  nome: string;
  grupo?: string;
  variante?: string;
}

interface CapaGenResult {
  resumo: {
    prefeitura: string;
    disciplina: string;
    codigo: string;
    volume: string;
    tomos: number;
  };
  pdfError?: string;
  zipUrl: string;
  zipName: string;
  odtUrl: string;
  odtName: string;
  pdfUrl?: string;
  pdfName?: string;
}

const ODT_MIME = "application/vnd.oasis.opendocument.text";

function base64ToUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Lê um File como base64 cru (sem o prefixo data:...;base64,). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function SelosPanel({
  results,
  setResults,
}: {
  results: SeloResult[];
  setResults: (r: SeloResult[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ldBusy, setLdBusy] = useState(false);
  const [ld, setLd] = useState<LdGenResult | null>(null);
  // null = ainda usa o palpite do selo; string = o engenheiro editou.
  const [tituloEditado, setTituloEditado] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NexoTemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [capaBusy, setCapaBusy] = useState(false);
  const [capa, setCapa] = useState<CapaGenResult | null>(null);
  // Nº de tomos: decisão do engenheiro, compartilhada por LD e capa (projeto
  // grande -> divide). null = ainda não editado (=1).
  // Nº de tomos: divide as folhas em N (decisão do engenheiro). Default 1.
  const [numTomos, setNumTomos] = useState(1);
  // Tomo ESPECÍFICO (replicar 1 tomo, ex.: 4 = "TOMO 04"). 0 = usar numTomos.
  const [tomoNumero, setTomoNumero] = useState(0);
  // Nome da separatriz (nome completo da disciplina). Vazio = deriva do título.
  const [separatrizNome, setSeparatrizNome] = useState("");
  // Volume da capa: null = usa o inferido do nome; string = engenheiro editou.
  // Afeta só a capa (o volume às vezes é trocado manualmente dentro do volume).
  const [volumeCapa, setVolumeCapa] = useState<string | null>(null);
  // Mês/ano da capa: null = usa o atual; string = engenheiro editou (a capa às
  // vezes é de outro mês — trabalha em julho mas a capa é maio/junho).
  const [mesCapa, setMesCapa] = useState<string | null>(null);
  const [anoCapa, setAnoCapa] = useState<string | null>(null);
  // Conferência leve (auditoria do caso comum, sem memorial).
  const [check, setCheck] = useState<LightCheckResult | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  // Montar volume: precisa dos PDFs das partes. Guardamos os arquivos das
  // pranchas + o base64 dos PDFs gerados (capa/LD) p/ concatenar no fim.
  const [pranchaFiles, setPranchaFiles] = useState<File[]>([]);
  const [capaPdf64, setCapaPdf64] = useState<string | null>(null);
  const [ldPdf64, setLdPdf64] = useState<string | null>(null);
  const [vol, setVol] = useState<{ url: string; name: string; pageCount?: number } | null>(null);
  const [volBusy, setVolBusy] = useState(false);
  // Auditoria do memorial (caso raro): reusa o motor /api/audit com gabarito auto.
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
  const [auditLevel, setAuditLevel] = useState<MemorialAuditLevel>("standard");
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const memorialRef = useRef<HTMLInputElement>(null);

  // Título é decisão do engenheiro: começa em branco, ele preenche.
  const tituloLd = tituloEditado ?? "";

  // Lista de prefeituras (templates de capa) — carrega uma vez.
  useEffect(() => {
    fetch("/api/capas/templates")
      .then((r) => r.json())
      .then((d) => {
        const list: NexoTemplateOption[] = d.templates ?? [];
        setTemplates(list);
        setTemplateId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  async function gerarCapa() {
    const selos = results
      .filter((r) => r.extraction)
      .map((r) => ({ fileName: r.fileName, pageNumber: r.pageNumber, ...r.extraction }));
    if (selos.length === 0 || !templateId) return;
    setCapaBusy(true);
    setError(null);
    setCapa(null);
    try {
      const res = await fetch("/api/nexo/capa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selos,
          templateId,
          numTomos,
          tomoNumero,
          // Título da capa = título da LD (devem coincidir).
          ...(tituloLd.trim() ? { tituloCapa: tituloLd.trim() } : {}),
          ...(volumeCapa?.trim() ? { volume: volumeCapa.trim() } : {}),
          ...(mesCapa?.trim() ? { mes: mesCapa.trim() } : {}),
          ...(anoCapa?.trim() ? { ano: anoCapa.trim() } : {}),
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            error?: string;
            resumo?: CapaGenResult["resumo"];
            pdfError?: string;
            files?: {
              odt: { name: string; data: string };
              pdf: { name: string; data: string } | null;
              zip: { name: string; data: string };
            } | null;
          }
        | null;
      if (!res.ok || !payload?.files) {
        throw new Error(payload?.error ?? "Falha ao gerar a capa.");
      }
      setCapa({
        resumo: payload.resumo!,
        pdfError: payload.pdfError,
        odtName: payload.files.odt.name,
        odtUrl: base64ToUrl(payload.files.odt.data, ODT_MIME),
        zipName: payload.files.zip.name,
        zipUrl: base64ToUrl(payload.files.zip.data, "application/zip"),
        pdfName: payload.files.pdf?.name,
        pdfUrl: payload.files.pdf
          ? base64ToUrl(payload.files.pdf.data, "application/pdf")
          : undefined,
      });
      setCapaPdf64(payload.files.pdf?.data ?? null);
      setVol(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a capa.");
    } finally {
      setCapaBusy(false);
    }
  }

  async function gerarLd() {
    const selos = results
      .filter((r) => r.extraction)
      .map((r) => ({ fileName: r.fileName, pageNumber: r.pageNumber, ...r.extraction }));
    if (selos.length === 0) return;
    setLdBusy(true);
    setError(null);
    setLd(null);
    try {
      const res = await fetch("/api/nexo/ld", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selos, tituloLd, numTomos, tomoNumero }),
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            error?: string;
            resumo?: LdGenResult["resumo"];
            warnings?: string[];
            files?: {
              odt: { name: string; data: string };
              pdf: { name: string; data: string } | null;
            } | null;
          }
        | null;
      if (!res.ok || !payload?.files) {
        throw new Error(payload?.error ?? "Falha ao gerar a LD.");
      }
      setLd({
        resumo: payload.resumo!,
        warnings: payload.warnings ?? [],
        odtName: payload.files.odt.name,
        odtUrl: base64ToUrl(
          payload.files.odt.data,
          "application/vnd.oasis.opendocument.text",
        ),
        pdfName: payload.files.pdf?.name,
        pdfUrl: payload.files.pdf
          ? base64ToUrl(payload.files.pdf.data, "application/pdf")
          : undefined,
      });
      setLdPdf64(payload.files.pdf?.data ?? null);
      setVol(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a LD.");
    } finally {
      setLdBusy(false);
    }
  }

  async function conferir() {
    const selos = results
      .filter((r) => r.extraction)
      .map((r) => ({ fileName: r.fileName, pageNumber: r.pageNumber, ...r.extraction }));
    if (selos.length === 0) return;
    setCheckBusy(true);
    setError(null);
    setCheck(null);
    try {
      const res = await fetch("/api/nexo/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selos }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; result?: LightCheckResult }
        | null;
      if (!res.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Falha na conferência.");
      }
      setCheck(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conferência.");
    } finally {
      setCheckBusy(false);
    }
  }

  async function montarVolume() {
    if (!capaPdf64 && !ldPdf64 && pranchaFiles.length === 0) return;
    setVolBusy(true);
    setError(null);
    setVol(null);
    try {
      // Páginas de PRANCHA por arquivo (as que têm folha na leitura). Num PDF
      // COMBINADO (capa+separatriz+LD+pranchas), isso exclui a capa/LD internas —
      // senão o volume duplica (capa, LD, ...capa, LD, pranchas).
      const readFolhas = resolveReadFolhas(results);
      const pranchaPagesByFile = new Map<string, number[]>();
      results.forEach((r, i) => {
        if (readFolhas[i] != null) {
          const arr = pranchaPagesByFile.get(r.fileName);
          if (arr) arr.push(r.pageNumber);
          else pranchaPagesByFile.set(r.fileName, [r.pageNumber]);
        }
      });

      // Ordem canônica do escritório: CAPA -> SEPARATRIZ -> LD -> PRANCHAS.
      const parts: {
        role: string;
        name: string;
        data: string;
        startPage?: number;
        endPage?: number;
      }[] = [];
      if (capaPdf64) parts.push({ role: "capa", name: "capa.pdf", data: capaPdf64 });

      // Separatriz: folha simples com o NOME DA DISCIPLINA (nome próprio, ex.:
      // "PROJETO DE ESTRUTURAS DE CONCRETO"), que difere do título da LD.
      const sepTitle =
        separatrizNome.trim() ||
        tituloLd.trim().replace(/\s[-–]\s.*$/, "").trim() ||
        ld?.resumo.disciplina ||
        "";
      if (sepTitle) {
        try {
          const sepRes = await fetch("/api/nexo/separatriz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: sepTitle,
              codigo: ld?.resumo.codigo,
              revisao: ld?.resumo.revisao,
            }),
          });
          const sepPayload = (await sepRes.json().catch(() => null)) as
            | { pdf?: { data: string } | null }
            | null;
          if (sepRes.ok && sepPayload?.pdf) {
            parts.push({ role: "separatriz", name: "separatriz.pdf", data: sepPayload.pdf.data });
          }
        } catch {
          /* separatriz é best-effort; volume segue sem ela */
        }
      }

      if (ldPdf64) parts.push({ role: "ld", name: "ld.pdf", data: ldPdf64 });
      const ordered = [...pranchaFiles].sort(
        (a, b) =>
          (sheetNumberFromFilename(a.name) ?? 9999) -
          (sheetNumberFromFilename(b.name) ?? 9999),
      );
      for (const f of ordered) {
        const data = await fileToBase64(f);
        const pages = pranchaPagesByFile.get(f.name);
        if (pages && pages.length > 0) {
          // recorta no intervalo de pranchas (exclui capa/LD internas do combinado)
          parts.push({
            role: "prancha",
            name: f.name,
            data,
            startPage: Math.min(...pages),
            endPage: Math.max(...pages),
          });
        } else {
          parts.push({ role: "prancha", name: f.name, data });
        }
      }
      const res = await fetch("/api/nexo/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts, fileName: "volume.pdf" }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; pdf?: { name: string; data: string } | null; pageCount?: number }
        | null;
      if (!res.ok || !payload?.pdf) {
        throw new Error(payload?.error ?? "Falha ao montar o volume.");
      }
      setVol({
        url: base64ToUrl(payload.pdf.data, "application/pdf"),
        name: payload.pdf.name,
        pageCount: payload.pageCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar o volume.");
    } finally {
      setVolBusy(false);
    }
  }

  async function auditarMemorial() {
    if (!memorialFile) return;
    setAuditBusy(true);
    setError(null);
    setAudit(null);
    try {
      // Gabarito automático: obra do carimbo das pranchas + prefeitura do template.
      const obras = new Map<string, number>();
      for (const r of results) {
        const o = r.extraction?.obra?.trim();
        if (o) obras.set(o, (obras.get(o) ?? 0) + 1);
      }
      let obra = "";
      let best = 0;
      for (const [k, n] of obras) if (n > best) [obra, best] = [k, n];
      const t = templates.find((x) => x.id === templateId);
      const prefeitura = t ? (t.grupo ?? t.nome) : undefined;

      const report = await runMemorialAudit(
        memorialFile,
        { obra: obra || undefined, prefeitura },
        auditLevel,
      );
      setAudit(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na auditoria do memorial.");
    } finally {
      setAuditBusy(false);
    }
  }

  async function run(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    if (files.length === 0) {
      setError("Selecione PDFs de pranchas.");
      return;
    }
    setError(null);
    setResults([]);
    setPranchaFiles(files); // guarda p/ montar o volume no fim
    setCheck(null);
    setVol(null);
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

  // Folha resolvida (reconciliação por ordem de página) alinhada a `results`.
  const readFolhas = resolveReadFolhas(results);
  // A leitura é ~3 concorrente, então chega fora de ordem. Exibir por folha
  // (a ordem que o engenheiro espera); erros/sem-folha vão para o fim.
  const sortedRows = results
    .map((r, i) => ({ r, folha: readFolhas[i] }))
    .sort(
      (a, b) =>
        (a.folha ?? Number.MAX_SAFE_INTEGER) - (b.folha ?? Number.MAX_SAFE_INTEGER),
    );

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
              {sortedRows.map(({ r, folha }, i) => (
                <tr key={`${r.fileName}-${r.pageNumber}-${i}`} className="border-b border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs tabular-nums whitespace-nowrap">
                    {folha != null ? String(folha).padStart(2, "0") : "—"}
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

      {okCount > 0 && !busy && (
        <div className="flex flex-col gap-3 border-t border-border p-4">
          <label className="block space-y-1.5">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Titulo da LD
            </span>
            <input
              value={tituloLd}
              onChange={(e) => setTituloEditado(e.target.value)}
              placeholder="Ex.: PROJETO ESTRUTURAL DE CONCRETO - BLOCO B"
              className="flex w-full rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
            />
            <span className="block text-xs text-muted-foreground">
              Varia por projeto. Confirme antes de gerar. O tomo, quando houver, e
              anexado automaticamente.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Numero de tomos
            </span>
            <input
              type="number"
              min={1}
              max={99}
              value={numTomos}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setNumTomos(Number.isFinite(n) && n >= 1 ? Math.min(99, n) : 1);
              }}
              className="flex w-24 rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
            />
            <span className="block text-xs text-muted-foreground">
              Divide as folhas em N tomos (a LD ganha uma secao por tomo; sai uma
              capa por tomo). 1 = tomo unico. Vale para LD e capa.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Numero do tomo (especifico)
            </span>
            <input
              type="number"
              min={0}
              max={99}
              value={tomoNumero}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setTomoNumero(Number.isFinite(n) && n >= 0 ? Math.min(99, n) : 0);
              }}
              className="flex w-24 rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
            />
            <span className="block text-xs text-muted-foreground">
              Para REPLICAR um tomo existente: diz qual e (ex.: 4) e sai &quot;TOMO
              04&quot; na capa e &quot;(TOMO 04)&quot; na LD. 0 = usar &quot;numero de
              tomos&quot; acima.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Nome da separatriz
            </span>
            <input
              type="text"
              value={separatrizNome}
              onChange={(e) => setSeparatrizNome(e.target.value)}
              placeholder="ex.: PROJETO DE ESTRUTURAS DE CONCRETO"
              className="flex w-full rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 py-1.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
            />
            <span className="block text-xs text-muted-foreground">
              Nome completo da disciplina na folha separatriz (costuma diferir do
              titulo da LD). Vazio = deriva do titulo. Usado ao montar volume.
            </span>
          </label>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {okCount} folhas prontas para virar LD.
            </span>
            <Button size="sm" onClick={gerarLd} disabled={ldBusy}>
              {ldBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              {ldBusy ? "Gerando..." : "Gerar LD"}
            </Button>
          </div>

          {ld && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
              <p className="text-sm">
                LD <span className="font-medium">{ld.resumo.disciplina}</span> ·{" "}
                {ld.resumo.codigo} · rev {ld.resumo.revisao} ·{" "}
                <span className="tabular-nums">{ld.resumo.totalFolhas}</span> folhas
                {ld.warnings.length > 0 && (
                  <span className="text-[var(--status-warning)]">
                    {" "}
                    · {ld.warnings.length} aviso(s)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={ld.odtUrl} download={ld.odtName}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    ODT
                  </a>
                </Button>
                {ld.pdfUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={ld.pdfUrl} download={ld.pdfName}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Capa: precisa da prefeitura (orgao/secretaria/formato de volume) */}
          <div className="flex flex-col gap-2 border-t border-dashed border-border pt-3">
            <label className="block space-y-1.5">
              <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Prefeitura (capa)
              </span>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex w-full rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
              >
                {templates.length === 0 && <option value="">Carregando...</option>}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.grupo ?? t.nome) + (t.variante ? ` — ${t.variante}` : "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Volume (capa)
              </span>
              <input
                value={volumeCapa ?? ""}
                onChange={(e) => setVolumeCapa(e.target.value)}
                placeholder="auto (do nome do arquivo)"
                className="flex w-32 rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm tabular-nums transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
              />
              <span className="block text-xs text-muted-foreground">
                Numero arabico (1, 2, ...). Vazio = usa o volume do nome do arquivo.
                As vezes o volume e trocado manualmente; afeta so a capa.
              </span>
            </label>
            <div className="flex gap-2">
              <label className="block flex-1 space-y-1.5">
                <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Mes (capa)
                </span>
                <select
                  value={mesCapa ?? ""}
                  onChange={(e) => setMesCapa(e.target.value || null)}
                  className="flex w-full rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  <option value="">atual</option>
                  {MESES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block flex-1 space-y-1.5">
                <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Ano (capa)
                </span>
                <input
                  value={anoCapa ?? ""}
                  onChange={(e) => setAnoCapa(e.target.value || null)}
                  placeholder="atual"
                  inputMode="numeric"
                  className="flex w-full rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm tabular-nums transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
                />
              </label>
            </div>
            <span className="block text-xs text-muted-foreground">
              A capa as vezes e de outro mes (trabalha em julho, mas a capa e
              maio/junho). Vazio = mes/ano atual.
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Usa o titulo acima e a obra/fase do selo.
              </span>
              <Button size="sm" onClick={gerarCapa} disabled={capaBusy || !templateId}>
                {capaBusy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                )}
                {capaBusy ? "Gerando..." : "Gerar capa"}
              </Button>
            </div>

            {capa && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
                <p className="text-sm">
                  Capa <span className="font-medium">{capa.resumo.prefeitura}</span> ·{" "}
                  {capa.resumo.disciplina} · {capa.resumo.codigo} · vol {capa.resumo.volume}
                  {capa.resumo.tomos > 1 && (
                    <span className="tabular-nums"> · {capa.resumo.tomos} tomos</span>
                  )}
                  {capa.pdfError && (
                    <span className="text-[var(--status-warning)]"> · PDF indisponivel</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <a href={capa.zipUrl} download={capa.zipName}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      ZIP
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={capa.odtUrl} download={capa.odtName}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      ODT
                    </a>
                  </Button>
                  {capa.pdfUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={capa.pdfUrl} download={capa.pdfName}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        PDF
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Conferencia leve + montar volume (fecham o caso comum) */}
          <div className="flex flex-col gap-3 border-t border-dashed border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Conferencia leve
                </span>
                <span className="block text-xs text-muted-foreground">
                  Confere se as pranchas batem entre si (codigo/obra/revisao/folhas).
                  Sem memorial.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={conferir} disabled={checkBusy}>
                {checkBusy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                )}
                {checkBusy ? "Conferindo..." : "Conferir"}
              </Button>
            </div>

            {check && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      check.veredito === "critico"
                        ? "critical"
                        : check.veredito === "aviso"
                          ? "warning"
                          : "ok"
                    }
                  >
                    {check.veredito === "critico"
                      ? "🔴 Nao emitir"
                      : check.veredito === "aviso"
                        ? "🟡 Revisar"
                        : "🟢 Consistente"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {check.findings.length} achado(s)
                  </span>
                </div>
                {check.findings.length > 0 && (
                  <ul className="space-y-1.5">
                    {check.findings.map((f, i) => (
                      <li key={i} className="text-xs">
                        <span
                          className={
                            f.severidade === "critico"
                              ? "font-medium text-destructive"
                              : f.severidade === "aviso"
                                ? "font-medium text-[var(--status-warning)]"
                                : "font-medium text-muted-foreground"
                          }
                        >
                          [{f.campo}]
                        </span>{" "}
                        {f.mensagem}
                        {f.detalhe && (
                          <span className="block pl-2 text-muted-foreground">
                            {f.detalhe}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <div>
                <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Montar volume
                </span>
                <span className="block text-xs text-muted-foreground">
                  Junta capa + LD + pranchas num PDF unico (ordem: capa, LD, folhas).
                </span>
              </div>
              <Button
                size="sm"
                onClick={montarVolume}
                disabled={volBusy || pranchaFiles.length === 0}
              >
                {volBusy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Layers className="mr-1.5 h-3.5 w-3.5" />
                )}
                {volBusy ? "Montando..." : "Montar volume"}
              </Button>
            </div>

            {vol && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
                <p className="text-sm">
                  Volume montado
                  {vol.pageCount != null && (
                    <span className="tabular-nums"> · {vol.pageCount} paginas</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <a href={vol.url} download={vol.name}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PDF do volume
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Auditoria do memorial (caso raro) — reusa o motor /api/audit */}
          <div className="flex flex-col gap-3 border-t border-dashed border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Auditoria do memorial
                </span>
                <span className="block text-xs text-muted-foreground">
                  Quando o memorial estiver pronto, audita contra a obra das
                  pranchas (gabarito automatico). Motor completo da auditoria.
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={auditLevel}
                  onChange={(e) => setAuditLevel(e.target.value as MemorialAuditLevel)}
                  className="rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-2 py-1 text-xs focus-visible:border-ring focus-visible:outline-none"
                >
                  <option value="standard">padrao</option>
                  <option value="deep">profunda</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => memorialRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {memorialFile ? "Trocar" : "Anexar"}
                </Button>
                <Button
                  size="sm"
                  onClick={auditarMemorial}
                  disabled={auditBusy || !memorialFile}
                >
                  {auditBusy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {auditBusy ? "Auditando..." : "Auditar"}
                </Button>
              </div>
            </div>
            <input
              ref={memorialRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                setMemorialFile(e.target.files?.[0] ?? null);
                setAudit(null);
                e.target.value = "";
              }}
            />
            {memorialFile && (
              <p className="text-xs text-muted-foreground">
                Memorial: <span className="font-medium">{memorialFile.name}</span>
              </p>
            )}

            {audit && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={auditVerdictVariant(audit.status_geral)}>
                    {audit.status_geral}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {audit.total_incongruencias} achado(s) · obra{" "}
                    {audit.obra || "?"}
                  </span>
                </div>
                {audit.conclusao && (
                  <p className="text-sm text-muted-foreground">{audit.conclusao}</p>
                )}
                {audit.incongruencias.length > 0 && (
                  <ul className="space-y-1.5">
                    {audit.incongruencias.slice(0, 8).map((f) => (
                      <li key={f.id} className="text-xs">
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          [{f.prioridade}]
                        </span>{" "}
                        {f.descricao}
                      </li>
                    ))}
                    {audit.incongruencias.length > 8 && (
                      <li className="text-xs text-muted-foreground">
                        +{audit.incongruencias.length - 8} outro(s). Relatorio
                        completo no modulo Auditoria.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** status_geral da auditoria -> variante do Badge. */
function auditVerdictVariant(
  status: AuditReport["status_geral"],
): "ok" | "warning" | "critical" {
  if (status === "sem achados críticos") return "ok";
  if (status === "com pontos de revisão") return "warning";
  return "critical";
}
