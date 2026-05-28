"use client";

import {
  Archive,
  ArrowLeft,
  CopyPlus,
  FileClock,
  FileText,
  FolderOpen,
  History,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DraftStatus = "DRAFT" | "GENERATED" | "ARCHIVED";

type DraftItem = {
  id: string;
  title: string;
  projectCode: string;
  workName: string;
  status: DraftStatus;
  activeStep: number;
  referenceTotal: number | null;
  uploadedFileNames: string[];
  uploadedFileCount: number;
  generatedFileNames: string[];
  eventCount: number;
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
};

type DraftEvent = {
  id: string;
  actorEmail: string;
  actorName: string | null;
  action: string;
  summary: string;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: DraftStatus) {
  if (status === "GENERATED") return "Gerada";
  if (status === "ARCHIVED") return "Arquivada";
  return "Rascunho";
}

function getStatusClass(status: DraftStatus) {
  if (status === "GENERATED") {
    return "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]";
  }

  if (status === "ARCHIVED") {
    return "border-border bg-muted text-muted-foreground";
  }

  return "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
}

export function LdHistoryWorkspace({ userName }: { userName: string }) {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [selected, setSelected] = useState<DraftItem | null>(null);
  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | DraftStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ includeArchived: "true", limit: "100" });

      if (query.trim()) params.set("q", query.trim());
      if (status !== "ALL") params.set("status", status);

      const response = await fetch(`/api/ld/drafts?${params}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { drafts?: DraftItem[]; error?: string }
        | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar as LDs.");

      setDrafts(payload?.drafts ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar as LDs.");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDrafts();
    });
  }, [loadDrafts]);

  const totals = useMemo(
    () => ({
      all: drafts.length,
      drafts: drafts.filter((draft) => draft.status === "DRAFT").length,
      generated: drafts.filter((draft) => draft.status === "GENERATED").length,
      archived: drafts.filter((draft) => draft.status === "ARCHIVED").length,
    }),
    [drafts],
  );

  async function openTimeline(draft: DraftItem) {
    setSelected(draft);
    setLoadingEvents(true);

    try {
      const response = await fetch(`/api/ld/drafts/${draft.id}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { draft?: { events?: DraftEvent[] }; error?: string }
        | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível abrir o histórico.");
      setEvents(payload?.draft?.events ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível abrir o histórico.");
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function duplicateDraft(draft: DraftItem) {
    setBusyId(draft.id);
    setError("");

    try {
      const response = await fetch(`/api/ld/drafts/${draft.id}/duplicate`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível duplicar a LD.");
      await loadDrafts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível duplicar a LD.");
    } finally {
      setBusyId("");
    }
  }

  async function archiveDraft(draft: DraftItem) {
    if (!window.confirm(`Arquivar "${draft.title}"?`)) return;

    setBusyId(draft.id);
    setError("");

    try {
      const response = await fetch(`/api/ld/drafts/${draft.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível arquivar a LD.");
      setSelected(null);
      setEvents([]);
      await loadDrafts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível arquivar a LD.");
    } finally {
      setBusyId("");
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDrafts();
  }

  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <Link href="/ld" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
              <ArrowLeft size={16} />
              Voltar à montagem
            </Link>
            <div className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">
              <History size={15} />
              Listas de documentos
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Histórico de LDs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Rascunhos e listas geradas por {userName}, com rastreabilidade de alterações.
            </p>
          </div>
          <Link
            href="/ld"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <FileText size={16} />
            Nova montagem
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Total", totals.all],
            ["Rascunhos", totals.drafts],
            ["Geradas", totals.generated],
            ["Arquivadas", totals.archived],
          ].map(([label, value]) => (
            <div key={String(label)} className="border border-border bg-card p-4">
              <p className="font-mono text-xs uppercase text-muted-foreground">{label}</p>
              <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <form onSubmit={submitSearch} className="flex flex-wrap gap-3 border border-border bg-card p-4">
          <label className="relative min-w-[250px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código ou nome da obra"
              className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | DraftStatus)}
            className="h-11 min-w-44 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="ALL">Todos os status</option>
            <option value="DRAFT">Rascunhos</option>
            <option value="GENERATED">Geradas</option>
            <option value="ARCHIVED">Arquivadas</option>
          </select>
          <button type="submit" className="h-11 rounded-md border border-border px-4 text-sm font-medium transition hover:bg-muted">
            Filtrar
          </button>
        </form>

        {error ? <p className="border border-destructive bg-card p-3 text-sm text-destructive">{error}</p> : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(520px,1fr)_410px]">
          <div className="overflow-hidden border border-border bg-card">
            <div className="border-b border-border px-4 py-3 font-mono text-xs uppercase text-muted-foreground">
              Registros encontrados
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={16} />
                Carregando histórico
              </div>
            ) : drafts.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma LD encontrada.</p>
            ) : (
              <div className="divide-y divide-border">
                {drafts.map((draft) => (
                  <article key={draft.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_auto]">
                    <button type="button" onClick={() => void openTimeline(draft)} className="min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{draft.projectCode || "Sem código"}</span>
                        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${getStatusClass(draft.status)}`}>
                          {getStatusLabel(draft.status)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">{draft.workName || "Obra não preenchida"}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Atualizada em {formatDate(draft.updatedAt)} · {draft.eventCount} evento(s) · {draft.uploadedFileCount || draft.uploadedFileNames.length} PDF(s) não armazenado(s)
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {draft.status !== "ARCHIVED" ? (
                        <Link
                          href={`/ld?draft=${encodeURIComponent(draft.id)}`}
                          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm transition hover:bg-muted"
                        >
                          <FolderOpen size={15} />
                          Continuar
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void duplicateDraft(draft)}
                        disabled={busyId === draft.id}
                        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm transition hover:bg-muted disabled:opacity-50"
                      >
                        <CopyPlus size={15} />
                        Duplicar
                      </button>
                      {draft.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          onClick={() => void archiveDraft(draft)}
                          disabled={busyId === draft.id}
                          aria-label={`Arquivar ${draft.title}`}
                          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                        >
                          <Archive size={15} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="h-fit border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
                <FileClock size={15} />
                Rastreabilidade
              </div>
              <p className="mt-2 text-sm font-medium">
                {selected?.title ?? "Selecione uma LD"}
              </p>
            </div>
            {loadingEvents ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 size={15} className="animate-spin" />
                Carregando eventos
              </p>
            ) : events.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {selected ? "Ainda não há eventos registrados." : "Clique em uma LD para consultar seu histórico."}
              </p>
            ) : (
              <ol className="max-h-[620px] space-y-0 overflow-auto p-4">
                {events.map((event) => (
                  <li key={event.id} className="relative border-l border-border pb-5 pl-5 last:pb-0">
                    <span className="absolute -left-[5px] top-1 size-2.5 rounded-full border border-primary bg-background" />
                    <p className="font-mono text-[11px] uppercase text-primary">{event.action}</p>
                    <p className="mt-1 text-sm">{event.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {event.actorName || event.actorEmail} · {formatDate(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
