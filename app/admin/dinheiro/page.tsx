"use client";

import { Activity, BarChart3, Coins, Loader2, RefreshCcw, ShieldCheck, Sigma, Wallet } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AdminError,
  AdminMetricStrip,
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";
import { CorpoDosControles } from "@/components/admin/conteudo/controles";
import { TituloDaSecao } from "@/components/admin/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  COTACAO_NAO_DECLARADA,
  formatarReais,
  procedenciaDaCotacao,
  type CotacaoDeclarada,
} from "@/lib/cambio";
import type { CustoDaObra } from "@/lib/custo-por-obra";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { ESCALA_DE_DADO as escalaDeDado } from "@/modules/nexo/lib/escala-de-dado";

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
  /** A cotação declarada em `/admin/config`; ausente = tela em dólar. */
  cotacao?: CotacaoDeclarada;
  /**
   * Preenchido quando falta `OPENAI_ADMIN_KEY`: a fatura do provedor não vem,
   * mas o consumo interno e o custo por obra (que saem do banco) vêm.
   */
  semChaveDaOpenAi?: string;
  internalUsage?: {
    enabled: boolean;
    /** Consumo agrupado por obra (pasta da conversa). Ver `lib/custo-por-obra.ts`. */
    obras?: CustoDaObra[];
    /** O teto de eventos lidos, dito em voz alta quando bate. */
    amostra?: { eventos: number; limite: number; truncado: boolean };
    totals: {
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
      requests: number;
      unpricedRequests: number;
      unpricedTokens: number;
    };
    unpricedModels: string[];
    flows: Array<{
      flow: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
      requests: number;
      unpricedRequests: number;
    }>;
    tasks: Array<{
      taskId: string;
      taskLabel: string;
      flow: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
      requests: number;
      unpricedRequests: number;
    }>;
    recentEvents: Array<{
      id: string;
      createdAt: string;
      flow: string;
      taskLabel: string | null;
      provider: string;
      model: string;
      operation: string;
      status: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      totalTokens: number;
      estimatedCostUsd: number | null;
      durationMs: number | null;
      userEmail: string | null;
    }>;
  };
  generatedAt: string;
};

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

