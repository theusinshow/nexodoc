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
  AdminError,
  TituloDaSecao,
} from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TUDO_EM_ORDEM, resumoDeAtencao } from "@/lib/atencao-do-admin";
import {
  normalizarMetas,
  validarMetas,
  type MetasDeQualidade,
} from "@/lib/meta-de-qualidade";
import {
  normalizarCotacao,
  procedenciaDaCotacao,
  validarCotacao,
  type CotacaoDeclarada,
} from "@/lib/cambio";

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
  /** A cotação que o `/admin/usage` usa para mostrar ≈ R$ (nasce aqui, §A.7). */
  cambio: {
    cotacao: CotacaoDeclarada;
    origem: "banco" | "ambiente" | "nenhuma";
    databaseConfigured: boolean;
  };
  /** As metas que o `/admin/quality` usa para julgar as taxas (§A.8). */
  metaQualidade: {
    metas: MetasDeQualidade;
    origem: "banco" | "ambiente" | "nenhuma";
    databaseConfigured: boolean;
  };
  secrets: Record<string, boolean>;
  secretFingerprints?: {
    openaiApiKey?: SecretFingerprint;
    openaiAdminKey?: SecretFingerprint;
  };
  generatedAt: string;
};

type AiProvider = "openai";

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

function getProviderLabel(_provider: AiProvider) {
  return "OpenAI";
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

/**
 * Quando o incidente aconteceu, em linguagem de quem esta olhando agora. A
 * memoria de incidentes e da INSTANCIA (reiniciar limpa), entao a idade e o
 * unico jeito de saber se a falha ainda diz respeito ao estado atual.
 */
function formatarQuando(iso: string) {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return "";
  const minutos = Math.floor((Date.now() - quando.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `ha ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `ha ${horas} h`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(quando);
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

export function CorpoDaConfiguracao() {
  /*
   * O token vem do trilho, nao desta tela -- ver [[components/admin/admin-token.tsx]].
   * Antes, cada uma das sete telas tinha o seu, e o campo de senha era a
   * primeira coisa que se via em todas elas.
   */
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [data, setData] = useState<AdminConfigResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [savingFlowId, setSavingFlowId] = useState("");
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [connectivityTest, setConnectivityTest] = useState<ConnectivityTestResult | null>(null);
  const [metaFp, setMetaFp] = useState("");
  const [metaCobertura, setMetaCobertura] = useState("");
  const [savingMetas, setSavingMetas] = useState(false);
  const [metasSalvas, setMetasSalvas] = useState(false);
  const [cambio, setCambio] = useState("");
  const [savingCambio, setSavingCambio] = useState(false);
  const [cambioSalvo, setCambioSalvo] = useState(false);
  const apiUrl = getApiUrl();
  const errosDoCambio = validarCotacao(normalizarCotacao({ valor: cambio }));
  const errosDasMetas = validarMetas(
    normalizarMetas({ falsoPositivoMax: metaFp, coberturaMin: metaCobertura }),
  );

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

      registrarResposta(true);
      setData(payload);
      // Cotação zerada é "não declarada": o campo fica VAZIO, e não "0".
      setCambio(payload.cambio?.cotacao.valor ? String(payload.cambio.cotacao.valor) : "");
      setCambioSalvo(false);
      setMetaFp(payload.metaQualidade?.metas.falsoPositivoMax ? String(payload.metaQualidade.metas.falsoPositivoMax) : "");
      setMetaCobertura(payload.metaQualidade?.metas.coberturaMin ? String(payload.metaQualidade.metas.coberturaMin) : "");
      setMetasSalvas(false);
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

  async function salvarMetasNoAdmin() {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setSavingMetas(true);
    setMetasSalvas(false);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "metas",
          metas: { falsoPositivoMax: metaFp, coberturaMin: metaCobertura },
        }),
        cache: "no-store",
      });
      const payload = (await response.json()) as ConfigPatchResponse | { error?: string };

      if (!response.ok || isPatchErrorPayload(payload)) {
        throw new Error(
          isPatchErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível salvar as metas.",
        );
      }

      setData(payload.config);
      setMetasSalvas(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Não foi possível salvar as metas.",
      );
    } finally {
      setSavingMetas(false);
    }
  }

  async function salvarCotacaoNoAdmin() {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setSavingCambio(true);
    setCambioSalvo(false);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "cambio", cambio }),
        cache: "no-store",
      });
      const payload = (await response.json()) as ConfigPatchResponse | { error?: string };

      if (!response.ok || isPatchErrorPayload(payload)) {
        throw new Error(
          isPatchErrorPayload(payload) && payload.error
            ? payload.error
            : "Não foi possível salvar a cotação.",
        );
      }

      setData(payload.config);
      setCambio(
        payload.config.cambio?.cotacao.valor ? String(payload.config.cambio.cotacao.valor) : "",
      );
      setCambioSalvo(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Não foi possível salvar a cotação.",
      );
    } finally {
      setSavingCambio(false);
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
    if (!restaurado || !token.trim()) return;
    /*
     * `queueMicrotask` porque a carga chama `setState` no corpo dela, e o
     * React Compiler barra `setState` sincrono dentro de efeito. E o mesmo
     * contorno que este arquivo ja usava na restauracao do token.
     */
    queueMicrotask(() => void loadConfig(token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurado, recarga]);

  return (
    <section className="flex flex-col gap-4">
      <TituloDaSecao
        icon={Settings2}
        titulo="Configuração do motor"
        descricao="Modelos por fluxo, provedores, metas e chaves. Leitura operacional, sem expor credenciais."
      />

        <AdminError message={error} />


        <section className="nx-edge-8 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Editor de modelos por fluxo</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Salva somente nomes de modelos no banco. Chaves continuam protegidas no ambiente do backend.
              </p>
            </div>
            <Badge variant={data?.modelSettings.databaseConfigured ? "ok" : "warning"}>
              {data?.modelSettings.databaseConfigured ? (
                <CheckCircle2 aria-hidden />
              ) : (
                <AlertTriangle aria-hidden />
              )}
              {data?.modelSettings.databaseConfigured ? "persistência ativa" : "sem DATABASE_URL"}
            </Badge>
          </div>

          <datalist id="nexodoc-ai-model-options">
            {data?.modelSettings.options.map((model) => <option key={model} value={model} />)}
          </datalist>

          <div className="mt-4 nx-edge-8">
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
                  <Badge variant="ok">{getProviderLabel(flow.provider)}</Badge>
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
                    className="nx-edge-7 min-h-9 w-full bg-transparent px-3 py-1 font-mono text-xs outline-none [--nx-fill:var(--nexodoc-recessed)]"
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

        <section className="nx-edge-8 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Painel de provedores IA</h2>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Provedor ativo, modelo, chave e última falha conhecida por fluxo. Não executa chamadas externas ao carregar.
              </p>
              {/*
                As duas linhas de procedência vieram da seção "Últimos
                incidentes", que foi removida por duplicar esta tabela. Elas não
                eram redundantes — dizem de onde vem o status e por quanto tempo
                ele dura — e sumir com elas junto teria sido trocar duplicata
                por perda.
              */}
              {data ? (
                <p className="mt-2 max-w-2xl font-mono text-[11px] text-muted-foreground">
                  {data.aiHealth.note} {data.aiHealth.statusStorage}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data?.runtime.primaryProvider ? (
                <Badge variant="ok">
                  <Activity aria-hidden />
                  principal: {getProviderLabel(data.runtime.primaryProvider)}
                </Badge>
              ) : null}
              <span className="font-mono text-xs text-muted-foreground">
                {connectivityTest
                  ? `conectividade: ${connectivityTest.ok ? "ok" : connectivityTest.category ?? "falha"}`
                  : "conectividade: não testada"}
              </span>
            </div>
          </div>
          <div className="mt-4 nx-edge-8">
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
                  <Badge variant="ok">{getProviderLabel(flow.provider)}</Badge>
                  <span className="break-all font-mono text-xs text-foreground">{flow.model || "--"}</span>
                  <Badge variant={isReady ? "ok" : "warning"}>
                    {isReady ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
                    {isReady ? "pronto" : flow.keyConfigured ? "atenção" : "sem chave"}
                  </Badge>
                  {/*
                    A ÚNICA FONTE DA ÚLTIMA FALHA.
                    Havia uma segunda, no fim da página ("Últimos incidentes de
                    provedor"), listando exatamente os mesmos `lastFailures`.
                    Duas listas do mesmo fato divergem no dia em que alguém
                    mexer numa só — e obrigam a ler a tela inteira para saber se
                    são o mesmo incidente ou dois. Ficou a que está ao lado do
                    fluxo, que é onde se age. A HORA veio junto: nenhuma das
                    duas a mostrava, e sem ela não dá para saber se o incidente
                    ainda importa.
                  */}
                  <div className="min-w-0">
                    {failure ? (
                      <>
                        <p className="font-mono text-xs text-[var(--status-warning)]">
                          {failure.category}
                          <span className="ml-1.5 text-muted-foreground">
                            {formatarQuando(failure.occurredAt)}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={failure.message}>
                          {failure.message}
                        </p>
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

        {/*
          A HIERARQUIA DA TELA: primeiro o que exige acao (provedores,
          modelos), depois o que se DECLARA uma vez e fica valendo (metas, cotacao),
          por ultimo a referencia (runtime, limites, chaves).

          As tres declaracoes estavam no topo porque foram acrescentadas nesta
          ordem, nao porque merecem a primeira dobra: quem abre esta tela quase
          sempre abre por causa de algo quebrado.
        */}

        <section className="nx-edge-8 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Metas de qualidade</h2>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                O painel de Quality mostra as taxas; sem meta declarada ele não as
                julga — e não inventa uma. Declarada aqui, ela vira a régua da
                série semanal: dentro fica verde, fora fica âmbar, e o que não tem
                meta continua sem cor.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 nx-cut-6 bg-[var(--signal-info-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--signal-info)]">
              {data && (data.metaQualidade.metas.falsoPositivoMax > 0 ||
                data.metaQualidade.metas.coberturaMin > 0)
                ? "metas declaradas"
                : "meta não declarada — o painel não julga"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                Falso positivo, no máximo (%)
              </span>
              <input
                value={metaFp}
                placeholder="ex.: 10"
                inputMode="decimal"
                disabled={!data || savingMetas}
                onChange={(event) => {
                  setMetasSalvas(false);
                  setMetaFp(event.target.value);
                }}
                className="nx-edge-7 min-h-9 w-40 bg-transparent px-3 py-1 font-mono text-xs outline-none disabled:opacity-60 [--nx-fill:var(--nexodoc-recessed)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                Cobertura de revisão, no mínimo (%)
              </span>
              <input
                value={metaCobertura}
                placeholder="ex.: 40"
                inputMode="decimal"
                disabled={!data || savingMetas}
                onChange={(event) => {
                  setMetasSalvas(false);
                  setMetaCobertura(event.target.value);
                }}
                className="nx-edge-7 min-h-9 w-40 bg-transparent px-3 py-1 font-mono text-xs outline-none disabled:opacity-60 [--nx-fill:var(--nexodoc-recessed)]"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !data ||
                !data.metaQualidade.databaseConfigured ||
                savingMetas ||
                errosDasMetas.length > 0
              }
              onClick={() => void salvarMetasNoAdmin()}
            >
              {savingMetas ? <Loader2 className="animate-spin" /> : <Save />}
              Declarar metas
            </Button>
            {!data ? (
              <span className="text-xs text-muted-foreground">
                Informe o token admin para declarar.
              </span>
            ) : !data.metaQualidade.databaseConfigured ? (
              <span className="font-mono text-[11px] text-[var(--status-warning)]">
                sem DATABASE_URL — só leitura do que veio do ambiente
              </span>
            ) : metasSalvas ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--status-ok)]">
                <CheckCircle2 className="size-3.5" /> declaradas agora
              </span>
            ) : null}
          </div>

          {errosDasMetas.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {errosDasMetas.map((erro) => (
                <li key={erro} className="font-mono text-[11px] text-[var(--status-warning)]">
                  {erro}
                </li>
              ))}
            </ul>
          ) : null}
        </section>



        <section className="nx-edge-8 p-4">
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
              /*
                Fundo TRANSLÚCIDO não compõe em duas formas: o miolo pintaria
                sobre a cor da borda. Caixa de alerta fica com `.nx-cut-*` e uma
                forma só, sem borda — a regra do chanfro para badge e alerta.
              */
              className={`nx-cut-6 mt-4 px-3 py-3 text-sm ${
                connectivityTest.ok
                  ? "bg-[var(--status-ok-bg)]"
                  : "bg-[var(--status-warning-bg)]"
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

        {/*
          "Limites" SAIU DAQUI. Era uma tabela de leitura pura dos mesmos quatro
          números que agora são editáveis logo acima, em "Vazão e limites de
          leitura" — e uma tela que mostra o mesmo valor duas vezes, uma delas
          sem poder mexer, ensina a duvidar da que manda.
        */}
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="nx-edge-8 p-4">
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

          <article className="nx-edge-8 p-4">
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

    </section>
  );
}
