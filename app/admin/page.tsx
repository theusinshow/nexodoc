"use client";

import {
  AlertTriangle,
  BarChart3,
  Clock3,
  FileSpreadsheet,
  KeyRound,
  ListChecks,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type OverviewResponse = {
  totals: {
    users: number;
    activeUsers: number;
    admins: number;
    audits: number;
    failedAudits: number;
    recentAudits: number;
    ldDrafts: number;
    generatedLds: number;
    recentLds: number;
    ldEvents: number;
  };
  latestAudits: Array<{
    id: string;
    title: string;
    projectName: string;
    status: string;
    auditMode: string;
    analysisLevel: string;
    createdAt: string;
    totalFindings: number;
  }>;
  latestLds: Array<{
    id: string;
    title: string;
    projectCode: string;
    workName: string;
    status: string;
    userEmail: string;
    uploadedFileCount: number;
    updatedAt: string;
  }>;
  generatedAt: string;
};

const TOKEN_STORAGE_KEY = "nexodoc-admin-token";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function isErrorPayload(payload: OverviewResponse | { error?: string }): payload is { error?: string } {
  return "error" in payload;
}

function AdminMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <article className="border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export default function AdminHomePage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const actions = useMemo(
    () => [
      { href: "/admin/users", label: "Usuários", detail: "Adicionar, promover e desativar acessos", icon: UsersRound },
      { href: "/admin/lds", label: "LDs", detail: "Histórico, status e operação de listas", icon: FileSpreadsheet },
      { href: "/admin/audits", label: "Auditorias", detail: "Histórico de conferências documentais", icon: ListChecks },
      { href: "/admin/usage", label: "Consumo", detail: "Tokens, custos e modelos OpenAI", icon: BarChart3 },
      { href: "/admin/config", label: "Configuração", detail: "Chaves, modelos e limites sem expor valores", icon: Settings2 },
    ],
    [],
  );

  async function loadOverview(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/overview", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });
      const payload = (await response.json().catch(() => null)) as OverviewResponse | { error?: string } | null;

      if (!payload) {
        throw new Error("Não foi possível carregar o painel admin.");
      }

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) ? payload.error ?? "Não foi possível carregar o painel admin." : "Não foi possível carregar o painel admin.");
      }

      sessionStorage.setItem(TOKEN_STORAGE_KEY, trimmedToken);
      setToken(trimmedToken);
      setData(payload);
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o painel admin.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadOverview();
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    if (storedToken) queueMicrotask(() => void loadOverview(storedToken));
    // Initial token restoration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-dvh bg-background px-5 py-5 text-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
              <ShieldCheck className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Centro de controle</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Operação do NexoDoc para piloto: usuários, histórico, LDs, consumo, qualidade e configuração.
            </p>
          </div>
          <form onSubmit={submit} className="flex w-[460px] flex-col gap-2 border border-border bg-card p-3">
            <label className="font-mono text-xs text-muted-foreground">Token admin</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="NEXODOC_ADMIN_TOKEN"
                  className="h-10 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm"
                />
              </div>
              <Button type="submit" disabled={loading}>
                <RefreshCcw />
                Atualizar
              </Button>
            </div>
          </form>
        </header>

        {error ? (
          <p className="flex gap-2 border border-destructive/30 bg-card p-3 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            {error}
          </p>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <AdminMetric label="Usuários ativos" value={data?.totals.activeUsers ?? 0} detail={`${data?.totals.admins ?? 0} admin(s)`} icon={UsersRound} />
          <AdminMetric label="Auditorias" value={data?.totals.audits ?? 0} detail={`${data?.totals.recentAudits ?? 0} nos últimos 7 dias`} icon={ListChecks} />
          <AdminMetric label="Falhas" value={data?.totals.failedAudits ?? 0} detail="Auditorias com erro" icon={AlertTriangle} />
          <AdminMetric label="LDs" value={data?.totals.ldDrafts ?? 0} detail={`${data?.totals.generatedLds ?? 0} gerada(s)`} icon={FileSpreadsheet} />
          <AdminMetric label="Eventos LD" value={data?.totals.ldEvents ?? 0} detail={`${data?.totals.recentLds ?? 0} LD(s) recentes`} icon={Clock3} />
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link key={action.href} href={action.href} className="group border border-border bg-card p-4 transition hover:border-primary">
                <Icon className="size-5 text-primary" />
                <p className="mt-4 font-semibold">{action.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{action.detail}</p>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Auditorias recentes</h2>
            </div>
            <div className="divide-y divide-border">
              {(data?.latestAudits ?? []).map((audit) => (
                <div key={audit.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{audit.title}</p>
                    <span className="font-mono text-xs text-muted-foreground">{audit.status}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {audit.projectName} · {audit.auditMode} · {audit.totalFindings} achado(s) · {formatDate(audit.createdAt)}
                  </p>
                </div>
              ))}
              {data && data.latestAudits.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma auditoria registrada.</p> : null}
            </div>
          </article>

          <article className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">LDs recentes</h2>
            </div>
            <div className="divide-y divide-border">
              {(data?.latestLds ?? []).map((ld) => (
                <div key={ld.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{ld.projectCode || ld.title}</p>
                    <span className="font-mono text-xs text-muted-foreground">{ld.status}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {ld.workName || "Obra não preenchida"} · {ld.uploadedFileCount} PDF(s) não armazenado(s) · {formatDate(ld.updatedAt)}
                  </p>
                </div>
              ))}
              {data && data.latestLds.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma LD registrada.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
