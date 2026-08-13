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
import { AlertTriangle, KeyRound, RefreshCcw } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";

export const ADMIN_TOKEN_STORAGE_KEY = "nexodoc-admin-token";

export function AdminPageShell({
  children,
  maxWidth = "max-w-[1500px]",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className="min-h-dvh bg-background px-5 py-5 text-foreground">
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

export function AdminTokenForm({
  token,
  loading,
  onTokenChange,
  onSubmit,
  children,
  gridClassName = "sm:grid-cols-[1fr_auto]",
}: {
  token: string;
  loading: boolean;
  onTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
  gridClassName?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="nx-edge-8 flex w-full flex-col gap-2 p-3 lg:w-[460px]">
      <label className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        Token admin
      </label>
      <div className={`grid gap-2 ${gridClassName}`}>
        {/*
          O campo recebe o corte 7 (a medida de campo, §5) e o miolo recessado —
          o mesmo tratamento do `Input` do produto. `nx-edge-*` já reposiciona
          `input` filho para a camada certa, então basta o wrapper.
        */}
        <div className="nx-edge-7 relative [--nx-fill:var(--nexodoc-recessed)]">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="NEXODOC_ADMIN_TOKEN"
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none"
          />
        </div>
        {children ?? (
          <Button type="submit" disabled={loading}>
            <RefreshCcw />
            Atualizar
          </Button>
        )}
      </div>
    </form>
  );
}

export function AdminError({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    // Borda em Signal Critical e miolo tingido: é o vocabulário de falha do §7,
    // e não uma borda vermelha qualquer.
    <p className="nx-edge-8 flex items-start gap-2 p-3 text-sm text-[var(--status-critical)] [--nx-edge:var(--status-critical)] [--nx-fill:var(--status-critical-bg)]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function AdminMetricStrip({
  metrics,
  columns = "sm:grid-cols-4",
  loading = false,
}: {
  metrics: Array<{ label: string; value: string | number; detail?: string }>;
  columns?: string;
  loading?: boolean;
}) {
  return (
    <section className={`grid gap-3 ${columns}`}>
      {metrics.map((metric) => (
        <div key={metric.label} className="nx-edge-8 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {metric.label}
          </p>
          {/*
            O número desceu de 24px para 20px e ganhou ALGARISMO TABULAR.
            Vinte pixels ainda é a coisa maior do cartão — continua sendo o que
            se lê primeiro —, mas para de ser métrica-herói, que o §1 rejeita.
            O tabular é o que faz uma fileira de quatro cartões alinhar em
            coluna: sem ele, "1.204" e "87" dançam e a fileira lê como
            decoração.

            O esqueleto tem a FORMA FINAL (altura da linha do número), e não uma
            barra genérica: skeleton que muda de tamanho ao virar conteúdo faz a
            tela pular na hora em que a pessoa começa a ler.
          */}
          {loading ? (
            <div className="mt-1 h-7 w-16 animate-pulse bg-[var(--nexodoc-recessed)]" />
          ) : (
            <p className="mt-1 font-mono text-[20px] font-semibold leading-7 tabular-nums">
              {metric.value}
            </p>
          )}
          {metric.detail ? (
            <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
