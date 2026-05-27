"use client";

import { AlertTriangle, FileSpreadsheet, KeyRound, RefreshCcw, Search, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LdRecord = {
  id: string;
  title: string;
  projectCode: string;
  workName: string;
  userEmail: string;
  userName: string | null;
  status: "DRAFT" | "GENERATED" | "ARCHIVED";
  activeStep: number;
  rowCount: number;
  tomoCount: number;
  eventCount: number;
  updatedAt: string;
  generatedAt: string | null;
};

const TOKEN_STORAGE_KEY = "nexodoc-admin-token";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusClass(status: LdRecord["status"]) {
  if (status === "GENERATED") return "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]";
  if (status === "ARCHIVED") return "border-border bg-muted text-muted-foreground";
  return "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
}

export default function AdminLdsPage() {
  const [token, setToken] = useState("");
  const [lds, setLds] = useState<LdRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const totals = useMemo(
    () => ({
      generated: lds.filter((ld) => ld.status === "GENERATED").length,
      rows: lds.reduce((sum, ld) => sum + ld.rowCount, 0),
      events: lds.reduce((sum, ld) => sum + ld.eventCount, 0),
    }),
    [lds],
  );

  async function loadLds(nextToken = token) {
    if (!nextToken.trim()) {
      setError("Informe o token admin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") params.set("status", status);
      if (user.trim()) params.set("user", user.trim());

      const response = await fetch(`/api/admin/lds?${params}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${nextToken.trim()}` },
      });
      const payload = (await response.json().catch(() => null)) as { lds?: LdRecord[]; error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar LDs.");
      sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken.trim());
      setToken(nextToken.trim());
      setLds(payload?.lds ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar LDs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    if (storedToken) queueMicrotask(() => void loadLds(storedToken));
    // Initial token restoration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLds();
  }

  return (
    <main className="min-h-dvh bg-background px-5 py-5 text-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
              <FileSpreadsheet className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Operação de LDs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe listas em montagem, geradas e arquivadas por usuário.
            </p>
          </div>
          <form onSubmit={submit} className="flex w-[460px] flex-col gap-2 border border-border bg-card p-3">
            <label className="font-mono text-xs text-muted-foreground">Token admin</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="NEXODOC_ADMIN_TOKEN" className="h-9 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm" />
              </div>
              <Button type="submit" disabled={loading}><RefreshCcw /> Atualizar</Button>
            </div>
          </form>
        </header>
        {error ? <p className="flex gap-2 border border-destructive/30 bg-card p-3 text-sm text-destructive"><AlertTriangle className="size-4" />{error}</p> : null}
        <section className="grid gap-3 sm:grid-cols-4">
          {[["LDs", lds.length], ["Geradas", totals.generated], ["Pranchas", totals.rows], ["Eventos", totals.events]].map(([label, value]) => (
            <div key={String(label)} className="border border-border bg-card p-3">
              <p className="font-mono text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>
        <form onSubmit={submit} className="grid gap-2 border border-border bg-card p-3 md:grid-cols-[1fr_180px_250px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código ou obra" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">Todos status</option><option value="DRAFT">Rascunho</option><option value="GENERATED">Gerada</option><option value="ARCHIVED">Arquivada</option>
          </select>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="Usuário" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
          </div>
          <Button type="submit" disabled={loading}>Filtrar</Button>
        </form>
        <section className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Projeto / obra</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Usuário</th>
                <th className="px-3 py-3 text-right">Pranchas</th><th className="px-3 py-3 text-right">Tomos</th><th className="px-3 py-3 text-right">Eventos</th><th className="px-3 py-3">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {lds.length ? lds.map((ld) => (
                <tr key={ld.id} className="border-t border-border hover:bg-muted/30">
                  <td className="max-w-[320px] px-3 py-3"><p className="font-mono font-semibold">{ld.projectCode || "-"}</p><p className="truncate text-muted-foreground">{ld.workName || "Obra não preenchida"}</p></td>
                  <td className="px-3 py-3"><span className={cn("border px-2 py-1 font-mono text-xs", statusClass(ld.status))}>{ld.status}</span></td>
                  <td className="max-w-[250px] px-3 py-3"><p className="truncate">{ld.userName || ld.userEmail}</p><p className="truncate text-xs text-muted-foreground">{ld.userEmail}</p></td>
                  <td className="px-3 py-3 text-right font-mono">{ld.rowCount}</td><td className="px-3 py-3 text-right font-mono">{ld.tomoCount}</td><td className="px-3 py-3 text-right font-mono">{ld.eventCount}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-muted-foreground">{formatDate(ld.updatedAt)}</td>
                </tr>
              )) : <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Nenhuma LD encontrada.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
