"use client";

import { AlertTriangle, CheckCircle2, Loader2, Settings2, Zap } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import {
  ADMIN_TOKEN_STORAGE_KEY,
  AdminError,
  AdminPageHeader,
  AdminPageShell,
  AdminTokenForm,
} from "@/components/admin/admin-page-shell";
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
  secretFingerprints?: {
    openaiApiKey?: SecretFingerprint;
    openaiAdminKey?: SecretFingerprint;
  };
  generatedAt: string;
};

type SecretFingerprint = {
  configured: boolean;
  length: number;
  prefix: string;
  suffix: string;
};

type ConnectivityTestResult = {
  ok: boolean;
  provider: "openai";
  model: string;
  durationMs?: number;
  output?: string;
  category?: string;
  message?: string;
  rawStatus?: number;
  rawCode?: string;
  rawType?: string;
  rawName?: string;
  rawMessage?: string;
  keyFingerprint?: SecretFingerprint;
  testedAt: string;
};

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

function formatFingerprint(fingerprint?: SecretFingerprint) {
  if (!fingerprint?.configured) {
    return "ausente";
  }

  return `${fingerprint.prefix}...${fingerprint.suffix} (${fingerprint.length} chars)`;
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
  const [isTestingOpenAi, setIsTestingOpenAi] = useState(false);
  const [connectivityTest, setConnectivityTest] = useState<ConnectivityTestResult | null>(null);
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

      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmedToken);
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

  async function testOpenAiConnectivity() {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsTestingOpenAi(true);
    setConnectivityTest(null);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/config`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as ConnectivityTestResult | { error?: string };

      if ("error" in payload && payload.error) {
        throw new Error(payload.error);
      }

      setConnectivityTest(payload as ConnectivityTestResult);
      void loadConfig(trimmedToken);
    } catch (requestError) {
      setConnectivityTest(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível testar a OpenAI.",
      );
    } finally {
      setIsTestingOpenAi(false);
    }
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";

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
    <AdminPageShell maxWidth="max-w-5xl">
      <AdminPageHeader
        icon={Settings2}
        title="Configurações"
        description="Leitura operacional dos modelos e chaves backend-only, sem expor credenciais."
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

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Fluxos de IA</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Provedor e modelo efetivamente selecionados pelo backend.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {connectivityTest
                ? `conectividade: ${connectivityTest.ok ? "ok" : connectivityTest.category ?? "falha"}`
                : "conectividade: não testada (zero chamadas)"}
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

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Teste de conectividade OpenAI</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Executa uma chamada mínima real para validar credencial, modelo e billing.
              </p>
            </div>
            <Button type="button" onClick={testOpenAiConnectivity} disabled={isTestingOpenAi}>
              {isTestingOpenAi ? <Loader2 className="animate-spin" /> : <Zap />}
              Testar OpenAI
            </Button>
          </div>
          {connectivityTest ? (
            <div
              className={`mt-4 rounded-sm border px-3 py-3 text-sm ${
                connectivityTest.ok
                  ? "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)]"
                  : "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)]"
              }`}
            >
              <p className="font-mono font-medium">
                {connectivityTest.ok
                  ? `OK em ${connectivityTest.durationMs ?? "-"}ms`
                  : connectivityTest.message ?? "Falha no teste"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {connectivityTest.provider} · {connectivityTest.model} · {new Date(connectivityTest.testedAt).toLocaleString("pt-BR")}
              </p>
              {!connectivityTest.ok ? (
                <div className="mt-3 grid gap-1 border-t pt-3 font-mono text-xs text-muted-foreground">
                  <span>key: {formatFingerprint(connectivityTest.keyFingerprint)}</span>
                  <span>status: {connectivityTest.rawStatus ?? "-"}</span>
                  <span>code: {connectivityTest.rawCode ?? "-"}</span>
                  <span>type: {connectivityTest.rawType ?? "-"}</span>
                  <span>raw: {connectivityTest.rawMessage ?? "-"}</span>
                </div>
              ) : null}
            </div>
          ) : null}
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
              {data?.secretFingerprints?.openaiApiKey ? (
                <ConfigRow
                  label="OPENAI_API_KEY fingerprint"
                  value={formatFingerprint(data.secretFingerprints.openaiApiKey)}
                />
              ) : null}
              {data?.secretFingerprints?.openaiAdminKey ? (
                <ConfigRow
                  label="OPENAI_ADMIN_KEY fingerprint"
                  value={formatFingerprint(data.secretFingerprints.openaiAdminKey)}
                />
              ) : null}
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
    </AdminPageShell>
  );
}
