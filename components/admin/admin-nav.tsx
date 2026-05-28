"use client";

import { BarChart3, FileSpreadsheet, Gauge, ListChecks, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 px-5 py-2 backdrop-blur" aria-label="Admin">
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto">
        {adminLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
