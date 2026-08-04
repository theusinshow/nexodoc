"use client";

/**
 * Sidebar cheia do Nexo. Topo = voltar + marca; meio = Nova conversa + BUSCA +
 * Histórico agrupado em PASTAS por obra (código dos selos), recolhíveis; base =
 * Conta. Matte, calma (superfície de leitura). Persistência real (IndexedDB).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Folder,
  FolderKanban,
  Gauge,
  Plus,
  Compass,
  Search,
  Trash2,
  User,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationSummary } from "../lib/nexo-db";
import { groupConversations } from "../lib/group-conversations";
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
  isAdmin = false,
  onVerTour,
}: {
  onNewConversation?: () => void;
  conversations?: ConversationSummary[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Mostra o painel admin no rodapé. Vem da sessão, no server. */
  isAdmin?: boolean;
  /** Reabre o passo a passo guiado. Ausente = a entrada não aparece. */
  onVerTour?: () => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  /** Conversa aguardando confirmação de exclusão (uma por vez). */
  const [confirmando, setConfirmando] = useState<string | null>(null);
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
      {/* Topo: marca. Não há mais "voltar": a entrada do software é esta tela. */}
      <div className="flex items-center gap-2 px-1 py-1">
        <NexoOrb className="w-5" />
        <span className="font-mono text-sm font-semibold tracking-[-0.01em]">
          Nexo
        </span>
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
          /* Diz ONDE buscou. Só "nada encontrado" faz o engenheiro duvidar se
             digitou errado, quando o problema pode ser o campo que não é
             coberto pela busca. */
          <p className="px-2 py-3 text-center text-xs leading-5 text-muted-foreground">
            Nenhuma conversa com “{query}”.
            <br />A busca cobre o título da obra e o código do projeto.
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
                    {onDelete &&
                      (confirmando === c.id ? (
                        /*
                         * Confirmação INLINE, não modal (DESIGN.md: modal é o
                         * último recurso). Apagar a conversa leva os documentos
                         * gerados junto — um clique sem volta ao lado do nome
                         * era perda de trabalho a um pixel de distância.
                         */
                        <span className="absolute right-1 top-1 flex items-center gap-1 rounded-sm border border-[var(--status-critical)]/40 bg-card px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(c.id);
                              setConfirmando(null);
                            }}
                            className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--status-critical)] hover:underline focus-visible:outline-none"
                          >
                            Apagar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmando(null)}
                            aria-label="Cancelar"
                            className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground focus-visible:outline-none"
                          >
                            Não
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmando(c.id)}
                          aria-label={`Apagar conversa ${c.title}`}
                          className="absolute right-1.5 top-1.5 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none group-hover/c:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>

      {/*
        Rodapé: o resto do software. Projetos é destino de trabalho; ferramentas
        antigas é saída de emergência e por isso vem menor e por último — visível
        para quem procura, sem competir com o caminho bom.
      */}
      <div className="flex flex-col gap-0.5 border-t border-border/60 pt-2">
        <Link
          href="/projetos"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <FolderKanban className="h-4 w-4 shrink-0" aria-hidden />
          Projetos
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Gauge className="h-4 w-4 shrink-0" aria-hidden />
            Painel admin
          </Link>
        )}
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <User className="h-4 w-4 shrink-0" aria-hidden />
          Conta
        </button>
        {onVerTour && (
          <button
            type="button"
            onClick={() => void onVerTour()}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Compass className="h-4 w-4 shrink-0" aria-hidden />
            Como funciona
          </button>
        )}
        {/* Cor de legado no rótulo: presente sem chamar. Nem status, nem
            desabilitado — a ferramenta funciona, só não é o caminho novo. */}
        <Link
          href="/ferramentas"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--legacy)]/80 transition-colors hover:bg-accent hover:text-[var(--legacy)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ferramentas antigas
        </Link>
      </div>
    </aside>
  );
}
