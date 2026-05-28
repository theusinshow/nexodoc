"use client";

import {
  Clock3,
  FileText,
  ListChecks,
  RefreshCcw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ADMIN_TOKEN_STORAGE_KEY,
  AdminError,
  AdminMetricStrip,
  AdminPageHeader,
  AdminPageShell,
  AdminTokenForm,
} from "@/components/admin/admin-page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuditListItem = {
  id: string;
  title: string;
  projectName: string;
  auditMode: string;
  analysisLevel: string;
  status: string;
  totalFindings: number;
  elapsedMs: number | null;
  createdAt: string;
  completedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  files: Array<{
    id: string;
    fileName: string;
    documentType: string;
    pageCount: number | null;
    extractedCharCount: number | null;
    sizeBytes: number | null;
  }>;
};

type AuditsResponse = {
  audits: AuditListItem[];
  generatedAt: string;
};

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(ms: number | null) {
  if (!ms) {
    return "--";
  }

  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function isErrorPayload(
  payload: AuditsResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
}

function getStatusClass(status: string) {
  if (status === "COMPLETED") {
    return "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]";
  }

  if (status === "FAILED" || status === "CANCELED") {
    return "border-[var(--status-critical)]/30 bg-[var(--status-critical-bg)] text-[var(--status-critical)]";
  }

  return "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
}

export default function AdminAuditsPage() {
  const [token, setToken] = useState("");
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const apiUrl = getApiUrl();
  const totals = useMemo(() => {
    return audits.reduce(
      (acc, audit) => ({
        files: acc.files + audit.files.length,
        findings: acc.findings + audit.totalFindings,
        completed: acc.completed + (audit.status === "COMPLETED" ? 1 : 0),
      }),
      { files: 0, findings: 0, completed: 0 },
    );
  }, [audits]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === audits.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(audits.map((a) => a.id)));
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Excluir permanentemente ${selected.size} auditoria(s) selecionada(s)? Esta acao remove todos os arquivos e feedbacks vinculados.`)) return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/audits`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: [...selected] }),
      });

      const payload = (await response.json().catch(() => null)) as { deleted?: number; error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Erro ao excluir auditorias.");

      setAudits((prev) => prev.filter((a) => !selected.has(a.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir auditorias.");
    } finally {
      setDeleting(false);
    }
  }

  async function loadAudits(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: "100",
      });

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (status !== "all") {
        params.set("status", status);
      }

      if (mode !== "all") {
        params.set("mode", mode);
      }

      if (userFilter.trim()) {
        params.set("user", userFilter.trim());
      }

      const response = await fetch(`${apiUrl}/api/admin/audits?${params}`, {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as AuditsResponse | { error?: string };

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(
          isErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível carregar auditorias.",
        );
      }

      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmedToken);
      setToken(trimmedToken);
      setAudits(payload.audits);
      setSelected(new Set());
    } catch (requestError) {
      setAudits([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar auditorias.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAudits();
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";

    if (storedToken) {
      queueMicrotask(() => {
        setToken(storedToken);
        void loadAudits(storedToken);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPageShell>
      <AdminPageHeader
        icon={ListChecks}
        title="Histórico de auditorias"
        description="Acompanhe auditorias persistidas e filtre por projeto, status, modo e responsável."
        actions={
          <AdminTokenForm
            token={token}
            loading={isLoading}
            onTokenChange={setToken}
            onSubmit={handleSubmit}
          />
        }
      />

        <AdminError message={error} />

        <AdminMetricStrip
          metrics={[
            { label: "Auditorias", value: formatNumber(audits.length) },
            { label: "Concluídas", value: formatNumber(totals.completed) },
            { label: "PDFs", value: formatNumber(totals.files) },
            { label: "Achados", value: formatNumber(totals.findings) },
          ]}
        />

        <form
          onSubmit={handleSubmit}
          className="grid gap-2 border border-border bg-card p-3 lg:grid-cols-[1fr_170px_170px_220px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="Buscar projeto, título ou arquivo"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-md border bg-[var(--nexodoc-recessed)] px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">Todos status</option>
            <option value="COMPLETED">Concluídas</option>
            <option value="PROCESSING">Processando</option>
            <option value="FAILED">Falhas</option>
            <option value="CANCELED">Canceladas</option>
          </select>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="h-9 rounded-md border bg-[var(--nexodoc-recessed)] px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">Todos modos</option>
            <option value="memorial">Memorial</option>
            <option value="volume">Volume</option>
          </select>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="h-9 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="Usuário"
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            <RefreshCcw />
            Filtrar
          </Button>
        </form>

        {selected.size > 0 && (
          <div className="flex items-center justify-between border border-destructive/30 bg-destructive/8 px-4 py-3">
            <span className="text-sm text-destructive">{selected.size} auditoria(s) selecionada(s)</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {deleting ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </div>
        )}

        <section className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={audits.length > 0 && selected.size === audits.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 accent-primary"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Auditoria</th>
                <th className="px-3 py-3 font-medium">Projeto</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Modo</th>
                <th className="px-3 py-3 font-medium">Nível</th>
                <th className="px-3 py-3 text-right font-medium">PDFs</th>
                <th className="px-3 py-3 text-right font-medium">Achados</th>
                <th className="px-3 py-3 text-right font-medium">Tempo</th>
                <th className="px-3 py-3 font-medium">Usuário</th>
                <th className="px-3 py-3 font-medium">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {audits.length > 0 ? (
                audits.map((audit) => (
                  <tr key={audit.id} className={cn("border-t align-top", selected.has(audit.id) ? "bg-primary/5" : "hover:bg-muted/30")}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(audit.id)}
                        onChange={() => toggleSelect(audit.id)}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate font-medium text-foreground">{audit.title}</p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {audit.files.map((file) => file.fileName).join(", ") || "-"}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      <p className="truncate">{audit.projectName}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-1 font-mono text-xs font-medium",
                          getStatusClass(audit.status),
                        )}
                      >
                        {audit.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-muted-foreground">{audit.auditMode}</td>
                    <td className="px-3 py-3 font-mono text-muted-foreground">
                      {audit.analysisLevel === "deep" ? "Profundo" : "Padrão"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{audit.files.length}</td>
                    <td className="px-3 py-3 text-right font-mono">{audit.totalFindings}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatDuration(audit.elapsedMs)}</td>
                    <td className="max-w-[220px] px-3 py-3">
                      <p className="truncate">{audit.user?.email ?? "não vinculado"}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-muted-foreground">
                      {formatDate(audit.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-muted-foreground"
                    colSpan={11}
                  >
                    Nenhuma auditoria encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
    </AdminPageShell>
  );
}
