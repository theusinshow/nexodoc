"use client";

/**
 * Consumo de IA da conversa atual, vindo do banco (fonte única). Busca ao montar,
 * ao trocar de conversa, e sob `refresh()` — que quem termina um trabalho chama.
 *
 * Falha em silêncio: consumo é informação acessória, e um erro aqui não pode
 * virar ruído na conversa.
 */

import { useCallback, useEffect, useState } from "react";

import type { UsageSummary } from "@/server/nexo/usage/aggregate";

export function useConversationUsage(conversationId: string) {
  const [data, setData] = useState<UsageSummary | null>(null);

  const refresh = useCallback(() => {
    if (!conversationId) return;
    fetch(`/api/nexo/usage?conversationId=${encodeURIComponent(conversationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsageSummary | null) => setData(d))
      .catch(() => setData(null));
  }, [conversationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, refresh };
}
