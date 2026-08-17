"use client";

import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  FileSpreadsheet,
  Gauge,
  ListChecks,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A ORDEM É A DO DONO, não a de quando as telas nasceram.
 *
 * Era: Visão geral, Usuários, LDs, Auditorias, Consumo, Qualidade, Config — e
 * com `VISIBLE_COUNT = 4` os três últimos ficavam escondidos atrás de "Mais".
 * Consumo e Qualidade são o que se abre TODO DIA (quanto gastei, o motor está
 * melhorando?); Usuários e LDs são o que se abre uma vez por mês. Estavam
 * exatamente ao contrário.
 */
const adminLinks = [
  { href: "/admin", label: "Visão geral", icon: Gauge },
  { href: "/admin/usage", label: "Consumo", icon: BarChart3 },
  { href: "/admin/quality", label: "Qualidade", icon: ShieldCheck },
  { href: "/admin/audits", label: "Auditorias", icon: ListChecks },
  { href: "/admin/lds", label: "LDs", icon: FileSpreadsheet },
  { href: "/admin/users", label: "Usuários", icon: UsersRound },
  { href: "/admin/config", label: "Config", icon: Settings2 },
] as const;

/**
 * Espaço do botão "Mais" mais o vão. Reservado só quando ele vai existir.
 *
 * Fixo porque o botão é de largura conhecida e não muda com os dados — medi-lo
 * exigiria renderizá-lo para decidir se ele deve existir, que é circular.
 */
const LARGURA_DO_MAIS = 92;
const VAO = 8;

