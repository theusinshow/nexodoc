"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Coins,
  KeyRound,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminUsageResponse = {
  range: {
    days: number;
    startTime: number;
    endTime: number;
  };
  usage: {
    totals: {
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      requests: number;
    };
    daily: Array<{
      date: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      requests: number;
    }>;
    models: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      requests: number;
    }>;
  };
  costs: {
    total: {
      amount: number;
      currency: string;
    };
    daily: Array<{
      date: string;
      amount: number;
      currency: string;
    }>;
    lineItems: Array<{
      lineItem: string;
      amount: number;
      currency: string;
    }>;
  };
  generatedAt: string;
};

const TOKEN_STORAGE_KEY = "nexodoc-admin-token";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00`));
}

function getMaxDailyValue(data: AdminUsageResponse | null) {
  if (!data) {
    return 1;
  }

  return Math.max(
    1,
    ...data.costs.daily.map((day) => day.amount),
    ...data.usage.daily.map((day) => day.inputTokens + day.outputTokens),
  );
}

function isErrorPayload(
  payload: AdminUsageResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border bg-card px-4 py-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="flex size-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export default function AdminUsagePage() {
  const [token, setToken] = useState("");
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AdminUsageResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = getApiUrl();
  const maxDailyValue = getMaxDailyValue(data);
  const totalTokens = useMemo(() => {
    if (!data) {
      return 0;
    }

    return data.usage.totals.inputTokens + data.usage.totals.outputTokens;
  }, [data]);

  async function loadUsage(nextToken = token, nextDays = days) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/usage?days=${nextDays}`, {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | AdminUsageResponse
        | { error?: string };

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(
          isErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível carregar uso.",
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
          : "Não foi possível carregar uso.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadUsage();
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    if (storedToken) {
      queueMicrotask(() => {
        setToken(storedToken);
        void loadUsage(storedToken, days);
      });
    }
    // Run only once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
              <ShieldCheck className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Uso e custos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Painel operacional para acompanhar tokens, chamadas e gasto da
              conta OpenAI conectada ao NexoDoc.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 md:w-[460px]"
          >
            <label className="font-mono text-xs font-medium text-muted-foreground">
              Token admin
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="h-9 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder="NEXODOC_ADMIN_TOKEN"
                />
              </div>
              <select
                value={days}
                onChange={(event) => {
                  const nextDays = Number(event.target.value);
                  setDays(nextDays);

                  if (token.trim()) {
                    void loadUsage(token, nextDays);
                  }
                }}
                className="h-9 rounded-md border bg-[var(--nexodoc-recessed)] px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={30}>30 dias</option>
              </select>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCcw />
                )}
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Coins}
            label="Gasto"
            value={
              data
                ? formatCurrency(data.costs.total.amount, data.costs.total.currency)
                : "--"
            }
            detail={`Últimos ${days} dias`}
          />
          <MetricCard
            icon={Sigma}
            label="Tokens"
            value={data ? formatNumber(totalTokens) : "--"}
            detail={
              data
                ? `${formatNumber(data.usage.totals.inputTokens)} entrada / ${formatNumber(data.usage.totals.outputTokens)} saída`
                : "Aguardando consulta"
            }
          />
          <MetricCard
            icon={Activity}
            label="Requests"
            value={data ? formatNumber(data.usage.totals.requests) : "--"}
            detail="Chamadas de modelo registradas pela OpenAI"
          />
          <MetricCard
            icon={BarChart3}
            label="Cache"
            value={data ? formatNumber(data.usage.totals.cachedTokens) : "--"}
            detail="Tokens de entrada com cache"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-lg border bg-card p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Uso diario</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Barras azuis mostram tokens; linha de custo aparece em USD.
                </p>
              </div>
              {data ? (
                <span className="font-mono text-xs text-muted-foreground">
                  Atualizado {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid min-h-[260px] items-end gap-3 sm:grid-cols-7">
              {(data?.usage.daily ?? Array.from({ length: 7 })).map((day, index) => {
                const usageDay = day as AdminUsageResponse["usage"]["daily"][number] | undefined;
                const costDay = data?.costs.daily.find(
                  (item) => item.date === usageDay?.date,
                );
                const tokenValue = usageDay
                  ? usageDay.inputTokens + usageDay.outputTokens
                  : 0;
                const tokenHeight = `${Math.max(5, (tokenValue / maxDailyValue) * 100)}%`;

                return (
                  <div
                    key={usageDay?.date ?? index}
                    className="flex h-64 min-w-0 flex-col justify-end gap-2"
                  >
                    <div className="flex flex-1 items-end rounded-md border bg-[var(--nexodoc-recessed)] p-1">
                      <div
                        className={cn(
                          "w-full rounded-sm bg-primary/80 transition-[height]",
                          !usageDay && "opacity-20",
                        )}
                        style={{ height: tokenHeight }}
                        title={
                          usageDay
                            ? `${formatNumber(tokenValue)} tokens`
                            : "Sem dados"
                        }
                      />
                    </div>
                    <div className="text-center">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {usageDay ? formatDate(usageDay.date) : "--"}
                      </p>
                      <p className="truncate font-mono text-[11px] text-primary">
                        {costDay
                          ? formatCurrency(costDay.amount, costDay.currency)
                          : "--"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-lg border bg-card p-4 shadow-[var(--shadow-panel)]">
            <h2 className="text-sm font-semibold">Modelos</h2>
            <div className="mt-4 space-y-2">
              {data && data.usage.models.length > 0 ? (
                data.usage.models.map((model) => {
                  const modelTokens = model.inputTokens + model.outputTokens;

                  return (
                    <div
                      key={model.model}
                      className="rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-all font-mono text-sm font-medium">{model.model}</p>
                        <span className="rounded-md border bg-card px-2 py-1 font-mono text-xs text-muted-foreground">
                          {formatNumber(model.requests)}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {formatNumber(modelTokens)} tokens totais
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-3 text-sm text-muted-foreground">
                  Nenhum modelo retornado no periodo.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-panel)]">
          <h2 className="text-sm font-semibold">Itens de custo</h2>
          <div className="mt-4 overflow-hidden rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data && data.costs.lineItems.length > 0 ? (
                  data.costs.lineItems.map((item) => (
                    <tr key={item.lineItem} className="border-t">
                      <td className="px-3 py-3">{item.lineItem}</td>
                      <td className="px-3 py-3 text-right">
                        {formatCurrency(item.amount, item.currency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-muted-foreground"
                      colSpan={2}
                    >
                      Nenhum custo retornado no periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
