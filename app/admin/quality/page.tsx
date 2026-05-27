"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  KeyRound,
  RefreshCcw,
  ScanSearch,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type QualityBucket = {
  key: string;
  label: string;
  completedAudits: number;
  reviewedAudits: number;
  generatedFindings: number;
  confirmed: number;
  falsePositive: number;
  wrongSeverity: number;
  missingFinding: number;
  totalFeedback: number;
  confirmationRate: number | null;
  falsePositiveRate: number | null;
  reviewCoverage: number | null;
  averageDurationMs: number | null;
  averageFindings: number | null;
};

type QualityResponse = {
  overview: QualityBucket;
  levels: QualityBucket[];
  models: QualityBucket[];
  generatedAt: string;
};

const TOKEN_STORAGE_KEY = "nexodoc-admin-token";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "--" : `${value.toLocaleString("pt-BR")}%`;
}

function formatSeconds(value: number | null) {
  return value === null ? "--" : `${Math.max(1, Math.round(value / 1000))}s`;
}

function isErrorPayload(
  payload: QualityResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

function QualityTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: QualityBucket[];
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="border-b px-4 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-sm">
          <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Grupo</th>
              <th className="px-3 py-3 text-right font-medium">Análises</th>
              <th className="px-3 py-3 text-right font-medium">Rotuladas</th>
              <th className="px-3 py-3 text-right font-medium">Achados</th>
              <th className="px-3 py-3 text-right font-medium">Confirmação</th>
              <th className="px-3 py-3 text-right font-medium">Falso positivo</th>
              <th className="px-3 py-3 text-right font-medium">Gravidade</th>
              <th className="px-3 py-3 text-right font-medium">Perdidos</th>
              <th className="px-4 py-3 text-right font-medium">Tempo médio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t">
                <td className="px-4 py-3 font-mono font-medium">{row.label}</td>
                <td className="px-3 py-3 text-right font-mono">{formatNumber(row.completedAudits)}</td>
                <td className="px-3 py-3 text-right font-mono">{formatNumber(row.reviewedAudits)}</td>
                <td className="px-3 py-3 text-right font-mono">{formatNumber(row.generatedFindings)}</td>
                <td className="px-3 py-3 text-right font-mono text-[var(--status-ok)]">
                  {formatPercent(row.confirmationRate)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[var(--status-warning)]">
                  {formatNumber(row.falsePositive)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[var(--status-warning)]">
                  {formatNumber(row.wrongSeverity)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[var(--status-critical)]">
                  {formatNumber(row.missingFinding)}
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatSeconds(row.averageDurationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminQualityPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<QualityResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = getApiUrl();

  async function loadQuality(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/quality`, {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as QualityResponse | { error?: string };

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(
          isErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível carregar a qualidade.",
        );
      }

      sessionStorage.setItem(TOKEN_STORAGE_KEY, trimmedToken);
      setToken(trimmedToken);
      setData(payload);
    } catch (requestError) {
      setData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar a qualidade.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadQuality();
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";

    if (storedToken) {
      queueMicrotask(() => {
        setToken(storedToken);
        void loadQuality(storedToken);
      });
    }
    // Run only once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overview = data?.overview;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Painel de módulos
            </Link>
            <div className="mt-4 flex items-center gap-2 font-mono text-xs uppercase text-primary">
              <ShieldCheck className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Qualidade do motor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Compare níveis e modelos a partir dos achados revisados manualmente.
              Quanto mais auditorias rotuladas, mais confiável será a decisão de produto.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 rounded-md border bg-card p-3 lg:w-[460px]">
            <label className="font-mono text-xs font-medium text-muted-foreground">
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
                <RefreshCcw className={isLoading ? "animate-spin" : ""} />
                Atualizar
              </Button>
            </div>
          </form>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ScanSearch}
            label="Auditorias concluídas"
            value={overview ? formatNumber(overview.completedAudits) : "--"}
            detail={overview ? `${formatNumber(overview.reviewedAudits)} já têm revisão humana` : "Aguardando consulta"}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Confirmação"
            value={overview ? formatPercent(overview.confirmationRate) : "--"}
            detail={overview ? `${formatNumber(overview.confirmed)} achados confirmados` : "Com base nos achados rotulados"}
          />
          <MetricCard
            icon={XCircle}
            label="Falsos positivos"
            value={overview ? formatNumber(overview.falsePositive) : "--"}
            detail={overview ? `${formatPercent(overview.falsePositiveRate)} dos achados avaliados` : "Aguardando revisão"}
          />
          <MetricCard
            icon={Clock3}
            label="Erros perdidos"
            value={overview ? formatNumber(overview.missingFinding) : "--"}
            detail={overview ? `${formatPercent(overview.reviewCoverage)} das auditorias foram rotuladas` : "Indicador de cobertura"}
          />
        </section>

        {overview && overview.reviewedAudits < 10 ? (
          <div className="rounded-md border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning)]">
            Amostra inicial: revise pelo menos 10 auditorias de cada nível antes de decidir qual configuração vender como padrão.
          </div>
        ) : null}

        <QualityTable
          title="Comparação por nível"
          subtitle="Padrão deve ser rápido e confiável; Profundo precisa justificar maior custo com melhor cobertura."
          rows={data?.levels ?? []}
        />

        <QualityTable
          title="Comparação por modelo"
          subtitle="O modelo só vence quando reduz falhas reais em auditorias revisadas, não apenas quando produz mais achados."
          rows={data?.models ?? []}
        />
      </div>
    </main>
  );
}
