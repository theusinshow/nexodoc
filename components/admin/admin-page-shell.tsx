"use client";

/**
 * O CROMO COMPARTILHADO DO ADMIN.
 *
 * O admin era visualmente outro produto: `rounded-md` e borda padrão em toda
 * parte, enquanto o resto do sistema já falava chanfro. Não era descuido — o
 * plano do chanfro (`2026-08-11-chanfro-como-sistema.md`) excluiu
 * `app/admin/**` do escopo por decisão registrada, e a dívida ficou datada.
 *
 * Aqui ela se paga no lugar de maior alavanca: estes quatro componentes são o
 * cromo das SETE telas. Corrigi-los é corrigir todas de uma vez, e é o que
 * evita o retrabalho de tocar cada tela duas vezes.
 *
 * A tela do admin é onde mora quem paga a conta. Ela não pode ser a única do
 * produto que parece um template.
 */

import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * O fundo, a altura e o tema saíram daqui: são do `app/admin/layout.tsx`, que
 * agora desenha o trilho ao lado. Mantê-los aqui pintaria um `min-h-dvh` dentro
 * de outro e daria duas rolagens concorrentes na mesma tela.
 */
export function AdminPageShell({
  children,
  maxWidth = "max-w-[1500px]",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className="px-5 py-5">
      <div className={`mx-auto flex ${maxWidth} flex-col gap-4`}>{children}</div>
    </main>
  );
}

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
          <Icon className="size-4" />
          Admin
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions}
    </header>
  );
}

/**
 * O CABEÇALHO DE UMA SEÇÃO dentro de um destino.
 *
 * `AdminPageHeader` continua sendo o título da TELA — um por rota. Quando dois
 * conteúdos passaram a dividir um destino (Motor recebeu Qualidade e
 * Configuração; Dados recebeu Auditorias e LDs), cada um deles precisava
 * continuar se apresentando sem fingir ser a página inteira: dois `<h1>` na
 * mesma tela é o tipo de coisa que só o leitor de tela percebe, e percebe como
 * defeito.
 */
export function TituloDaSecao({
  icon: Icon,
  titulo,
  descricao,
  acoes,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-4 text-primary" />
          {titulo}
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{descricao}</p>
      </div>
      {acoes}
    </header>
  );
}

export function AdminError({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    // Borda em Signal Critical e miolo tingido: é o vocabulário de falha do §7,
    // e não uma borda vermelha qualquer.
    <p className="nx-edge-8 flex items-start gap-2 p-3 text-sm text-[var(--status-critical)] [--nx-edge:var(--status-critical)] [--nx-fill:var(--status-critical-tint)]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export interface MetricaDoAdmin {
  label: string;
  value: string | number;
  detail?: string;
  /** O selo de ícone no canto. Sem ele o cartão é só rótulo e número. */
  icon?: LucideIcon;
  /**
   * Para onde o número leva. Sem isto, o cartão informa e abandona: quem
   * administra tem que sair, achar a tela certa e refazer o filtro à mão.
   */
  href?: string;
  /** O selo vira crítico. Use pelo VALOR, nunca pela coluna — zero não é sinal. */
  alerta?: boolean;
}

/**
 * A FAIXA DE MÉTRICAS, agora uma só.
 *
 * Havia TRÊS implementações do mesmo cartão: esta, o `AdminMetric` da visão
 * geral (com ícone, link e alerta) e dois `MetricCard` — um em Consumo, outro
 * em Qualidade. Cada uma com um raio diferente (`rounded-sm`, `rounded-md`,
 * chanfro) e um tamanho de número diferente, para o mesmo papel, no mesmo
 * painel. Só 3 das 7 telas usavam a compartilhada.
 *
 * As três viraram esta, que absorveu o que as outras tinham de bom: ícone, link
 * e alerta vêm da visão geral; o chanfro, o esqueleto com a forma final e o
 * algarismo tabular já eram daqui.
 */
export function AdminMetricStrip({
  metrics,
  columns = "sm:grid-cols-4",
  loading = false,
}: {
  metrics: MetricaDoAdmin[];
  columns?: string;
  loading?: boolean;
}) {
  return (
    <section className={`grid gap-3 ${columns}`}>
      {metrics.map((metric) => (
        <AdminMetric key={metric.label} metrica={metric} loading={loading} />
      ))}
    </section>
  );
}

function AdminMetric({ metrica, loading }: { metrica: MetricaDoAdmin; loading: boolean }) {
  const Icon = metrica.icon;
  const corpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {metrica.label}
        </p>
        {Icon ? (
          <span
            className={cn(
              // Corte 5, e não `rounded-md`: o selo é um chip, e chip tem
              // chanfro como todo o resto. As três cópias anteriores usavam
              // raio, cada uma o seu.
              "nx-cut-5 flex size-8 shrink-0 items-center justify-center",
              // Alerta pinta pelo VALOR, nunca pela coluna: um zero vermelho
              // treina o olho a ignorar a cor justamente quando ela importa.
              metrica.alerta
                ? "bg-[var(--status-critical)]/10 text-[var(--status-critical)]"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      {/*
        O número desceu de 24px para 20px e ganhou ALGARISMO TABULAR.
        Vinte pixels ainda é a coisa maior do cartão — continua sendo o que se lê
        primeiro —, mas para de ser métrica-herói, que o §1 rejeita. O tabular é
        o que faz uma fileira de quatro cartões alinhar em coluna: sem ele,
        "1.204" e "87" dançam e a fileira lê como decoração.

        O esqueleto tem a FORMA FINAL (altura da linha do número), e não uma
        barra genérica: skeleton que muda de tamanho ao virar conteúdo faz a tela
        pular na hora em que a pessoa começa a ler.
      */}
      {loading ? (
        <div className="mt-1 h-7 w-16 animate-pulse bg-[var(--nexodoc-recessed)]" />
      ) : (
        <p className="mt-1 font-mono text-[20px] font-semibold leading-7 tabular-nums">
          {metrica.value}
        </p>
      )}
      {metrica.detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{metrica.detail}</p>
      ) : null}
    </>
  );

  if (!metrica.href) {
    return <div className="nx-edge-8 p-3">{corpo}</div>;
  }

  return (
    <Link
      href={metrica.href}
      className="nx-edge-8 block p-3 transition-colors hover:[--nx-edge:var(--primary)] focus-visible:outline-none"
    >
      {corpo}
    </Link>
  );
}
