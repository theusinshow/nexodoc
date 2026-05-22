"use client";

import {
  AlertTriangle,
  Clock3,
  FileText,
  KeyRound,
  ListChecks,
  RefreshCcw,
  Search,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuditListItem = {
  id: string;
  title: string;
  projectName: string;
  auditMode: string;
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

const TOKEN_STORAGE_KEY = "nexodoc-admin-token";

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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [userFilter, setUserFilter] = useState("");
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
            : "Nao foi possivel carregar auditorias.",
        );
      }

      sessionStorage.setItem(TOKEN_STORAGE_KEY, trimmedToken);
      setToken(trimmedToken);
      setAudits(payload.audits);
    } catch (requestError) {
      setAudits([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar auditorias.",
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
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    setToken(storedToken);

    if (storedToken) {
      void loadAudits(storedToken);
    }
    // Run only once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 py-5 text-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex items-end justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-primary">
              <ListChecks className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Histórico de auditorias</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Visão desktop para acompanhar auditorias persistidas, filtrar por
              projeto, status, modo e responsável.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-[460px] flex-col gap-2 rounded-lg border bg-card/80 p-3"
          >
            <label className="text-xs font-medium text-muted-foreground">
              Token admin
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="h-9 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder="NEXODOC_ADMIN_TOKEN"
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                <RefreshCcw />
                Atualizar
              </Button>
            </div>
          </form>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card/80 p-3">
            <p className="text-xs text-muted-foreground">Auditorias</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(audits.length)}</p>
          </div>
          <div className="rounded-lg border bg-card/80 p-3">
            <p className="text-xs text-muted-foreground">Concluídas</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(totals.completed)}</p>
          </div>
          <div className="rounded-lg border bg-card/80 p-3">
            <p className="text-xs text-muted-foreground">PDFs</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(totals.files)}</p>
          </div>
          <div className="rounded-lg border bg-card/80 p-3">
            <p className="text-xs text-muted-foreground">Achados</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(totals.findings)}</p>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-[1fr_170px_170px_220px_auto] gap-2 rounded-lg border bg-card/80 p-3"
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

        <section className="overflow-hidden rounded-lg border bg-card/80">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--nexodoc-recessed)] text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Auditoria</th>
                <th className="px-3 py-3 font-medium">Projeto</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Modo</th>
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
                  <tr key={audit.id} className="border-t align-top hover:bg-muted/30">
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate font-medium text-foreground">{audit.title}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {audit.files.map((file) => file.fileName).join(", ") || "-"}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      <p className="truncate">{audit.projectName}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                          getStatusClass(audit.status),
                        )}
                      >
                        {audit.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{audit.auditMode}</td>
                    <td className="px-3 py-3 text-right">{audit.files.length}</td>
                    <td className="px-3 py-3 text-right">{audit.totalFindings}</td>
                    <td className="px-3 py-3 text-right">{formatDuration(audit.elapsedMs)}</td>
                    <td className="max-w-[220px] px-3 py-3">
                      <p className="truncate">{audit.user?.email ?? "não vinculado"}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {formatDate(audit.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-muted-foreground"
                    colSpan={9}
                  >
                    Nenhuma auditoria encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
