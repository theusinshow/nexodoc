"use client";

import { AlertTriangle, CheckCircle2, KeyRound, RefreshCcw, Settings2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type AdminConfigResponse = {
  runtime: {
    nodeEnv: string;
    mockMode: boolean;
    clientDemoAllowed: boolean;
    model: string;
    allowedOrigins: string;
  };
  aiFlows: Array<{
    id: string;
    label: string;
    provider: "openai" | "mimo";
    model: string;
    keyConfigured: boolean;
  }>;
  aiHealth: {
    externalConnectivityChecked: boolean;
    note: string;
    lastFailures: Array<{
      provider: "openai" | "mimo";
      flow: string;
      model: string;
      category: string;
      message: string;
      occurredAt: string;
    }>;
    statusStorage: string;
  };
  limits: Record<string, number>;
  secrets: Record<string, boolean>;
  generatedAt: string;
};

const TOKEN_STORAGE_KEY = "nexodoc-admin-token";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0">
      <span className="font-mono text-muted-foreground">{label}</span>
      <span className="font-mono text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function ConfigurationStatus({ configured }: { configured: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {configured ? (
        <CheckCircle2 className="size-4 text-[var(--status-ok)]" />
      ) : (
        <AlertTriangle className="size-4 text-[var(--status-warning)]" />
      )}
      {configured ? "chave configurada" : "chave ausente"}
    </span>
  );
}

function isErrorPayload(
  payload: AdminConfigResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
}

export default function AdminConfigPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<AdminConfigResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = getApiUrl();

  async function loadConfig(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/config`, {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | AdminConfigResponse
        | { error?: string };

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(
          isErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível carregar configurações.",
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
          : "Não foi possível carregar configurações.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadConfig();
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";

    if (storedToken) {
      queueMicrotask(() => {
        setToken(storedToken);
        void loadConfig(storedToken);
      });
    }
    // Run only once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
              <Settings2 className="size-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Configurações</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Leitura operacional dos modelos e chaves backend-only, sem expor credenciais.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-2 rounded-sm border bg-card p-3 md:w-[420px]"
          >
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
                <RefreshCcw />
                Atualizar
              </Button>
            </div>
          </form>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-sm border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Fluxos de IA</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Provedor e modelo efetivamente selecionados pelo backend.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              conectividade: não testada (zero chamadas)
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {data?.aiFlows.map((flow) => (
              <article key={flow.id} className="rounded-sm border bg-background p-3">
                <p className="text-xs text-muted-foreground">{flow.label}</p>
                <p className="mt-2 font-mono text-xs uppercase text-primary">{flow.provider}</p>
                <p className="mt-1 break-all font-mono text-sm font-medium">{flow.model}</p>
                <div className="mt-3 border-t pt-2">
                  <ConfigurationStatus configured={flow.keyConfigured} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-sm border bg-card p-4">
            <h2 className="text-sm font-semibold">Runtime</h2>
            <div className="mt-3">
              <ConfigRow label="Ambiente" value={data?.runtime.nodeEnv || "--"} />
              <ConfigRow label="Mock mode" value={data?.runtime.mockMode ? "ativo" : "inativo"} />
              <ConfigRow label="Demo pelo cliente" value={data?.runtime.clientDemoAllowed ? "permitida" : "bloqueada"} />
              <ConfigRow label="Modelo do chat" value={data?.runtime.model || "--"} />
              <ConfigRow label="Origins" value={data?.runtime.allowedOrigins || "--"} />
            </div>
          </article>

          <article className="rounded-sm border bg-card p-4">
            <h2 className="text-sm font-semibold">Limites</h2>
            <div className="mt-3">
              {data
                ? Object.entries(data.limits).map(([key, value]) => (
                    <ConfigRow key={key} label={key} value={value} />
                  ))
                : null}
            </div>
          </article>

          <article className="rounded-sm border bg-card p-4">
            <h2 className="text-sm font-semibold">Chaves</h2>
            <div className="mt-3">
              {data
                ? Object.entries(data.secrets).map(([key, value]) => (
                    <ConfigRow
                      key={key}
                      label={key}
                      value={
                        <span className="inline-flex items-center gap-1">
                          {value ? (
                            <CheckCircle2 className="size-4 text-[var(--status-ok)]" />
                          ) : (
                            <AlertTriangle className="size-4 text-[var(--status-warning)]" />
                          )}
                          {value ? "configurada" : "ausente"}
                        </span>
                      }
                    />
                  ))
                : null}
            </div>
          </article>
        </section>

        <section className="rounded-sm border bg-card p-4">
          <h2 className="text-sm font-semibold">Últimos incidentes de provedor</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.aiHealth.note ?? "Carregue a configuração para consultar os status."}
          </p>
          {data?.aiHealth.lastFailures.length ? (
            <div className="mt-4 grid gap-2">
              {data.aiHealth.lastFailures.map((failure) => (
                <div
                  key={`${failure.flow}-${failure.provider}`}
                  className="grid gap-2 rounded-sm border border-[var(--status-warning)]/30 bg-background p-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_2fr]"
                >
                  <span className="font-medium">{failure.flow}</span>
                  <span className="font-mono uppercase">{failure.provider}</span>
                  <span className="font-mono text-[var(--status-warning)]">{failure.category}</span>
                  <span className="text-muted-foreground">{failure.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-sm border bg-background px-3 py-4 text-sm text-muted-foreground">
              Nenhum erro de provedor registrado nesta instância.
            </p>
          )}
          {data ? (
            <p className="mt-3 text-xs text-muted-foreground">{data.aiHealth.statusStorage}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
