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

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

import {
  AdminError,
  AdminMetricStrip,
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";

type OverviewResponse = {
  /** O veredito derivado do estado do sistema (A.4). */
  status?: {
    veredito: "operacional" | "degradado" | "parado";
    linha: string;
    motivo: string;
  };
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
    recentLdEvents: number;
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

export default function AdminHomePage() {
  /** O detalhe do cartão quando ainda não houve consulta — nunca um número. */
  const semDados = "Aguardando consulta";
  /*
   * O token vem do trilho, nao desta tela -- ver [[components/admin/admin-token.tsx]].
   * Antes, cada uma das sete telas tinha o seu, e o campo de senha era a
   * primeira coisa que se via em todas elas.
   */
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /*
   * Só o que NÃO tem métrica em cima.
   *
   * Usuários, LDs e Auditorias saíram daqui: viraram destino dos próprios
   * cartões de número, e antes apareciam três vezes na mesma tela — na barra de
   * navegação, na faixa de métricas e nesta fileira. Repetir o mesmo caminho
   * três vezes não é redundância útil, é ruído que faz a tela parecer maior do
   * que é.
   */
  const actions = useMemo(
    () => [
      { href: "/admin/dinheiro", label: "Consumo", detail: "Tokens, custos e modelos OpenAI", icon: BarChart3 },
      { href: "/admin/motor", label: "Qualidade do motor", detail: "Compara Padrão e Profundo pelos achados revisados", icon: ShieldCheck },
      { href: "/admin/motor", label: "Configuração", detail: "Chaves, modelos e limites sem expor valores", icon: Settings2 },
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

      registrarResposta(true);
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
    if (!restaurado || !token.trim()) return;
    /*
     * `queueMicrotask` porque a carga chama `setState` no corpo dela, e o
     * React Compiler barra `setState` sincrono dentro de efeito. E o mesmo
     * contorno que este arquivo ja usava na restauracao do token.
     */
    queueMicrotask(() => void loadOverview(token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurado, recarga]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        icon={ShieldCheck}
        title="Centro de controle"
        description="Operação do Nexo para piloto: usuários, histórico, LDs, consumo, qualidade e configuração."
      />

        <AdminError message={error} />

        {/*
          A LINHA DE STATUS abre a home (A.4). Um veredito, não um cartão: a
          home já tinha as contagens e deixava a conclusão por conta de quem
          olhava. A cor sai dos tokens de status — nada de métrica-herói
          colorida, que o DESIGN.md proíbe.
        */}
        {data?.status ? (
          <section className="border border-border bg-card px-4 py-3">
            <p
              className={
                data.status.veredito === "parado"
                  ? "font-mono text-xs text-[var(--status-critical)]"
                  : data.status.veredito === "degradado"
                    ? "font-mono text-xs text-[var(--status-warning)]"
                    : "font-mono text-xs text-[var(--status-ok)]"
              }
            >
              {data.status.linha}
            </p>
            {data.status.motivo ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {data.status.motivo}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* O painel só fala quando tem o que dizer. */}
        {!data && !loading && !error && (
          <p className="border border-border bg-card p-3 text-sm text-muted-foreground">
            Informe o token admin acima para carregar os números.
          </p>
        )}

        {/*
          ZERO NAO E "NAO SEI".
          Antes, `data?.totals.audits ?? 0` pintava zero enquanto o painel nunca
          tinha carregado (sem token, a API responde 401) — e o operador lia
          "nenhuma auditoria" num banco com dezenas delas. O `loading ? "--"`
          cobria só o instante da consulta, não o estado de nunca ter havido
          consulta nenhuma. A tela de Uso e custos, ao lado, já fazia certo com
          "--" e "Aguardando consulta"; aqui é a mesma regra.
        */}
        <AdminMetricStrip
          columns="md:grid-cols-2 xl:grid-cols-5"
          metrics={[
            { label: "Usuários ativos", value: data ? data.totals.activeUsers : "--", detail: data ? plural(data.totals.admins, "admin", "admins") : semDados, icon: UsersRound, href: "/admin/pessoas" },
            { label: "Auditorias", value: data ? data.totals.audits : "--", detail: data ? `${data.totals.recentAudits} nos últimos 7 dias` : semDados, icon: ListChecks, href: "/admin/dados" },
            { label: "Falhas", value: data ? data.totals.failedAudits : "--", detail: data ? "Auditorias com erro" : semDados, icon: AlertTriangle, href: "/admin/dados?status=FAILED", alerta: Boolean(data && data.totals.failedAudits > 0) },
            { label: "LDs", value: data ? data.totals.ldDrafts : "--", detail: data ? `${plural(data.totals.generatedLds, "gerada", "geradas")} · ${data.totals.recentLds} nos últimos 7 dias` : semDados, icon: FileSpreadsheet, href: "/admin/dados" },
            { label: "Eventos LD", value: data ? data.totals.ldEvents : "--", detail: data ? `${data.totals.recentLdEvents} nos últimos 7 dias` : semDados, icon: Clock3, href: "/admin/dados" },
          ]}
        />

        <section className="grid gap-3 md:grid-cols-3">
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
                  {/*
                    O projeto só aparece quando ACRESCENTA algo. Derivados da
                    mesma obra, título e projeto viram a mesma frase duas vezes
                    por linha — repetição que ocupa a largura onde caberiam
                    dados de verdade.
                  */}
                  <p className="truncate text-xs text-muted-foreground">
                    {audit.projectName !== audit.title ? `${audit.projectName} · ` : ""}
                    {audit.auditMode} · {plural(audit.totalFindings, "achado", "achados")} · {formatDate(audit.createdAt)}
                  </p>
                </div>
              ))}
              {/*
                "Nenhuma auditoria registrada" só quando o servidor DISSE isso.
                Sem consulta, a lista vazia não afirma nada — e afirmar vazio é
                o mesmo erro dos zeros, escrito por extenso.
              */}
              {data && data.latestAudits.length === 0 ? <EmptyState description="Nenhuma auditoria registrada." className="py-10" /> : null}
              {!data ? <EmptyState description="Aguardando consulta." className="py-10" /> : null}
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
                    {ld.workName || "Obra não preenchida"} · {plural(ld.uploadedFileCount, "PDF não armazenado", "PDFs não armazenados")} · {formatDate(ld.updatedAt)}
                  </p>
                </div>
              ))}
              {data && data.latestLds.length === 0 ? <EmptyState description="Nenhuma LD registrada." className="py-10" /> : null}
              {!data ? <EmptyState description="Aguardando consulta." className="py-10" /> : null}
            </div>
          </article>
        </section>
    </AdminPageShell>
  );
}
