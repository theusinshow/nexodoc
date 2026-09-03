"use client";

/**
 * O TRILHO — cinco destinos, e o veredito sempre à vista.
 *
 * Substitui a barra de sete abas rasas. O problema dela não era a ordem (já
 * tinha sido corrigida) nem a medição de quantas cabiam: era não haver
 * hierarquia nenhuma. Sete telas no mesmo nível, e a pessoa que abria o painel
 * para saber "quanto gastei" tinha que lembrar em qual delas isso mora.
 *
 * OS CINCO DESTINOS AGRUPAM PELA PERGUNTA QUE SE FAZ, não pela ordem em que as
 * telas nasceram:
 *
 *  · Cockpit  — está tudo de pé?
 *  · Dinheiro — quanto custou, e sobra teto?
 *  · Motor    — a auditoria está melhorando, e com que configuração?
 *  · Pessoas  — quem entra?
 *  · Dados    — o que o banco guarda, e o que dá para apagar?
 *
 * O TRILHO PERSISTE entre destinos, e é isso que acaba com a sensação de ilha:
 * o contexto não é redesenhado a cada clique. E o token mora aqui — ver
 * [[admin-token.tsx]] —, não repetido no cabeçalho de cada tela.
 */

import {
  ArrowLeft,
  BarChart3,
  Database,
  Gauge,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminToken } from "@/components/admin/admin-token";

const destinos = [
  { href: "/admin", label: "Cockpit", icon: Gauge, resumo: "está tudo de pé?" },
  { href: "/admin/dinheiro", label: "Dinheiro", icon: BarChart3, resumo: "quanto custou?" },
  { href: "/admin/motor", label: "Motor", icon: ShieldCheck, resumo: "está melhorando?" },
  { href: "/admin/pessoas", label: "Pessoas", icon: UsersRound, resumo: "quem entra?" },
  { href: "/admin/dados", label: "Dados", icon: Database, resumo: "o que o banco guarda?" },
] as const;

type Veredito = "operacional" | "degradado" | "parado";

const corDoVeredito: Record<Veredito, string> = {
  operacional: "text-[var(--status-ok)]",
  degradado: "text-[var(--status-warning)]",
  parado: "text-[var(--status-critical)]",
};