function formatUsd(value: number | null | undefined) {
  return formatCurrency(value ?? 0, "usd");
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


export default function AdminUsagePage() {
  /*
   * O token vem do trilho, nao desta tela -- ver [[components/admin/admin-token.tsx]].
   * Antes, cada uma das sete telas tinha o seu, e o campo de senha era a
   * primeira coisa que se via em todas elas.
   */
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AdminUsageResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = getApiUrl();
  const maxDailyValue = getMaxDailyValue(data);
  const cotacao = data?.cotacao ?? COTACAO_NAO_DECLARADA;
  const obras = data?.internalUsage?.obras ?? [];
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

      registrarResposta(true);
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
    if (!restaurado || !token.trim()) return;
    /*
     * `queueMicrotask` porque a carga chama `setState` no corpo dela, e o
     * React Compiler barra `setState` sincrono dentro de efeito. E o mesmo
     * contorno que este arquivo ja usava na restauracao do token.
     */
    queueMicrotask(() => void loadUsage(token, days));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurado, recarga, days]);

  return (
    <AdminPageShell maxWidth="max-w-6xl">
      <AdminPageHeader
        icon={ShieldCheck}
        title="Uso e custos"
        description="Painel operacional para acompanhar tokens, chamadas e gasto da conta OpenAI conectada ao Nexo."
        actions={
          /*
           * O SELETOR DE PERIODO FICA; o campo de token foi para o trilho.
           * Eles viviam no mesmo formulario -- o token era obrigatorio e o
           * periodo era passageiro dele --, e por isso o `AdminTokenForm`
           * precisava carregar `children`. Separados, o controle principal
           * desta tela ocupa o lugar que era do campo de senha.
           *
           * A troca de periodo nao busca a mao: o efeito de carga tem `days`
           * nas dependencias.
           */
          <Select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 w-[140px]"
            aria-label="Periodo"
          >
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
          </Select>
        }
      />

        <AdminError message={error} />

        {/*
          O TETO ABRE A TELA, e não fecha: o painel mostrava o gasto do mês sem
          mostrar contra o quê. Um número sem régua ao lado não é resposta para
          "posso rodar mais uma auditoria profunda hoje?".
        */}
        <section className="flex flex-col gap-4">
          <TituloDaSecao
            icon={Wallet}
            titulo="Teto de gasto"
            descricao="Barreira de entrada: mede o que já foi registrado, então não freia auditoria em voo. Vazio = sem teto."
          />
          <CorpoDosControles chaves={["teto.mensal.usd", "teto.global.usd"]} />
        </section>

        {/*
          A PROCEDÊNCIA DO REAL, acima de tudo que ele toca. Um número
          convertido sem dizer por qual cotação e de quando é exatamente o tipo
          de "quase certo" que este produto recusa em documento — não teria por
          que aceitar no próprio painel.
        */}
        {/*
          A falta da chave da OpenAI é AVISO, não erro: o que depende dela vem
          vazio, o que vem do banco continua na tela.
        */}
        {data?.semChaveDaOpenAi ? (
          <p className="rounded-sm border border-[var(--signal-info-border)] bg-[var(--signal-info-bg)] px-3 py-2 font-mono text-[11px] text-[var(--signal-info)]">
            {data.semChaveDaOpenAi}
          </p>
        ) : null}

        <p className="font-mono text-[11px] text-muted-foreground">
          {procedenciaDaCotacao(cotacao, new Date())}
          {" · "}
          <a href="/admin/motor" className="underline underline-offset-4 hover:text-foreground">
            declarar em Configurações
          </a>
        </p>

        {/*
          O REAL VEM COLADO NO DÓLAR, nunca no lugar dele: a fatura é em dólar e
          continua sendo o número auditável. Sem cotação declarada,
          `formatarReais` devolve "" e a linha volta a ser só o período — é
          assim que a tela evita inventar um real.
        */}
        <AdminMetricStrip
          columns="md:grid-cols-2 xl:grid-cols-4"
          metrics={[
            {
              label: "Gasto",
              icon: Coins,
              value: data ? formatCurrency(data.costs.total.amount, data.costs.total.currency) : "--",
              detail:
                data && formatarReais(data.costs.total.amount, cotacao)
                  ? `${formatarReais(data.costs.total.amount, cotacao)} · últimos ${days} dias`
                  : `Últimos ${days} dias`,
            },
            {
              label: "Tokens",
              icon: Sigma,
              value: data ? formatNumber(totalTokens) : "--",
              detail: data
                ? `${formatNumber(data.usage.totals.inputTokens)} entrada / ${formatNumber(data.usage.totals.outputTokens)} saída`
                : "Aguardando consulta",
            },
            {
              label: "Chamadas",
              icon: Activity,
              value: data ? formatNumber(data.usage.totals.requests) : "--",
              detail: "Chamadas de modelo registradas pela OpenAI",
            },
            {
              label: "Cache",
              icon: BarChart3,
              value: data ? formatNumber(data.usage.totals.cachedTokens) : "--",
              detail: "Tokens de entrada com cache",
            },
          ]}
        />

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-sm border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Uso diario</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada barra é um dia: a altura são os tokens. O custo aparece em USD.
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
                        /*
                          A BARRA SAI DO TEAL.
                          Era `bg-primary/80` — teal, que significa INTERATIVO
                          (§2, Regra do Acento Único). Barra de gráfico não se
                          clica. É a mesma violação que o anel de consumo tinha,
                          e a rampa `--data-*` existe exatamente para isto.

                          O rótulo dizia "barras azuis" enquanto elas eram teal:
                          o texto descrevia o que o desenho deveria ser. Agora
                          descreve o que ele é.
                        */
                        className={cn(
                          "nx-cut-4 w-full transition-[height]",
                          !usageDay && "opacity-20",
                        )}
                        style={{ height: tokenHeight, background: escalaDeDado[0] }}
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

          <article className="rounded-sm border bg-card p-4">
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

        <section className="rounded-sm border bg-card p-4">
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

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Custo por obra</h2>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                O mesmo consumo, cortado pela pergunta que o escritório faz:
                quanto custou entregar este projeto. A obra é a pasta da conversa;
                conversa fora de pasta conta como obra de uma conversa só.
              </p>
            </div>
            {data?.internalUsage?.amostra?.truncado ? (
              /*
                O TETO DITO EM VOZ ALTA. A leitura de eventos para em 500 desde
                antes desta tabela; uma tabela por obra montada sobre amostra sem
                avisar leria como o período inteiro — e alguém precificaria em
                cima dela.
              */
              <span className="rounded-sm border border-[var(--signal-info-border)] bg-[var(--signal-info-bg)] px-2 py-1 font-mono text-[11px] text-[var(--signal-info)]">
                amostra: os {data.internalUsage.amostra.limite} eventos mais recentes
              </span>
            ) : null}
          </div>

          {!data?.internalUsage?.enabled ? (
            <p className="mt-4 rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-3 text-sm text-muted-foreground">
              Sem DATABASE_URL: o consumo por obra vem dos eventos gravados no banco.
            </p>
          ) : obras.length === 0 ? (
            <p className="mt-4 rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-3 text-sm text-muted-foreground">
              Nenhum consumo registrado no período.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-sm border">
              <div className="grid grid-cols-[1.6fr_0.6fr_0.7fr_0.9fr] border-b bg-[var(--nexodoc-recessed)] px-3 py-2 font-mono text-[11px] uppercase text-muted-foreground">
                <span>Obra</span>
                <span className="text-right">Conversas</span>
                <span className="text-right">Tokens</span>
                <span className="text-right">Custo</span>
              </div>
              {obras.map((obra) => {
                const semObra =
                  obra.origem === "sem-vinculo" || obra.origem === "conversa-removida";
                return (
                  <div
                    key={obra.chave}
                    className="grid grid-cols-[1.6fr_0.6fr_0.7fr_0.9fr] items-baseline gap-3 border-b px-3 py-3 text-sm last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate",
                          // A linha sem obra é informação, não alarme: fica
                          // apagada, nunca em cor de status.
                          semObra ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {obra.obra}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {obra.origem === "pasta"
                          ? "pasta"
                          : obra.origem === "conversa"
                            ? "conversa avulsa"
                            : obra.origem === "conversa-removida"
                              ? "a conversa não existe mais"
                              : "consumo sem conversa (auditoria fora do Nexo, manutenção)"}
                        {" · "}
                        {plural(obra.requests, "chamada", "chamadas")}
                      </p>
                    </div>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {obra.conversas || "--"}
                    </span>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {formatNumber(obra.totalTokens)}
                    </span>
                    <span className="text-right font-mono text-xs text-foreground">
                      {formatUsd(obra.estimatedCostUsd)}
                      {formatarReais(obra.estimatedCostUsd, cotacao) ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {formatarReais(obra.estimatedCostUsd, cotacao)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-sm border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Uso interno por tarefa</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Eventos gravados pelo Nexo por fluxo, tarefa e chamada de IA.
              </p>
            </div>
            {data?.internalUsage?.enabled ? (
              <span className="rounded-md border bg-[var(--nexodoc-recessed)] px-2 py-1 font-mono text-xs text-muted-foreground">
                {formatNumber(data.internalUsage.totals.requests)} eventos ·{" "}
                {/*
                  As duas ressalvas convivem, e nenhuma pode calar a outra: o
                  "≥" diz que há chamada SEM PREÇO na soma (vem da main), e o
                  "≈" diz que o real é conversão por cotação declarada. Um valor
                  pode ser as duas coisas — piso em dólar, aproximado em real.
                */}
                {data.internalUsage.totals.unpricedRequests > 0 ? "≥ " : ""}
                {formatUsd(data.internalUsage.totals.estimatedCostUsd)}
                {formatarReais(data.internalUsage.totals.estimatedCostUsd, cotacao)
                  ? ` · ${formatarReais(data.internalUsage.totals.estimatedCostUsd, cotacao)}`
                  : ""}
              </span>
            ) : null}
          </div>

          {/*
            O total só pode se anunciar como fechado quando TODO evento tem
            preço. Sem este aviso, um modelo fora da tabela vira desconto: foi o
            que aconteceu com o `gpt-5.6-luna`, cujas chamadas somavam zero e
            faziam a conta parecer menor do que era.
          */}
          {data?.internalUsage?.enabled && data.internalUsage.totals.unpricedRequests > 0 ? (
            <p className="mt-3 rounded-md border border-[var(--nexodoc-warning-border,var(--border))] bg-[var(--nexodoc-recessed)] px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Total parcial.</span>{" "}
              {formatNumber(data.internalUsage.totals.unpricedRequests)} de{" "}
              {formatNumber(data.internalUsage.totals.requests)} chamadas não têm preço na tabela e
              entram como zero ({formatNumber(data.internalUsage.totals.unpricedTokens)} tokens fora
              da conta). Sem preço não é de graça — some o modelo em{" "}
              <span className="font-mono">lib/ai-precos.ts</span>:{" "}
              <span className="font-mono">{data.internalUsage.unpricedModels.join(", ")}</span>.
            </p>
          ) : null}

          {!data?.internalUsage?.enabled ? (
            <p className="mt-4 rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-3 text-sm text-muted-foreground">
              Registro interno indisponível. Configure `DATABASE_URL` e aplique o schema do Prisma.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Fluxos
                </h3>
                {data.internalUsage.flows.map((flow) => (
                  <div key={flow.flow} className="rounded-md border bg-[var(--nexodoc-recessed)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm font-medium">{flow.flow}</p>
                      <span className="font-mono text-xs text-muted-foreground">
                        {flow.unpricedRequests > 0 ? "≥ " : ""}
                        {formatUsd(flow.estimatedCostUsd)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {formatNumber(flow.totalTokens)} tokens · {formatNumber(flow.requests)} chamadas
                      {flow.unpricedRequests > 0
                        ? ` · ${formatNumber(flow.unpricedRequests)} sem preço`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>

              <div className="min-w-0">
                <h3 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Tarefas com maior consumo
                </h3>
                <div className="mt-2 overflow-hidden rounded-md border">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-medium">Tarefa</th>
                        <th className="px-3 py-3 font-medium">Fluxo</th>
                        <th className="px-3 py-3 text-right font-medium">Tokens</th>
                        <th className="px-3 py-3 text-right font-medium">Custo est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.internalUsage.tasks.length > 0 ? (
                        data.internalUsage.tasks.map((task) => (
                          <tr key={`${task.flow}-${task.taskId || task.taskLabel}`} className="border-t">
                            <td className="max-w-[280px] truncate px-3 py-3">{task.taskLabel || task.taskId || "-"}</td>
                            <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{task.flow}</td>
                            <td className="px-3 py-3 text-right font-mono">{formatNumber(task.totalTokens)}</td>
                            <td className="px-3 py-3 text-right font-mono">{formatUsd(task.estimatedCostUsd)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                            Nenhum evento interno no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
    </AdminPageShell>
  );
}