function AdminNavLink({
  href,
  label,
  icon: Icon,
  active,
  className,
  role,
  tabIndex,
  "aria-selected": ariaSelected,
  onKeyDown,
}: {
  href: string;
  label: string;
  icon: typeof Gauge;
  active: boolean;
  className?: string;
  role?: string;
  tabIndex?: number;
  "aria-selected"?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      role={role}
      tabIndex={tabIndex}
      aria-selected={ariaSelected}
      onKeyDown={onKeyDown}
      // A medição da barra encontra os links por este atributo — nunca por
      // `querySelector("a")`, que pegaria o "Voltar" junto.
      data-nav-link
      className={cn(
        /*
         * Corte 6: a medida de botão de 36px e de chip (§5). O ativo usa borda
         * teal + miolo preenchido, que é a linha "selecionado / atual" da
         * matriz do §7 — teal marca a coisa atual, e é a única coisa desta
         * barra que pode ser teal.
         */
        "nx-edge-6 inline-flex h-9 shrink-0 items-center gap-2 px-3 font-mono text-[12px] tracking-[0.02em] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-feedback)]",
        active
          ? "text-foreground [--nx-edge:var(--primary)] [--nx-fill:var(--secondary)]"
          : "text-muted-foreground [--nx-edge:var(--border)] [--nx-fill:var(--card)] hover:text-foreground hover:[--nx-fill:var(--accent)]",
        className,
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownClosing, setDropdownClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeDropdown() {
    setDropdownClosing(true);
    dropdownTimer.current = setTimeout(() => {
      setDropdownOpen(false);
      setDropdownClosing(false);
    }, 150);
  }

  function toggleDropdown() {
    if (dropdownOpen) {
      closeDropdown();
    } else {
      setDropdownClosing(false);
      setDropdownOpen(true);
    }
  }

  useEffect(() => {
    return () => {
      if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    };
  }, []);

  /*
   * QUANTOS LINKS CABEM — medido, não decidido por número redondo.
   *
   * Era `VISIBLE_COUNT = 4`: num monitor de 1500px os sete links cabiam
   * folgados e três deles ficavam escondidos atrás de "Mais" — entre eles
   * Consumo e Qualidade, que são o check diário de quem paga a conta. Uma
   * constante escondendo o que o dono mais abre.
   *
   * A medição roda depois do primeiro quadro, com todos visíveis: é ali que as
   * larguras reais existem. Elas ficam num ref porque não mudam (os rótulos são
   * estáticos) — reduzir a lista não pode apagar a memória de quanto cada item
   * ocupa, senão a barra nunca voltaria a crescer ao alargar a janela.
   */
  const barraRef = useRef<HTMLDivElement>(null);
  const largurasRef = useRef<number[]>([]);
  // O tipo é explícito porque `adminLinks` é `as const`: sem ele o TypeScript
  // infere o literal `7` e recusa qualquer contagem medida.
  const [quantosCabem, setQuantosCabem] = useState<number>(adminLinks.length);

  useEffect(() => {
    const barra = barraRef.current;
    if (!barra) return;

    function medir() {
      const el = barraRef.current;
      if (!el) return;

      const itens = Array.from(el.querySelectorAll<HTMLElement>("[data-nav-link]"));
      if (itens.length === adminLinks.length) {
        largurasRef.current = itens.map((i) => i.offsetWidth);
      }
      const larguras = largurasRef.current;
      if (larguras.length !== adminLinks.length) return;

      const voltar =
        el.querySelector<HTMLElement>("[data-nav-voltar]")?.offsetWidth ?? 0;
      let disponivel = el.clientWidth - voltar - VAO;

      let cabem = 0;
      for (const largura of larguras) {
        if (disponivel - (largura + VAO) < 0) break;
        disponivel -= largura + VAO;
        cabem++;
      }

      // Se sobrou link de fora, o "Mais" passa a existir — e ele também ocupa
      // lugar. Tira um a um até o botão caber junto.
      if (cabem < adminLinks.length) {
        while (cabem > 0 && disponivel < LARGURA_DO_MAIS + VAO) {
          cabem--;
          disponivel += larguras[cabem] + VAO;
        }
      }

      setQuantosCabem(cabem);
    }

    // rAF: `setState` síncrono no corpo do efeito é render em cascata, e o
    // ResizeObserver dispara uma vez na observação inicial.
    const ro = new ResizeObserver(() => requestAnimationFrame(medir));
    ro.observe(barra);
    return () => ro.disconnect();
  }, []);

  const isActive = (href: string) => pathname === href;
  const visibleLinks = adminLinks.slice(0, quantosCabem);
  const overflowLinks = adminLinks.slice(quantosCabem);
  const hasOverflowDropdown = overflowLinks.length > 0;
  const activeOverflow = overflowLinks.some((link) => isActive(link.href));

  function handleTabKeyDown(event: KeyboardEvent<HTMLAnchorElement>, links: readonly { href: string }[]) {
    const currentIndex = links.findIndex((l) => l.href === event.currentTarget.getAttribute("href"));
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % links.length;
      const selector = `a[href="${links[nextIndex].href}"]`;
      (event.currentTarget.parentElement?.querySelector(selector) as HTMLElement)?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + links.length) % links.length;
      const selector = `a[href="${links[prevIndex].href}"]`;
      (event.currentTarget.parentElement?.querySelector(selector) as HTMLElement)?.focus();
    }
  }

  return (
    <nav
      role="navigation"
      aria-label="Navegação administrativa"
      className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-2 backdrop-blur"
    >
      <div ref={barraRef} className="mx-auto flex max-w-[1500px] items-center gap-2">
        <Link
          href="/"
          className="nx-edge-6 inline-flex h-9 shrink-0 items-center gap-2 px-3 font-mono text-[12px] tracking-[0.02em] text-muted-foreground transition-colors [--nx-edge:var(--border)] [--nx-fill:var(--card)] hover:text-foreground hover:[--nx-fill:var(--accent)]"
          aria-label="Voltar para o dashboard"
          data-nav-voltar
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Link>

        {visibleLinks.map((link) => (
          <AdminNavLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            active={isActive(link.href)}
            role="tab"
            aria-selected={isActive(link.href)}
            onKeyDown={(e) => handleTabKeyDown(e, visibleLinks)}
          />
        ))}

        {hasOverflowDropdown ? (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              role="tab"
              aria-selected={activeOverflow}
              aria-expanded={dropdownOpen}
              onClick={toggleDropdown}
              onBlur={(event) => {
                if (!dropdownRef.current?.contains(event.relatedTarget)) {
                  closeDropdown();
                }
              }}
              className={cn(
                "nx-edge-6 inline-flex h-9 shrink-0 items-center gap-2 px-3 font-mono text-[12px] tracking-[0.02em] transition-colors",
                activeOverflow
                  ? "text-foreground [--nx-edge:var(--primary)] [--nx-fill:var(--secondary)]"
                  : "text-muted-foreground [--nx-edge:var(--border)] [--nx-fill:var(--card)] hover:text-foreground hover:[--nx-fill:var(--accent)]",
              )}
            >
              Mais
              <ChevronDown className={cn("size-3.5 transition-transform", dropdownOpen && "rotate-180")} />
            </button>
            {dropdownOpen ? (
              /*
                A ELEVAÇÃO VAI NUM PAI NÃO RECORTADO.
                `box-shadow` externo não sobrevive ao `clip-path` — morre nas
                diagonais do chanfro. `filter: drop-shadow` no pai contorna a
                forma recortada do filho. É a mesma solução do `dropdown.tsx`.
              */
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[180px]"
                style={{ filter: "drop-shadow(0 8px 24px rgb(0 0 0 / 0.45))" }}
              >
              <div className={cn(
                "nx-edge-6 p-1 [--nx-edge:var(--border)] [--nx-fill:var(--card)]",
                dropdownClosing ? "animate-out fade-out-0 zoom-out-95" : "dropdown-expand",
              )}>
                {overflowLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="tab"
                    aria-selected={isActive(link.href)}
                    onClick={closeDropdown}
                    onKeyDown={(e) => handleTabKeyDown(e, overflowLinks)}
                    className={cn(
                      "nx-cut-5 flex items-center gap-2 px-3 py-2 font-mono text-[12px] tracking-[0.02em] transition-colors",
                      isActive(link.href)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <link.icon className="size-4" />
                    {link.label}
                  </Link>
                ))}
              </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
