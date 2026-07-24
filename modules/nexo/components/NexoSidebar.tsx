"use client";

/**
 * Sidebar cheia do Nexo. Topo = voltar + marca; meio = Nova conversa + BUSCA +
 * Histórico agrupado em PASTAS por obra (código dos selos), recolhíveis; base =
 * Conta. Matte, calma (superfície de leitura). Persistência real (IndexedDB).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, User, Trash2, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationSummary } from "../lib/nexo-db";
import { NexoOrb } from "./NexoOrb";

/** Data curta pt-BR (hoje → hora; senão → dd/mm). Sem libs. */
function shortDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface Group {
  key: string | null;
  items: ConversationSummary[];
}

/** Filtra por título e agrupa por pasta, preservando a ordem por recência. */
function groupConversations(
  conversations: ConversationSummary[],
  query: string,
): Group[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? conversations.filter((c) => c.title.toLowerCase().includes(q))
    : conversations;
  const groups: Group[] = [];
  const index = new Map<string, number>();
  for (const c of filtered) {
    const key = c.folderKey ?? null;
    const mapKey = key ?? "__none__";
    let gi = index.get(mapKey);
    if (gi === undefined) {
      gi = groups.length;
      index.set(mapKey, gi);
      groups.push({ key, items: [] });
    }
    groups[gi].items.push(c);
  }
  return groups;
}

export function NexoSidebar({
  onNewConversation,
  conversations = [],
  activeId,
  onSelect,
  onDelete,
}: {
  onNewConversation?: () => void;
  conversations?: ConversationSummary[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () => groupConversations(conversations, query),
    [conversations, query],
  );
  const empty = conversations.length === 0;
  const noMatch = !empty && groups.length === 0;

  return (
    <aside
      aria-label="Navegação do Nexo"
      className="flex h-full w-full flex-col gap-3 border-r border-border/60 p-3"
    >
      {/* Topo: voltar + marca */}
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Painel de módulos
        </Link>
        <div className="flex items-center gap-2 px-1">
          <NexoOrb className="w-5" />
          <span className="font-mono text-sm font-semibold tracking-[-0.01em]">
            Nexo
          </span>
        </div>
      </div>

      {/* Nova conversa */}
      <button
        type="button"
        onClick={onNewConversation}
        className="flex items-center gap-2 rounded-md bg-[var(--nexodoc-recessed)] px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        Nova conversa
      </button>

      {/* Busca */}
      {!empty && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas…"
            aria-label="Buscar conversas"
            className="h-8 w-full rounded-md bg-[var(--nexodoc-recessed)] pl-8 pr-2 font-mono text-xs text-foreground outline-none transition-[box-shadow,border-color] placeholder:font-sans placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/20"
          />
        </div>
      )}

      {/* Histórico agrupado por pasta */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {empty && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 px-3 text-center">
            <p className="text-xs text-muted-foreground">
              Sem histórico ainda. Suas conversas e volumes ficam salvos aqui.
            </p>
          </div>
        )}
        {noMatch && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nada encontrado para “{query}”.
          </p>
        )}
        {groups.map((g) => (
          <details key={g.key ?? "__none__"} open className="group/f">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent/60 [&::-webkit-details-marker]:hidden">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3 w-3 shrink-0 transition-transform duration-200 group-open/f:rotate-90"
                aria-hidden
              >
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="flex-1 truncate font-mono text-[11px] tracking-[0.02em]">
                {g.key ?? "Sem pasta"}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {g.items.length}
              </span>
            </summary>
            <ul className="flex flex-col gap-px py-0.5 pl-5">
              {g.items.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className="group/c relative">
                    <button
                      type="button"
                      onClick={() => onSelect?.(c.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 pr-8 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <span className="w-full truncate text-[12.5px]">{c.title}</span>
                      <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
                        {shortDate(c.updatedAt)}
                      </span>
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        aria-label={`Apagar conversa ${c.title}`}
                        className="absolute right-1.5 top-1.5 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none group-hover/c:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>

      {/* Conta */}
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Conta
      </button>
    </aside>
  );
}
