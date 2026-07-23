"use client";

/**
 * Sidebar cheia do Nexo (nova direção de layout, 2026-07-23). Full-height,
 * sempre visível (welcome e active): topo = voltar + marca; meio = Nova conversa
 * + Histórico; base = Conta.
 *
 * Histórico é PLACEHOLDER nesta rodada (a persistência real — IndexedDB, itens por
 * data — é v1.5). O slot já existe pra não retrabalhar o layout depois.
 */

import Link from "next/link";
import { ArrowLeft, Plus, Clock, User } from "lucide-react";

import { NexoOrb } from "./NexoOrb";

export function NexoSidebar({
  onNewConversation,
}: {
  onNewConversation?: () => void;
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

      {/* Histórico (placeholder até a persistência) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
        <p className="flex items-center gap-1.5 px-1 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Histórico
        </p>
        <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-border px-3 text-center">
          <p className="text-xs text-muted-foreground">
            Sem histórico ainda. Suas conversas e volumes ficam salvos aqui em
            breve.
          </p>
        </div>
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
