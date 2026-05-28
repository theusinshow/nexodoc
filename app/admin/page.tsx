"use client";

import {
  AlertTriangle,
  BarChart3,
  Clock3,
  FileSpreadsheet,
  ListChecks,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ADMIN_TOKEN_STORAGE_KEY,
  AdminError,
  AdminPageHeader,
  AdminPageShell,
  AdminTokenForm,
} from "@/components/admin/admin-page-shell";

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
  value: number | string;
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

      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmedToken);
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
    const storedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    if (storedToken) queueMicrotask(() => void loadOverview(storedToken));
    // Initial token restoration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPageShell>
      <AdminPageHeader
        icon={ShieldCheck}
        title="Centro de controle"
        description="Operação do NexoDoc para piloto: usuários, histórico, LDs, consumo, qualidade e configuração."
        actions={
          <AdminTokenForm
            token={token}
            loading={loading}
            onTokenChange={setToken}
            onSubmit={submit}
          />
        }
      />

        <AdminError message={error} />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <AdminMetric label="Usuários ativos" value={loading ? "--" : (data?.totals.activeUsers ?? 0)} detail={`${data?.totals.admins ?? 0} admin(s)`} icon={UsersRound} />
          <AdminMetric label="Auditorias" value={loading ? "--" : (data?.totals.audits ?? 0)} detail={`${data?.totals.recentAudits ?? 0} nos últimos 7 dias`} icon={ListChecks} />
          <AdminMetric label="Falhas" value={loading ? "--" : (data?.totals.failedAudits ?? 0)} detail="Auditorias com erro" icon={AlertTriangle} />
          <AdminMetric label="LDs" value={loading ? "--" : (data?.totals.ldDrafts ?? 0)} detail={`${data?.totals.generatedLds ?? 0} gerada(s)`} icon={FileSpreadsheet} />
          <AdminMetric label="Eventos LD" value={loading ? "--" : (data?.totals.ldEvents ?? 0)} detail={`${data?.totals.recentLds ?? 0} LD(s) recentes`} icon={Clock3} />
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
    </AdminPageShell>
  );
}
