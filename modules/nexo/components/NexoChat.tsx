"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Send,
  Loader2,
  FileText,
  Download,
  Waypoints,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  NexoAgentProposal,
  NexoAgentTurn,
  NexoLdProposalParams,
  NexoCapaProposalParams,
} from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  postLd,
  postCapa,
  type LdGenResult,
  type CapaGenResult,
} from "../lib/generate";
import { MESES } from "@/modules/cover-generator/constants";

interface LdPreviewData {
  rows: { sheet: string; file: string; description: string }[];
  totalFolhas: number;
  referenceTotal: number | null;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposals?: NexoAgentProposal[];
  ldPreview?: LdPreviewData;
}

interface NexoTemplateOption {
  id: string;
  nome: string;
  grupo?: string;
  variante?: string;
}

const FIELD_CLASS =
  "flex w-full rounded-sm border border-input bg-[var(--nexodoc-recessed)] px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20";
const LABEL_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground";

/**
 * Chat do agente Nexo (Fase 2, motor = roteador de intenção). O usuário conversa;
 * o agente afirma os fatos dos selos e devolve PROPOSTAS (cards editáveis). A
 * geração — passo irreversível — só acontece ao clicar "Confirmar e gerar", que
 * chama a rota determinística. A IA nunca gera o documento.
 */
export function NexoChat({ selos }: { selos: SeloForLd[] }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NexoTemplateOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/capas/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/nexo/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, selos }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; turn?: NexoAgentTurn; ldPreview?: LdPreviewData }
        | null;
      if (!res.ok || !payload?.turn) {
        throw new Error(payload?.error ?? "Falha ao conversar com o Nexo.");
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.turn!.reply,
          proposals: payload.turn!.proposals,
          ldPreview: payload.ldPreview,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conversa.");
    } finally {
      setBusy(false);
    }
  }

  const semSelos = selos.length === 0;

  return (
    <div className="flex min-h-[280px] flex-col rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Conversa
          </span>
        </div>
        <Badge variant="warning">Beta</Badge>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            label="Converse com o Nexo"
            description={
              semSelos
                ? "Leia as pranchas acima e peça, por exemplo: “cria a LD e a capa dessas pranchas”."
                : "Selos lidos. Peça, por exemplo: “gera a LD e a capa da Prefeitura de Chapecó”."
            }
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className="space-y-2">
              <MessageBubble role={m.role} content={m.content} />
              {m.proposals?.map((p, i) => (
                <ProposalCard
                  key={`${m.id}-${i}`}
                  proposal={p}
                  selos={selos}
                  templates={templates}
                  ldPreview={m.ldPreview}
                />
              ))}
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Pensando…
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="border-t border-border px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] px-3 py-2 focus-within:border-ring">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={busy}
            placeholder="Ex.: cria a LD e a capa dessas pranchas..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            aria-label="Enviar"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-md rounded-br-sm bg-primary/10 px-3 py-2 text-sm"
            : "max-w-[85%] whitespace-pre-wrap rounded-md rounded-bl-sm bg-[var(--nexodoc-recessed)] px-3 py-2 text-sm"
        }
      >
        {content}
      </div>
    </div>
  );
}

/** Card de proposta: renderiza LD ou capa; campos editáveis inline; gera no clique. */
function ProposalCard({
  proposal,
  selos,
  templates,
  ldPreview,
}: {
  proposal: NexoAgentProposal;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
  ldPreview?: LdPreviewData;
}) {
  if (proposal.kind === "ld") {
    return (
      <LdCard
        resumo={proposal.resumo}
        params={proposal.params}
        selos={selos}
        ldPreview={ldPreview}
      />
    );
  }
  if (proposal.kind === "capa") {
    return (
      <CapaCard
        resumo={proposal.resumo}
        params={proposal.params}
        selos={selos}
        templates={templates}
      />
    );
  }
  // conferencia | volume | separatriz | auditoria: cards chegam no PR4
  // (o agente ainda não emite esses kinds). Não renderiza nada por ora.
  return null;
}

function CardShell({
  title,
  resumo,
  children,
}: {
  title: string;
  resumo: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Proposta · {title}
        </span>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-sm text-muted-foreground">{resumo}</p>
        {children}
      </div>
    </div>
  );
}

