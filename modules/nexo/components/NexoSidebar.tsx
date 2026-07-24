"use client";

/**
 * Sidebar cheia do Nexo. Topo = voltar + marca; meio = Nova conversa +
 * Histórico (lista real, persistida no IndexedDB — item 4); base = Conta.
 */

import Link from "next/link";
import { ArrowLeft, Plus, Clock, User, Trash2 } from "lucide-react";

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
  return (
    <aside
      aria-label="Navegação do Nexo"
      className="flex h-full w-full flex-col gap-3 rounded-md border border-border bg-card p-3"
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
        className="flex items-center gap-2 rounded-sm border border-border bg-[var(--nexodoc-recessed)] px-2.5 py-2 text-sm text-foreground transition-colors hover:border-ring hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        Nova conversa
      </button>

      {/* Histórico */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
        <p className="flex items-center gap-1.5 px-1 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Histórico
        </p>

        {conversations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-border px-3 text-center">
            <p className="text-xs text-muted-foreground">
              Sem histórico ainda. Suas conversas e volumes ficam salvos aqui.
            </p>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect?.(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-sm px-2.5 py-2 pr-8 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <span className="w-full truncate text-sm">{c.title}</span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {shortDate(c.updatedAt)}
                    </span>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      aria-label={`Apagar conversa ${c.title}`}
                      className="absolute right-1.5 top-1.5 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Conta */}
      <button
        type="button"
        className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Conta
      </button>
    </aside>
  );
}
