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

const adminLinks = [
  { href: "/admin", label: "Visão geral", icon: Gauge },
  { href: "/admin/users", label: "Usuários", icon: UsersRound },
  { href: "/admin/lds", label: "LDs", icon: FileSpreadsheet },
  { href: "/admin/audits", label: "Auditorias", icon: ListChecks },
  { href: "/admin/usage", label: "Consumo", icon: BarChart3 },
  { href: "/admin/quality", label: "Qualidade", icon: ShieldCheck },
  { href: "/admin/config", label: "Config", icon: Settings2 },
] as const;

const VISIBLE_COUNT = 4;

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
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
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

  const isActive = (href: string) => pathname === href;
  const visibleLinks = adminLinks.slice(0, VISIBLE_COUNT);
  const overflowLinks = adminLinks.slice(VISIBLE_COUNT);
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
      <div className="mx-auto flex max-w-[1500px] items-center gap-2">
        <Link
          href="/"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Voltar para o dashboard"
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
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition",
                activeOverflow
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Mais
              <ChevronDown className={cn("size-3.5 transition-transform", dropdownOpen && "rotate-180")} />
            </button>
            {dropdownOpen ? (
              <div className={cn(
                "absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-panel",
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
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                      isActive(link.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <link.icon className="size-4" />
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
