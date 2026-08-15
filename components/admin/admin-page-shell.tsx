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
import { useState, type FormEvent, type ReactNode } from "react";

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

/**
 * O TOKEN COLAPSA DEPOIS DE ENTRAR.
 *
 * O campo de senha ocupava o melhor lugar das SETE telas, para sempre: a
 * primeira coisa que se via em todo header do admin era um input de senha, dez
 * vezes por dia, para uma sessão que já estava aberta no `sessionStorage`.
 *
 * O que o estado recolhido AFIRMA é só o que se sabe: "há um token nesta
 * sessão". Ele não diz que o token é válido — quem diz isso é a tela, que
 * mostra `AdminError` quando não é, e aí o botão "trocar" está ali do lado.
 * Afirmar validade que não se apurou seria a mesma mentira que o produto
 * inteiro evita.
 */
export function AdminTokenForm({
  token,
  loading,
  onTokenChange,
  onSubmit,
  children,
  gridClassName = "sm:grid-cols-[1fr_auto]",
  autenticado = true,
}: {
  token: string;
  loading: boolean;
  onTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
  gridClassName?: string;
  /**
   * O token FUNCIONOU (a tela recebeu dados). Sem isto, o recolhimento
   * acontecia no envio, desse certo ou não: token recusado deixava a pessoa
   * olhando "Acesso admin negado" com o campo fechado, e para tentar de novo
   * era preciso adivinhar que o caminho é o link "trocar".
   *
   * O padrão é `true` para não mudar o comportamento de quem não passa a prop.
   */
  autenticado?: boolean;
}) {
  const [editando, setEditando] = useState(false);

  function sair() {
    onTokenChange("");
    setEditando(true);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // `sessionStorage` pode estar bloqueado (modo restrito do navegador). O
      // token já saiu do estado, que é o que importa nesta aba.
    }
  }

  if (token && !editando && autenticado) {
    /*
      O RECOLHIDO CONTINUA SENDO UM FORM, e continua carregando os `children`.
      Algumas telas passam ali controles que NÃO são de autenticação — o
      seletor de período do consumo, por exemplo. Sumir com eles junto do campo
      de senha seria trocar um problema por outro pior: o campo estorva, mas o
      seletor de período é o controle principal daquela tela.
    */
    return (
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <KeyRound className="size-3.5" aria-hidden />
            sessão admin
          </span>
          <span aria-hidden className="text-border">·</span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            trocar
          </button>
          <span aria-hidden className="text-border">·</span>
          <button
            type="button"
            onClick={sair}
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            sair
          </button>
        </span>
        {children}
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        // Recolhe ao enviar: quem acabou de digitar o token não precisa de um
        // campo de senha aberto na tela pelo resto da sessão.
        setEditando(false);
        onSubmit(e);
      }}
      className="nx-edge-8 flex w-full flex-col gap-2 p-3 lg:w-[460px]"
    >
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
            onChange={(event) => {
              /*
               * DIGITAR É EDITAR — e sem esta linha o campo sumia na PRIMEIRA
               * TECLA.
               *
               * O recolhimento é `token && !editando`, e `editando` nascia
               * `false`. O primeiro caractere tornava `token` verdadeiro, a
               * condição fechava, e o formulário virava "sessão admin · trocar
               * · sair" com um caractere só dentro. Não havia como digitar o
               * token à mão em nenhuma das 7 telas do admin.
               *
               * O recolhido continua servindo ao caso para o qual foi feito: o
               * token restaurado do `sessionStorage`, que chega sem ninguém
               * digitar, e o `onSubmit`, que recolhe depois de enviar.
               */
              setEditando(true);
              onTokenChange(event.target.value);
            }}
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
    <p className="nx-edge-8 flex items-start gap-2 p-3 text-sm text-[var(--status-critical)] [--nx-edge:var(--status-critical)] [--nx-fill:var(--status-critical-tint)]">
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
