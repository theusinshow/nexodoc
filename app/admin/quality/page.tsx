"use client";

import {
  CheckCircle2,
  Clock3,
  ScanSearch,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import {
  ADMIN_TOKEN_STORAGE_KEY,
  AdminError,
  AdminMetricStrip,
  AdminPageHeader,
  AdminPageShell,
  AdminTokenForm,
} from "@/components/admin/admin-page-shell";
import {
  METAS_NAO_DECLARADAS,
  situacaoDaCobertura,
  situacaoDoFalsoPositivo,
  type MetasDeQualidade,
  type SemanaDeQualidade,
  type SituacaoContraMeta,
} from "@/lib/meta-de-qualidade";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

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
  /** As metas declaradas em Configurações. Ausentes = painel não julga (A.8). */
  meta?: {
    metas: MetasDeQualidade;
    origem: "banco" | "ambiente" | "nenhuma";
    databaseConfigured: boolean;
  };
  /** Semanas com auditoria, da mais antiga para a mais recente. */
  serie?: SemanaDeQualidade[];
  /** Diferença em pontos entre as duas últimas semanas julgadas. */
  tendencia?: number | null;
  generatedAt: string;
};

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

/** "semana de 10/08" — a segunda-feira, que é como o escritório fala da semana. */
function formatWeek(semana: string) {
  const data = new Date(`${semana}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return semana;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(data);
}

/**
 * A cor de uma célula contra a meta. SEM META NÃO PINTA: colorir sem régua
 * declarada seria o painel inventando o próprio critério — e "sem-meta" não é
 * aprovação, é ausência de julgamento.
 */
function corDaSituacao(situacao: SituacaoContraMeta) {
  if (situacao === "dentro") return "text-[var(--status-ok)]";
  if (situacao === "fora") return "text-[var(--status-warning)]";
  return "text-muted-foreground";
}

function isErrorPayload(
  payload: QualityResponse | { error?: string },
): payload is { error?: string } {
  return "error" in payload;
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
                {/*
                  A COR VEM DO VALOR, NÃO DA COLUNA.

                  Antes, "Perdidos" saía sempre em coral e "Confirmação" sempre
                  em verde. Isso pintava a melhor notícia da tabela — ZERO erro
                  perdido — com a cor de "bloqueia a emissão", e carimbava de
                  aprovada uma taxa de confirmação de 10%. A cor dizia a coluna;
                  o número dizia outra coisa.

                  Zero defeito é neutro: não é um sinal, é a ausência dele.

                  E a taxa perdeu o verde de propósito. Esta tela declara que
                  NÃO JULGA enquanto não houver meta declarada (é o que
                  `prova:meta-qualidade` cobra do selo) — pintar a taxa de verde
                  sem meta era exatamente o julgamento que a tela nega fazer.
                */}
                <td className="px-3 py-3 text-right font-mono">
                  {formatPercent(row.confirmationRate)}
                </td>
                <td className={cn("px-3 py-3 text-right font-mono", row.falsePositive > 0 && "text-[var(--status-warning)]")}>
                  {formatNumber(row.falsePositive)}
                </td>
                <td className={cn("px-3 py-3 text-right font-mono", row.wrongSeverity > 0 && "text-[var(--status-warning)]")}>
                  {formatNumber(row.wrongSeverity)}
                </td>
                <td className={cn("px-3 py-3 text-right font-mono", row.missingFinding > 0 && "text-[var(--status-critical)]")}>
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

      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmedToken);
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
    const storedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";

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
  const metas: MetasDeQualidade = data?.meta?.metas ?? METAS_NAO_DECLARADAS;
  const serie = data?.serie ?? [];
  const tendencia = data?.tendencia ?? null;

  return (
    <AdminPageShell maxWidth="max-w-[1300px]">
      <AdminPageHeader
        icon={ShieldCheck}
        title="Qualidade do motor"
        description="Compare níveis e modelos a partir dos achados revisados manualmente. Quanto mais auditorias rotuladas, mais confiável será a decisão de produto."
        actions={
          <AdminTokenForm
            token={token}
            autenticado={Boolean(data)}
            loading={isLoading}
            onTokenChange={setToken}
            onSubmit={handleSubmit}
          />
        }
      />

        <AdminError message={error} />

        <AdminMetricStrip
          columns="sm:grid-cols-2 xl:grid-cols-4"
          metrics={[
            {
              label: "Auditorias concluídas",
              icon: ScanSearch,
              value: overview ? formatNumber(overview.completedAudits) : "--",
              detail: overview ? `${formatNumber(overview.reviewedAudits)} já têm revisão humana` : "Aguardando consulta",
            },
            {
              label: "Confirmação",
              icon: CheckCircle2,
              value: overview ? formatPercent(overview.confirmationRate) : "--",
              detail: overview ? `${plural(overview.confirmed, "achado confirmado", "achados confirmados")}` : "Com base nos achados rotulados",
            },
            {
              label: "Falsos positivos",
              icon: XCircle,
              value: overview ? formatNumber(overview.falsePositive) : "--",
              detail: overview ? `${formatPercent(overview.falsePositiveRate)} dos achados avaliados` : "Aguardando revisão",
            },
            {
              label: "Erros perdidos",
              icon: Clock3,
              value: overview ? formatNumber(overview.missingFinding) : "--",
              detail: overview ? `${formatPercent(overview.reviewCoverage)} das auditorias foram rotuladas` : "Indicador de cobertura",
            },
          ]}
        />

        {/*
          A SÉRIE SEMANAL — tabela mono, nunca gráfico decorativo (spec do A.8).
          Uma foto do mês não distingue "12% e caindo" de "12% e subindo", e as
          duas pedem decisões opostas.
        */}
        <section className="overflow-hidden rounded-md border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Semana a semana</h2>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                A taxa divide pelos achados <strong>julgados</strong>, não pelos
                gerados: dividir pelo total faria a taxa cair sempre que alguém
                deixasse de revisar — melhora aparente por preguiça. Semana sem
                auditoria não vira linha.
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {metas.falsoPositivoMax > 0
                ? `meta: falso positivo ≤ ${metas.falsoPositivoMax}%`
                : "meta não declarada"}
              {metas.coberturaMin > 0 ? ` · cobertura ≥ ${metas.coberturaMin}%` : ""}
              {" · "}
              <a href="/admin/config" className="underline underline-offset-4 hover:text-foreground">
                declarar
              </a>
            </span>
          </div>

          {serie.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Sem auditoria concluída no histórico — a série aparece a partir da primeira.
            </p>
          ) : (
            <div>
              <div className="grid grid-cols-[0.9fr_0.6fr_0.7fr_0.8fr_0.8fr] border-b bg-[var(--nexodoc-recessed)] px-4 py-2 font-mono text-[11px] uppercase text-muted-foreground">
                <span>Semana</span>
                <span className="text-right">Auditorias</span>
                <span className="text-right">Achados</span>
                <span className="text-right">Falso positivo</span>
                <span className="text-right">Cobertura</span>
              </div>
              {serie.map((semana) => {
                const fp = situacaoDoFalsoPositivo(semana.taxaFalsoPositivo, metas);
                const cob = situacaoDaCobertura(semana.cobertura, metas);
                return (
                  <div
                    key={semana.semana}
                    className="grid grid-cols-[0.9fr_0.6fr_0.7fr_0.8fr_0.8fr] items-baseline gap-2 border-b px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatWeek(semana.semana)}
                    </span>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {formatNumber(semana.auditorias)}
                    </span>
                    <span className="text-right font-mono text-xs text-muted-foreground">
                      {formatNumber(semana.achados)}
                    </span>
                    <span className={`text-right font-mono text-xs ${corDaSituacao(fp)}`}>
                      {formatPercent(semana.taxaFalsoPositivo)}
                    </span>
                    <span className={`text-right font-mono text-xs ${corDaSituacao(cob)}`}>
                      {formatPercent(semana.cobertura)}
                    </span>
                  </div>
                );
              })}
              {tendencia !== null ? (
                <p className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {tendencia === 0
                    ? "falso positivo estável entre as duas últimas semanas julgadas"
                    : `falso positivo ${tendencia < 0 ? "caiu" : "subiu"} ${plural(Math.abs(tendencia), "ponto", "pontos")} na última semana julgada`}
                </p>
              ) : null}
            </div>
          )}
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
    </AdminPageShell>
  );
}
