"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
  Settings2,
  Zap,
} from "lucide-react";
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
    primaryProvider?: AiProvider;
    model: string;
    allowedOrigins: string;
  };
  aiFlows: Array<{
    id: string;
    label: string;
    provider: AiProvider;
    model: string;
    keyConfigured: boolean;
    enabled?: boolean;
    placeholderOnly?: boolean;
    note?: string;
  }>;
  modelSettings: {
    databaseConfigured: boolean;
    options: string[];
    flows: Array<{
      flowId: string;
      label: string;
      provider: AiProvider;
      effectiveModel: string;
      overrideModel: string;
      hasOverride: boolean;
      updatedAt?: string;
      updatedBy?: string | null;
      notes: string;
    }>;
  };
  aiHealth: {
    externalConnectivityChecked: boolean;
    note: string;
    lastFailures: Array<{
      provider: AiProvider;
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
    deepseekApiKey?: SecretFingerprint;
    openaiAdminKey?: SecretFingerprint;
  };
  generatedAt: string;
};

type AiProvider = "openai" | "deepseek" | "mimo";

type SecretFingerprint = {
  configured: boolean;
  length: number;
  prefix: string;
  suffix: string;
};

type ConnectivityTestResult = {
  ok: boolean;
  provider: AiProvider;
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

type ConfigPatchResponse = {
  ok: boolean;
  config: AdminConfigResponse;
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

function getProviderLabel(provider: AiProvider) {
  if (provider === "deepseek") {
    return "DeepSeek";
  }

  if (provider === "mimo") {
    return "MiMo";
  }

  return "OpenAI";
}

function getProviderClass(provider: AiProvider) {
  if (provider === "deepseek") {
    return "border-primary/30 bg-primary/10 text-[var(--nexodoc-accent)]";
  }

  if (provider === "mimo") {
    return "border-[var(--nexodoc-tertiary)]/30 bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]";
  }

  return "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]";
}

function getFailureForFlow(
  failures: AdminConfigResponse["aiHealth"]["lastFailures"] | undefined,
  flowId: string,
  provider: AiProvider,
) {
  const runtimeFlow = flowId.startsWith("audit-")
    ? "audit"
    : flowId === "audit-chat"
      ? "audit-chat"
      : flowId === "ld-primary" || flowId === "ld-fallback"
        ? "ld-extraction"
        : flowId === "volume-analysis"
          ? "volume-analysis"
          : flowId === "volume-suggestion"
            ? "volume-suggestion"
            : flowId;

  return failures?.find((failure) => failure.flow === runtimeFlow && failure.provider === provider);
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

function isPatchErrorPayload(
  payload: ConfigPatchResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
}

export default function AdminConfigPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<AdminConfigResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [savingFlowId, setSavingFlowId] = useState("");
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
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
      setModelDrafts(
        Object.fromEntries(
          payload.modelSettings.flows.map((flow) => [
            flow.flowId,
            flow.overrideModel || flow.effectiveModel,
          ]),
        ),
      );
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

  async function testProviderConnectivity() {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setIsTestingProvider(true);
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
          : "Não foi possível testar o provedor ativo.",
      );
    } finally {
      setIsTestingProvider(false);
    }
  }

  async function saveModelOverride(flowId: string) {
    const trimmedToken = token.trim();
    const model = modelDrafts[flowId]?.trim() ?? "";

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    if (!model) {
      setError("Informe o modelo antes de salvar.");
      return;
    }

    setSavingFlowId(flowId);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save",
          flowId,
          model,
        }),
      });
      const payload = (await response.json()) as ConfigPatchResponse | { error?: string };

      if (!response.ok || isPatchErrorPayload(payload)) {
        throw new Error(
          isPatchErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível salvar o modelo.",
        );
      }

      setData(payload.config);
      setModelDrafts(
        Object.fromEntries(
          payload.config.modelSettings.flows.map((flow) => [
            flow.flowId,
            flow.overrideModel || flow.effectiveModel,
          ]),
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar o modelo.");
    } finally {
      setSavingFlowId("");
    }
  }

  async function resetModelOverride(flowId: string) {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setSavingFlowId(flowId);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reset",
          flowId,
        }),
      });
      const payload = (await response.json()) as ConfigPatchResponse | { error?: string };

      if (!response.ok || isPatchErrorPayload(payload)) {
        throw new Error(
          isPatchErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível restaurar o padrão.",
        );
      }

      setData(payload.config);
      setModelDrafts(
        Object.fromEntries(
          payload.config.modelSettings.flows.map((flow) => [
            flow.flowId,
            flow.overrideModel || flow.effectiveModel,
          ]),
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível restaurar o padrão.");
    } finally {
      setSavingFlowId("");
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
              <h2 className="text-sm font-semibold">Editor de modelos por fluxo</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Salva somente nomes de modelos no banco. Chaves continuam protegidas no ambiente do backend.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs ${
                data?.modelSettings.databaseConfigured
                  ? "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
                  : "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
              }`}
            >
              {data?.modelSettings.databaseConfigured ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
              {data?.modelSettings.databaseConfigured ? "persistência ativa" : "sem DATABASE_URL"}
            </span>
          </div>

          <datalist id="nexodoc-ai-model-options">
            {data?.modelSettings.options.map((model) => <option key={model} value={model} />)}
          </datalist>

          <div className="mt-4 overflow-hidden rounded-sm border">
            <div className="grid grid-cols-[1.2fr_0.65fr_1fr_1.2fr_0.8fr] border-b bg-[var(--nexodoc-recessed)] px-3 py-2 font-mono text-[11px] uppercase text-muted-foreground">
              <span>Fluxo</span>
              <span>Provider</span>
              <span>Efetivo</span>
              <span>Override</span>
              <span>Ações</span>
            </div>
            {data?.modelSettings.flows.map((flow) => {
              const draft = (modelDrafts[flow.flowId] ?? flow.overrideModel) || flow.effectiveModel;
              const isSaving = savingFlowId === flow.flowId;
              const changed = draft.trim() !== (flow.overrideModel || flow.effectiveModel);

              return (
                <div
                  key={flow.flowId}
                  className="grid grid-cols-[1.2fr_0.65fr_1fr_1.2fr_0.8fr] items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{flow.label}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {flow.hasOverride
                        ? `override salvo${flow.updatedAt ? ` em ${new Date(flow.updatedAt).toLocaleString("pt-BR")}` : ""}`
                        : "usando padrão/env"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-sm border px-2 py-1 font-mono text-[11px] font-medium uppercase ${getProviderClass(flow.provider)}`}
                  >
                    {getProviderLabel(flow.provider)}
                  </span>
                  <span className="break-all font-mono text-xs text-foreground">{flow.effectiveModel || "--"}</span>
                  <input
                    list="nexodoc-ai-model-options"
                    value={draft}
                    onChange={(event) =>
                      setModelDrafts((current) => ({
                        ...current,
                        [flow.flowId]: event.target.value,
                      }))
                    }
                    disabled={!data.modelSettings.databaseConfigured || isSaving}
                    className="min-h-9 w-full rounded-sm border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none transition focus:border-primary"
                    aria-label={`Modelo para ${flow.label}`}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!data.modelSettings.databaseConfigured || isSaving || (!changed && flow.hasOverride)}
                      onClick={() => saveModelOverride(flow.flowId)}
                      title="Salvar modelo"
                    >
                      {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!data.modelSettings.databaseConfigured || isSaving || !flow.hasOverride}
                      onClick={() => resetModelOverride(flow.flowId)}
                      title="Voltar ao padrão/env"
                    >
                      <RotateCcw />
                    </Button>
                  </div>
                </div>
              );
            })}
            {!data ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                Informe o token admin para editar modelos.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Painel de provedores IA</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Provedor ativo, modelo, chave e última falha conhecida por fluxo. Não executa chamadas externas ao carregar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data?.runtime.primaryProvider ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-medium ${getProviderClass(data.runtime.primaryProvider)}`}
                >
                  <Activity className="size-3.5" />
                  principal: {getProviderLabel(data.runtime.primaryProvider)}
                </span>
              ) : null}
              <span className="font-mono text-xs text-muted-foreground">
                {connectivityTest
                  ? `conectividade: ${connectivityTest.ok ? "ok" : connectivityTest.category ?? "falha"}`
                  : "conectividade: não testada"}
              </span>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-sm border">
            <div className="grid grid-cols-[1.4fr_0.75fr_1.15fr_0.85fr_1.3fr] border-b bg-[var(--nexodoc-recessed)] px-3 py-2 font-mono text-[11px] uppercase text-muted-foreground">
              <span>Fluxo</span>
              <span>Provider</span>
              <span>Modelo</span>
              <span>Status</span>
              <span>Última falha</span>
            </div>
            {data?.aiFlows.map((flow) => {
              const failure = getFailureForFlow(data.aiHealth.lastFailures, flow.id, flow.provider);
              const isReady = flow.keyConfigured && !flow.placeholderOnly;

              return (
                <div
                  key={flow.id}
                  className="grid grid-cols-[1.4fr_0.75fr_1.15fr_0.85fr_1.3fr] items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-medium text-foreground">{flow.label}</p>
                    {flow.note ? <p className="mt-1 text-xs text-muted-foreground">{flow.note}</p> : null}
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-sm border px-2 py-1 font-mono text-[11px] font-medium uppercase ${getProviderClass(flow.provider)}`}
                  >
                    {getProviderLabel(flow.provider)}
                  </span>
                  <span className="break-all font-mono text-xs text-foreground">{flow.model || "--"}</span>
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-sm border px-2 py-1 text-xs ${
                      isReady
                        ? "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
                        : "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                    }`}
                  >
                    {isReady ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    {isReady ? "pronto" : flow.keyConfigured ? "atenção" : "sem chave"}
                  </span>
                  <div className="min-w-0">
                    {failure ? (
                      <>
                        <p className="font-mono text-xs text-[var(--status-warning)]">{failure.category}</p>
                        <p className="truncate text-xs text-muted-foreground">{failure.message}</p>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">sem falhas registradas</span>
                    )}
                  </div>
                </div>
              );
            })}
            {!data ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                Informe o token admin para carregar os provedores.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Teste de conectividade do provider ativo</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Executa uma chamada mínima real apenas quando você clicar.
              </p>
            </div>
            <Button type="button" onClick={testProviderConnectivity} disabled={isTestingProvider}>
              {isTestingProvider ? <Loader2 className="animate-spin" /> : <Zap />}
              Testar provider
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
              <ConfigRow
                label="Provider principal"
                value={data?.runtime.primaryProvider ? getProviderLabel(data.runtime.primaryProvider) : "--"}
              />
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
              {data?.secretFingerprints?.deepseekApiKey ? (
                <ConfigRow
                  label="DEEPSEEK_API_KEY fingerprint"
                  value={formatFingerprint(data.secretFingerprints.deepseekApiKey)}
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