export function AdminTrilho() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação administrativa"
      className="sticky top-0 flex h-dvh w-[212px] shrink-0 flex-col gap-3 border-r border-border bg-background px-3 py-4"
    >
      <Link
        href="/"
        className="nx-edge-6 inline-flex h-9 shrink-0 items-center gap-2 px-3 font-mono text-[12px] tracking-[0.02em] text-muted-foreground transition-colors [--nx-edge:var(--border)] [--nx-fill:var(--card)] hover:text-foreground hover:[--nx-fill:var(--accent)]"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <LinhaDoVeredito />

      <div className="flex flex-col gap-1.5">
        {destinos.map((destino) => {
          /*
           * IGUALDADE EXATA, e não `startsWith`: com o prefixo, "/admin"
           * ficaria aceso em todos os cinco — o Cockpit é prefixo dos outros
           * quatro. Nenhum destino tem sub-rota, então exato basta.
           */
          const atual = pathname === destino.href;
          const Icone = destino.icon;

          return (
            <Link
              key={destino.href}
              href={destino.href}
              aria-current={atual ? "page" : undefined}
              className={cn(
                "nx-edge-6 flex flex-col gap-0.5 px-3 py-2 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-feedback)]",
                atual
                  ? "text-foreground [--nx-edge:var(--primary)] [--nx-fill:var(--secondary)]"
                  : "text-muted-foreground [--nx-edge:var(--border)] [--nx-fill:var(--card)] hover:text-foreground hover:[--nx-fill:var(--accent)]",
              )}
            >
              <span className="flex items-center gap-2 font-mono text-[12px] tracking-[0.02em]">
                <Icone className="size-4" />
                {destino.label}
              </span>
              {/*
                A PERGUNTA embaixo do rótulo. "Dinheiro" e "Motor" são bons
                nomes curtos e péssimas explicações — e um painel que se usa uma
                vez por semana não pode depender de a pessoa lembrar o que cada
                palavra abriga.
              */}
              <span className="pl-6 text-[11px] leading-4 text-muted-foreground">
                {destino.resumo}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto">
        <PainelDoToken />
      </div>
    </nav>
  );
}

/**
 * O veredito, no trilho.
 *
 * Vinha de `/api/admin/overview` e aparecia só na visão geral — a pergunta "está
 * tudo de pé?" só era respondida em uma das sete telas. Aqui ele consome
 * `/api/admin/status`, que existe justamente para isto: quatro contagens, não a
 * visão geral inteira.
 */
function LinhaDoVeredito() {
  const { token, restaurado, recarga, aceito } = useAdminToken();
  const [status, setStatus] = useState<{ veredito: Veredito; linha: string } | null>(null);

  useEffect(() => {
    if (!restaurado) return;

    const limpo = token.trim();

    if (!limpo) {
      queueMicrotask(() => setStatus(null));
      return;
    }

    const controlador = new AbortController();

    fetch("/api/admin/status", {
      cache: "no-store",
      signal: controlador.signal,
      headers: { Authorization: `Bearer ${limpo}` },
    })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo) => {
        if (controlador.signal.aborted) return;
        setStatus(corpo?.status ?? null);
      })
      .catch(() => {
        /*
         * SILÊNCIO AQUI É CERTO, e é a única vez neste painel que eu diria
         * isso: quem reporta falha de token é a tela, com a mensagem dela. Um
         * segundo erro no trilho, para o mesmo token recusado, seria a mesma
         * notícia dita duas vezes — e a do trilho não teria o que a pessoa faz
         * a respeito.
         */
        if (!controlador.signal.aborted) setStatus(null);
      });

    return () => controlador.abort();
  }, [token, restaurado, recarga]);

  if (!status) {
    return (
      <p className="px-1 font-mono text-[11px] leading-4 text-muted-foreground">
        {aceito ? "veredito indisponível" : "aguardando token"}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "px-1 font-mono text-[11px] leading-4",
        corDoVeredito[status.veredito] ?? "text-muted-foreground",
      )}
    >
      {status.linha}
    </p>
  );
}

/**
 * O token, uma vez só no painel inteiro.
 *
 * O estado recolhido AFIRMA apenas o que se sabe: "há um token nesta sessão e
 * alguma tela carregou com ele". Não afirma validade que não se apurou — a
 * regra é a mesma que o `AdminTokenForm` já seguia, e ela sobrevive à mudança
 * de lugar.
 */
function PainelDoToken() {
  const { token, aceito, definirToken, recarregar, sair } = useAdminToken();
  const [editando, setEditando] = useState(false);

  if (token && aceito && !editando) {
    return (
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 px-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <KeyRound className="size-3.5" aria-hidden />
          sessão admin
        </span>
        <div className="flex items-center gap-2 px-1 font-mono text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={recarregar}
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            atualizar
          </button>
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
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        setEditando(false);
        recarregar();
      }}
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <label
        htmlFor="token-do-admin"
        className="px-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
      >
        Token admin
      </label>
      <div className="nx-edge-7 relative [--nx-fill:var(--nexodoc-recessed)]">
        <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          id="token-do-admin"
          type="password"
          value={token}
          onChange={(evento) => {
            // Digitar é editar: sem isto o campo se recolhia na primeira tecla,
            // e não havia como digitar o token à mão. Ver o histórico em
            // `admin-page-shell.tsx`.
            setEditando(true);
            definirToken(evento.target.value);
          }}
          placeholder="NEXODOC_ADMIN_TOKEN"
          className="h-9 w-full bg-transparent pl-8 pr-2 text-xs outline-none"
        />
      </div>
      <Button type="submit" size="sm">
        <RefreshCcw />
        Entrar
      </Button>
    </form>
  );
}