function LdCard({
  resumo,
  params,
  selos,
  ldPreview,
}: {
  resumo: string;
  params: NexoLdProposalParams;
  selos: SeloForLd[];
  ldPreview?: LdPreviewData;
}) {
  const [tituloLd, setTituloLd] = useState(params.tituloLd);
  const [numTomos, setNumTomos] = useState(params.numTomos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LdGenResult | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setResult(await postLd(selos, { tituloLd, numTomos }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a LD.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell title="LD" resumo={resumo}>
      {ldPreview && <FolhaPreview data={ldPreview} />}

      {!result && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className={LABEL_CLASS}>Título da LD (você define)</span>
            <input
              value={tituloLd}
              onChange={(e) => setTituloLd(e.target.value)}
              placeholder="ex.: PROJETO ESTRUTURAL - BLOCO B"
              className={FIELD_CLASS}
            />
          </label>
          <label className="block space-y-1">
            <span className={LABEL_CLASS}>Número de tomos</span>
            <NumTomosField value={numTomos} onChange={setNumTomos} />
          </label>
        </div>
      )}

      {result ? (
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
      ) : (
        <GenerateButton busy={busy} onConfirm={confirm} />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </CardShell>
  );
}

/** Pré-visualização das folhas que vão para a LD — deixa o engenheiro conferir
 *  (ex.: uma folha que não chegou) antes de gerar. */
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

/** Campo de número de tomos (divide as folhas em N; 1 = tomo único). */
function NumTomosField({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      max={99}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        onChange(Number.isFinite(n) && n >= 1 ? Math.min(99, n) : 1);
      }}
      className={`${FIELD_CLASS} w-24 tabular-nums`}
    />
  );
}

/** Botão único de geração (título/tomos já editáveis inline no card). */
function GenerateButton({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  return (
    <Button size="sm" onClick={onConfirm} disabled={busy}>
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="mr-1.5 h-3.5 w-3.5" />
      )}
      {busy ? "Gerando..." : "Confirmar e gerar"}
    </Button>
  );
}

function CapaCard({
  resumo,
  params,
  selos,
  templates,
}: {
  resumo: string;
  params: NexoCapaProposalParams;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
}) {
  const [templateId, setTemplateId] = useState(params.templateId);
  const [volume, setVolume] = useState(params.volume);
  const [numTomos, setNumTomos] = useState(params.numTomos);
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CapaGenResult | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setResult(await postCapa(selos, { templateId, volume, numTomos, mes, ano }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a capa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell title="Capa" resumo={resumo}>
      {!result && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className={LABEL_CLASS}>Prefeitura</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={FIELD_CLASS}
            >
              {templates.length === 0 && <option value="">Carregando...</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.grupo ?? t.nome) + (t.variante ? ` — ${t.variante}` : "")}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="block flex-1 space-y-1">
              <span className={LABEL_CLASS}>Volume</span>
              <input
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="auto"
                className={`${FIELD_CLASS} tabular-nums`}
              />
            </label>
            <label className="block flex-1 space-y-1">
              <span className={LABEL_CLASS}>Tomos</span>
              <NumTomosField value={numTomos} onChange={setNumTomos} />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="block flex-1 space-y-1">
              <span className={LABEL_CLASS}>Mês</span>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">atual</option>
                {MESES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1 space-y-1">
              <span className={LABEL_CLASS}>Ano</span>
              <input
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="atual"
                inputMode="numeric"
                className={`${FIELD_CLASS} tabular-nums`}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            A capa às vezes é de outro mês. Vazio = mês/ano atual.
          </p>
        </div>
      )}

      {result ? (
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
      ) : (
        <GenerateButton busy={busy || !templateId} onConfirm={confirm} />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </CardShell>
  );
}

// Row/Actions removidos: os cards mostram os campos editáveis inline (título
// sempre visível) e geram com GenerateButton.

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
          <Button
            key={f.label}
            size="sm"
            variant={f.primary ? "default" : "outline"}
            asChild
          >
            <a href={f.url} download={f.name}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {f.label}
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
