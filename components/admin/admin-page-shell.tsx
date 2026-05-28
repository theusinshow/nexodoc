"use client";

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
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-2 border border-border bg-card p-3 lg:w-[460px]">
      <label className="font-mono text-xs text-muted-foreground">Token admin</label>
      <div className={`grid gap-2 ${gridClassName}`}>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="NEXODOC_ADMIN_TOKEN"
            className="h-10 w-full rounded-md border bg-[var(--nexodoc-recessed)] pl-9 pr-3 text-sm"
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
    <p className="flex items-start gap-2 border border-destructive/30 bg-card p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function AdminMetricStrip({
  metrics,
  columns = "sm:grid-cols-4",
}: {
  metrics: Array<{ label: string; value: string | number; detail?: string }>;
  columns?: string;
}) {
  return (
    <section className={`grid gap-3 ${columns}`}>
      {metrics.map((metric) => (
        <div key={metric.label} className="border border-border bg-card p-3">
          <p className="font-mono text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{metric.value}</p>
          {metric.detail ? <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p> : null}
        </div>
      ))}
    </section>
  );
}
