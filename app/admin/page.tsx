"use client";

import { AlertTriangle, BarChart3, CheckCircle2, Clock3, FileSpreadsheet, ListChecks, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { TUDO_EM_ORDEM } from "@/lib/atencao-do-admin";
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
  atencao?: Array<{ chave: string; texto: string; gravidade: "critico" | "aviso" }>;
  acoes?: Array<{
    id: string;
    quando: string;
    quem: string;
    acao: string;
    alcance: string;
  }>;
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
        description="O que exige ação, quanto se gastou e o que rodou por último. Cada linha abre o dado."
      />

        <AdminError message={error} />

        {/*
          O VEREDITO NÃO SE REPETE AQUI. Ele abria esta tela desde a A.4, e era
          o certo enquanto era a única que o mostrava. Agora ele mora no trilho
          e acompanha os cinco destinos — repeti-lo seria a mesma notícia duas
          vezes na mesma dobra, e a segunda ensina a não ler a primeira.
        */}

        {/*
          O QUE EXIGE AÇÃO, logo abaixo do veredito.
          Isto vivia no topo da Config, e ficou lá enquanto a Config existia:
          quem abria aquela tela quase sempre abria por causa de algo quebrado.
          Mas a pergunta não é sobre configuração — é a PRIMEIRA pergunta do
          painel, e agora ela abre o cockpit.

          Só entra o que impede o produto de funcionar agora. O opcional
          (cotação, metas) fica de fora de propósito: faixa que lista pendência
          que ninguém precisa resolver é faixa que se aprende a ignorar. Ver
          `lib/atencao-do-admin.ts`.
        */}
        {data ? (
          <section className="nx-edge-8 px-4 py-3">
            {(data.atencao ?? []).length === 0 ? (
              <p className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--status-ok)]">
                <CheckCircle2 className="size-3.5" />
                {TUDO_EM_ORDEM}
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {(data.atencao ?? []).map((item) => (
                  <li
                    key={item.chave}
                    className={cn(
                      "inline-flex items-start gap-1.5 font-mono text-[11px]",
                      item.gravidade === "critico"
                        ? "text-[var(--status-critical)]"
                        : "text-[var(--status-warning)]",
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {item.texto}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* O painel só fala quando tem o que dizer. */}
        {!data && !loading && !error && (
          <p className="nx-edge-8 p-3 text-sm text-muted-foreground">
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

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="nx-edge-8">
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

          <article className="nx-edge-8">
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

        {/*
          QUEM FEZ O QUÊ. Até agora nada era registrado — nem quem promoveu
          alguém a admin, nem quem apagou cinquenta auditorias. Com o expurgo
          isso deixou de ser desconforto e virou risco.
        */}
        <article className="nx-edge-8">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Últimas ações administrativas</h2>
          </div>
          <div className="divide-y divide-border">
            {(data?.acoes ?? []).map((acao) => (
              <div key={acao.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs">
                  {acao.acao}
                  {acao.alcance ? ` · ${acao.alcance}` : ""}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {acao.quem} · {formatDate(acao.quando)}
                </span>
              </div>
            ))}
            {data && (data.acoes ?? []).length === 0 ? (
              <EmptyState description="Nenhuma ação registrada ainda." className="py-8" />
            ) : null}
            {!data ? <EmptyState description="Aguardando consulta." className="py-8" /> : null}
          </div>
        </article>
    </AdminPageShell>
  );
}
