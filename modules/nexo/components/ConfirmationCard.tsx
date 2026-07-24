"use client";

/**
 * ConfirmationCard (C1 / Apêndice A#1 da ARQUITETURA.md) — o card de proposta é
 * READ-ONLY. Nunca formulário. Mostra os parâmetros JÁ resolvidos (mono), a
 * prévia determinística das folhas (LD) e UM botão "Confirmar e gerar". Corrigir
 * NUNCA abre um campo: os chips "alterar <slot>" reabrem o slot EM CONVERSA
 * (escrevem no composer via `fill`), e o próximo turno do agente re-propõe com o
 * valor novo.
 *
 * A geração (passo irreversível) só acontece no clique, chamando a fachada
 * determinística (`generate.ts`) com os params da proposta. A IA nunca gera.
 *
 * Escopo PR4-UI: `ld`, `capa` e `conferencia` fecham ponta-a-ponta com os selos.
 * `separatriz`, `auditoria` e `volume` renderizam read-only, mas a geração plena
 * depende de contexto que chega depois (memorial no composer; bytes das partes no
 * blobRegistry/canvas) — PR5/PR6. Estado honesto, sem fingir.
 */

import { useState, type ReactNode } from "react";
import {
  FileText,
  Layers,
  ScanLine,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { LightCheckResult } from "@/server/nexo/light-check-core";
import type { AuditReport } from "@/lib/audit-report";
import type {
  NexoAgentProposal,
  NexoLdProposalParams,
  NexoCapaProposalParams,
  NexoAuditoriaProposalParams,
  LdPreviewData,
} from "../types";

export type { LdPreviewData };
import {
  postLd,
  postCapa,
  postCheck,
  postAudit,
  type LdGenResult,
  type CapaGenResult,
} from "../lib/generate";
import { assembleVolume, urlToBase64 } from "../lib/assemble-volume";
import { summarizeSelos } from "../lib/agent-context";
import { useComposer } from "../state/composer-controller";
import { useArtifactStore } from "../state/artifact-store";

export interface NexoTemplateOption {
  id: string;
  nome: string;
  grupo?: string;
  variante?: string;
}

const LABEL_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground";

const KIND_META: Record<
  NexoAgentProposal["kind"],
  { title: string; icon: typeof FileText }
> = {
  ld: { title: "LD", icon: FileText },
  capa: { title: "Capa", icon: FileText },
  separatriz: { title: "Separatriz", icon: FileText },
  auditoria: { title: "Auditoria", icon: AlertTriangle },
  conferencia: { title: "Conferência", icon: ScanLine },
  volume: { title: "Volume", icon: Layers },
};

export function ConfirmationCard({
  proposal,
  selos,
  templates,
  ldPreview,
  pranchaFiles = [],
  memorialFile = null,
}: {
  proposal: NexoAgentProposal;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
  ldPreview?: LdPreviewData;
  /** Pranchas originais retidas (bytes p/ montar o volume). */
  pranchaFiles?: File[];
  /** Memorial anexado (arquivo distinto) — alimenta a auditoria. */
  memorialFile?: File | null;
}) {
  switch (proposal.kind) {
    case "ld":
      return <LdConfirmation params={proposal.params} resumo={proposal.resumo} selos={selos} ldPreview={ldPreview} />;
    case "capa":
      return <CapaConfirmation params={proposal.params} resumo={proposal.resumo} selos={selos} templates={templates} />;
    case "conferencia":
      return <ConferenciaConfirmation resumo={proposal.resumo} selos={selos} />;
    case "volume":
      return <VolumeConfirmation resumo={proposal.resumo} selos={selos} pranchaFiles={pranchaFiles} />;
    case "auditoria":
      return (
        <AuditoriaConfirmation
          resumo={proposal.resumo}
          params={proposal.params}
          selos={selos}
          memorialFile={memorialFile}
        />
      );
    case "separatriz":
      return <DeferredConfirmation kind="separatriz" resumo={proposal.resumo} />;
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- Casca ---- */

function CardShell({
  kind,
  resumo,
  children,
}: {
  kind: NexoAgentProposal["kind"];
  resumo: string;
  children: ReactNode;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <div className="nexodoc-enter rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className={LABEL_CLASS}>Proposta · {meta.title}</span>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-sm text-muted-foreground">{resumo}</p>
        {children}
      </div>
    </div>
  );
}

/** Uma linha read-only do resumo: rótulo mono + valor mono. */
function SummaryRow({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${LABEL_CLASS} w-24 shrink-0`}>{label}</span>
      <span
        className={
          missing
            ? "font-mono text-sm italic text-[var(--status-warning)]"
            : "font-mono text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Chip "alterar <slot>": reabre o slot em conversa (escreve a frase no composer). */
function AlterChip({
  label,
  phrase,
  highlight,
}: {
  label: string;
  phrase: string;
  highlight?: boolean;
}) {
  const composer = useComposer();
  return (
    <Chip
      variant={highlight ? "suggest" : "quiet"}
      aria-label={`Alterar ${label} pela conversa`}
      onClick={() => composer.fill(phrase)}
    >
      alterar {label}
    </Chip>
  );
}

function ConfirmButton({
  busy,
  disabled,
  label = "Confirmar e gerar",
  busyLabel = "Gerando…",
  onConfirm,
}: {
  busy: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Button size="sm" onClick={onConfirm} disabled={busy || disabled}>
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      )}
      {busy ? busyLabel : label}
    </Button>
  );
}

function CardError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ LD ---- */

function LdConfirmation({
  params,
  resumo,
  selos,
  ldPreview,
}: {
  params: NexoLdProposalParams;
  resumo: string;
  selos: SeloForLd[];
  ldPreview?: LdPreviewData;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LdGenResult | null>(null);
  const { addArtifact } = useArtifactStore();

  const titulo = params.tituloLd.trim();
  const semTitulo = titulo === "";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await postLd(selos, { tituloLd: titulo, numTomos: params.numTomos });
      setResult(r);
      addArtifact({
        id: `ld:${r.resumo.codigo}:${r.resumo.revisao}`,
        kind: "ld",
        label: `LD ${r.resumo.disciplina}`,
        detail: `${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas`,
        pdfUrl: r.pdfUrl,
        pageNumber: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a LD.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="ld" resumo={resumo}>
      {ldPreview && <FolhaPreview data={ldPreview} />}

      {!result && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Título"
              value={semTitulo ? "defina o título →" : titulo}
              missing={semTitulo}
            />
            <SummaryRow label="Tomos" value={String(params.numTomos)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip
              label="título"
              highlight={semTitulo}
              phrase={semTitulo ? "O título da LD é " : `Muda o título para ${titulo}`}
            />
            <AlterChip label="tomos" phrase="Divide em 2 tomos" />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton busy={busy} disabled={semTitulo} onConfirm={confirm} />
            {semTitulo && (
              <span className="text-xs text-muted-foreground">
                O título é decisão sua — defina pela conversa.
              </span>
            )}
          </div>
        </>
      )}

      {result && (
        <ResultLinks
          summary={`LD ${result.resumo.disciplina} · ${result.resumo.codigo} · rev ${result.resumo.revisao} · ${result.resumo.totalFolhas} folhas${
            result.warnings.length ? ` · ${result.warnings.length} aviso(s)` : ""
          }`}
          files={[
            { label: "ODT", url: result.odtUrl, name: result.odtName },
            ...(result.pdfUrl
              ? [{ label: "PDF", url: result.pdfUrl, name: result.pdfName! }]
              : []),
          ]}
        />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/** Prévia das folhas que vão para a LD — o engenheiro confere antes de gerar. */
function FolhaPreview({ data }: { data: LdPreviewData }) {
  const faltando =
    data.referenceTotal != null && data.totalFolhas < data.referenceTotal;
  return (
    <div className="rounded-md border border-border bg-[var(--nexodoc-recessed)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className={LABEL_CLASS}>
          Folhas na LD ({data.totalFolhas}
          {data.referenceTotal != null ? ` de ${data.referenceTotal}` : ""})
        </span>
        {faltando && (
          <span className="font-mono text-[11px] text-[var(--status-warning)]">
            faltam folhas?
          </span>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={`${r.sheet}-${i}`} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-1 font-mono tabular-nums">
                  {r.sheet || "—"}
                </td>
                <td className="px-3 py-1 text-muted-foreground">{r.description || "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-muted-foreground">Nenhuma folha lida.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Capa ---- */

function CapaConfirmation({
  params,
  resumo,
  selos,
  templates,
}: {
  params: NexoCapaProposalParams;
  resumo: string;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CapaGenResult | null>(null);
  const { addArtifact } = useArtifactStore();

  const template = templates.find((t) => t.id === params.templateId);
  const prefeituraNome = template
    ? (template.grupo ?? template.nome) + (template.variante ? ` — ${template.variante}` : "")
    : params.templateId
      ? "carregando…"
      : "";
  const semPrefeitura = params.templateId.trim() === "";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await postCapa(selos, {
        templateId: params.templateId,
        volume: params.volume,
        numTomos: params.numTomos,
      });
      setResult(r);
      addArtifact({
        id: `capa:${r.resumo.codigo}:${r.resumo.volume}`,
        kind: "capa",
        label: `Capa ${r.resumo.prefeitura}`,
        detail: `${r.resumo.codigo} · vol ${r.resumo.volume}`,
        pdfUrl: r.pdfUrl,
        pageNumber: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a capa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="capa" resumo={resumo}>
      {!result && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Prefeitura"
              value={semPrefeitura ? "escolha a prefeitura →" : prefeituraNome}
              missing={semPrefeitura}
            />
            <SummaryRow label="Volume" value={params.volume.trim() || "auto (do arquivo)"} />
            <SummaryRow label="Tomos" value={String(params.numTomos)} />
            <SummaryRow label="Mês/ano" value="atual" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip
              label="prefeitura"
              highlight={semPrefeitura}
              phrase="A prefeitura é "
            />
            <AlterChip label="volume" phrase="É o volume " />
            <AlterChip label="tomos" phrase="Divide em 2 tomos" />
            <AlterChip label="mês" phrase="A capa é de " />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton busy={busy} disabled={semPrefeitura} onConfirm={confirm} />
            {semPrefeitura && (
              <span className="text-xs text-muted-foreground">
                A capa precisa da prefeitura — diga qual pela conversa.
              </span>
            )}
          </div>
        </>
      )}

      {result && (
        <ResultLinks
          summary={`Capa ${result.resumo.prefeitura} · ${result.resumo.codigo} · vol ${result.resumo.volume}${
            result.resumo.tomos > 1 ? ` · ${result.resumo.tomos} tomos` : ""
          }${result.pdfError ? " · PDF indisponível" : ""}`}
          files={[
            { label: "ZIP", url: result.zipUrl, name: result.zipName, primary: true },
            { label: "ODT", url: result.odtUrl, name: result.odtName },
            ...(result.pdfUrl
              ? [{ label: "PDF", url: result.pdfUrl, name: result.pdfName! }]
              : []),
          ]}
        />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/* ---------------------------------------------------------- Conferência ---- */

function ConferenciaConfirmation({
  resumo,
  selos,
}: {
  resumo: string;
  selos: SeloForLd[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LightCheckResult | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setResult(await postCheck(selos));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conferência.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="conferencia" resumo={resumo}>
      {!result && (
        <>
          <p className="text-xs text-muted-foreground">
            Confere se as pranchas batem entre si (código/obra/revisão/folhas). Sem memorial.
          </p>
          <ConfirmButton
            busy={busy}
            label="Conferir"
            busyLabel="Conferindo…"
            onConfirm={confirm}
          />
        </>
      )}

      {result && <CheckResult result={result} />}
      <CardError message={error} />
    </CardShell>
  );
}

function CheckResult({ result }: { result: LightCheckResult }) {
  const variant =
    result.veredito === "critico"
      ? "critical"
      : result.veredito === "aviso"
        ? "warning"
        : "ok";
  const label =
    result.veredito === "critico"
      ? "🔴 Não emitir"
      : result.veredito === "aviso"
        ? "🟡 Revisar"
        : "🟢 Consistente";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-muted-foreground">
          {result.findings.length} achado(s)
        </span>
      </div>
      {result.findings.length > 0 && (
        <ul className="space-y-1.5">
          {result.findings.map((f, i) => (
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
                <span className="block pl-2 text-muted-foreground">{f.detalhe}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Volume ----- */

/**
 * Monta o volume juntando as partes JÁ geradas nesta conversa (capa + LD do
 * artifact-store) com as pranchas originais retidas. Pré-condições honestas:
 * sem pranchas, botão desabilitado. Capa/LD ausentes (não geradas ou sem PDF)
 * simplesmente não entram — o card mostra o que será incluído.
 */
function VolumeConfirmation({
  resumo,
  selos,
  pranchaFiles,
}: {
  resumo: string;
  selos: SeloForLd[];
  pranchaFiles: File[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; pageCount?: number } | null>(null);
  const { artifacts, addArtifact } = useArtifactStore();

  const capa = artifacts.find((a) => a.kind === "capa");
  const ld = artifacts.find((a) => a.kind === "ld");
  const semPranchas = pranchaFiles.length === 0;
  // Disciplina p/ a separatriz (best-effort): do rótulo "LD <disciplina>".
  const sepTitle = ld?.label.replace(/^LD\s+/i, "").trim() ?? "";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const capaPdf64 = capa?.pdfUrl ? await urlToBase64(capa.pdfUrl) : null;
      const ldPdf64 = ld?.pdfUrl ? await urlToBase64(ld.pdfUrl) : null;
      const r = await assembleVolume({
        selos,
        pranchaFiles,
        capaPdf64,
        ldPdf64,
        separatrizTitle: sepTitle,
      });
      setResult(r);
      const codigo = summarizeSelos(selos).codigo ?? "volume";
      addArtifact({
        id: `volume:${codigo}`,
        kind: "volume",
        label: "Volume",
        detail: r.pageCount != null ? `${r.pageCount} páginas` : undefined,
        pdfUrl: r.url,
        pageNumber: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar o volume.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="volume" resumo={resumo}>
      {!result && (
        <>
          <div className="space-y-1.5">
            <PartRow label="Capa" ok={Boolean(capa?.pdfUrl)} />
            <PartRow label="LD" ok={Boolean(ld?.pdfUrl)} />
            <PartRow
              label="Pranchas"
              ok={!semPranchas}
              detail={semPranchas ? "nenhuma" : `${pranchaFiles.length} arquivo(s)`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Junta as partes num PDF único (ordem: capa · LD · folhas). As partes
            sem PDF ficam de fora.
          </p>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={semPranchas}
              label="Montar volume"
              busyLabel="Montando…"
              onConfirm={confirm}
            />
            {semPranchas && (
              <span className="text-xs text-muted-foreground">
                Anexe as pranchas para montar o volume.
              </span>
            )}
          </div>
        </>
      )}

      {result && (
        <ResultLinks
          summary={`Volume montado${result.pageCount != null ? ` · ${result.pageCount} páginas` : ""}`}
          files={[{ label: "PDF do volume", url: result.url, name: result.name, primary: true }]}
        />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/** Uma linha de "parte presente" do volume (capa/LD/pranchas). */
function PartRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${LABEL_CLASS} w-24 shrink-0`}>{label}</span>
      <span
        className={
          ok
            ? "font-mono text-sm text-foreground"
            : "font-mono text-sm italic text-muted-foreground"
        }
      >
        {ok ? `✓ ${detail ?? "pronta"}` : `— ${detail ?? "sem PDF"}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ Auditoria ----- */

/**
 * Auditoria do memorial (caso raro) — reusa o motor completo `/api/audit` com
 * gabarito automático (obra dos selos + prefeitura da capa gerada, se houver).
 * Precisa do memorial anexado (o composer o separa das pranchas por tipo do nome).
 */
function AuditoriaConfirmation({
  resumo,
  params,
  selos,
  memorialFile,
}: {
  resumo: string;
  params: NexoAuditoriaProposalParams;
  selos: SeloForLd[];
  memorialFile: File | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditReport | null>(null);
  const { artifacts } = useArtifactStore();

  const obra = summarizeSelos(selos).obra ?? undefined;
  // Prefeitura best-effort: do rótulo "Capa <prefeitura>" do artefato de capa.
  const prefeitura = artifacts
    .find((a) => a.kind === "capa")
    ?.label.replace(/^Capa\s+/i, "")
    .trim();

  async function confirm() {
    if (!memorialFile) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postAudit(memorialFile, { obra, prefeitura }, params.nivel);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na auditoria do memorial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="auditoria" resumo={resumo}>
      {!result && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Memorial"
              value={memorialFile ? memorialFile.name : "arraste o PDF do memorial →"}
              missing={!memorialFile}
            />
            <SummaryRow label="Obra (gabarito)" value={obra ?? "?"} />
            <SummaryRow label="Nível" value={params.nivel === "deep" ? "profunda" : "padrão"} />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={!memorialFile}
              label="Auditar"
              busyLabel="Auditando…"
              onConfirm={confirm}
            />
            {!memorialFile && (
              <span className="text-xs text-muted-foreground">
                Anexe o memorial (o Nexo o separa das pranchas).
              </span>
            )}
          </div>
        </>
      )}

      {result && <AuditResult report={result} />}
      <CardError message={error} />
    </CardShell>
  );
}

function AuditResult({ report }: { report: AuditReport }) {
  const variant =
    report.status_geral === "sem achados críticos"
      ? "ok"
      : report.status_geral === "com pontos de revisão"
        ? "warning"
        : "critical";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant}>{report.status_geral}</Badge>
        <span className="text-xs text-muted-foreground">
          {report.total_incongruencias} achado(s) · obra {report.obra || "?"}
        </span>
      </div>
      {report.conclusao && (
        <p className="text-sm text-muted-foreground">{report.conclusao}</p>
      )}
      {report.incongruencias.length > 0 && (
        <ul className="space-y-1.5">
          {report.incongruencias.slice(0, 8).map((f) => (
            <li key={f.id} className="text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                [{f.prioridade}]
              </span>{" "}
              {f.descricao}
            </li>
          ))}
          {report.incongruencias.length > 8 && (
            <li className="text-xs text-muted-foreground">
              +{report.incongruencias.length - 8} outro(s). Relatório completo no
              módulo Auditoria.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------- Separatriz ------- */

/**
 * A separatriz vive dentro do fluxo de volume (é montada como parte dele) — não
 * tem geração avulsa no chat. Read-only, honesto quanto ao próximo passo.
 */
function DeferredConfirmation({
  kind,
  resumo,
}: {
  kind: "separatriz";
  resumo: string;
}) {
  return (
    <CardShell kind={kind} resumo={resumo}>
      <p className="text-xs text-muted-foreground">
        A separatriz é montada dentro do fluxo do volume — peça “montar volume”.
      </p>
      <Button size="sm" disabled>
        <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Confirmar e gerar
      </Button>
    </CardShell>
  );
}

/* ------------------------------------------------------------- Downloads ---- */

function ResultLinks({
  summary,
  files,
}: {
  summary: string;
  files: { label: string; url: string; name: string; primary?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <p className="text-sm">{summary}</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <Button key={f.label} size="sm" variant={f.primary ? "default" : "outline"} asChild>
            <a href={f.url} download={f.name}>
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {f.label}
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
