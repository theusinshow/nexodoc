"use client";

import { AlertTriangle, Clock3, FileText, KeyRound, ListChecks, RefreshCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

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

function isErrorPayload(
  payload: AuditsResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
}

export default function AdminAuditsPage() {
  const [token, setToken] = useState("");
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = getApiUrl();

  async function loadAudits(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/audits?limit=50`, {
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
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-primary">
              <ListChecks className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Histórico de auditorias</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Auditorias persistidas no banco. Quando usuarios forem vinculados,
              esta lista passa a mostrar o responsavel por cada análise.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 md:w-[420px]"
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

        <section className="grid gap-3">
          {audits.length > 0 ? (
            audits.map((audit) => (
              <article key={audit.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{audit.title}</h2>
                      <span className="rounded-md border bg-[var(--nexodoc-recessed)] px-2 py-1 text-xs text-muted-foreground">
                        {audit.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {audit.projectName} · {audit.auditMode}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs md:w-[340px]">
                    <div className="rounded-md border bg-[var(--nexodoc-recessed)] p-2">
                      <FileText className="mb-1 size-4 text-primary" />
                      {audit.files.length} PDF(s)
                    </div>
                    <div className="rounded-md border bg-[var(--nexodoc-recessed)] p-2">
                      <ListChecks className="mb-1 size-4 text-primary" />
                      {audit.totalFindings} achado(s)
                    </div>
                    <div className="rounded-md border bg-[var(--nexodoc-recessed)] p-2">
                      <Clock3 className="mb-1 size-4 text-primary" />
                      {formatDuration(audit.elapsedMs)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 border-t pt-3 text-xs text-muted-foreground md:grid-cols-3">
                  <p>Criada em {formatDate(audit.createdAt)}</p>
                  <p>Usuario: {audit.user?.email ?? "nao vinculado"}</p>
                  <p>
                    Arquivos:{" "}
                    {audit.files.map((file) => file.fileName).join(", ") || "-"}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhuma auditoria persistida ainda.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
