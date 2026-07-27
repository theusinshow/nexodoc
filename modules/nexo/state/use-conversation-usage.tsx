"use client";

/**
 * Consumo de IA da conversa atual, vindo do banco (fonte única). Busca ao montar,
 * ao trocar de conversa, e sob `refresh()` — que quem termina um trabalho chama.
 *
 * Provider (não hook solto): antes cada consumidor (`NexoChat`, `ConfirmationCard`)
 * instanciava seu PRÓPRIO `useState` — o `refresh()` do card atualizava um estado
 * que nada renderiza (o anel é o do NexoChat), e o card ainda disparava um GET
 * OCIOSO a cada montagem. Uma ÚNICA instância, montada no `NexoWorkspace` junto
 * dos outros providers da conversa, resolve os dois: todo mundo lê o MESMO estado
 * e chama o MESMO `refresh`.
 *
 * Falha em silêncio: consumo é informação acessória, e um erro aqui não pode
 * virar ruído na conversa.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { UsageSummary } from "@/server/nexo/usage/aggregate";
import { useConversation } from "./conversation-store";

interface ConversationUsageValue {
  data: UsageSummary | null;
  refresh: () => void;
}

const ConversationUsageContext = createContext<ConversationUsageValue | null>(null);

export function ConversationUsageProvider({ children }: { children: ReactNode }) {
  const { conversationId } = useConversation();
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

  const value = useMemo(() => ({ data, refresh }), [data, refresh]);

  return (
    <ConversationUsageContext.Provider value={value}>
      {children}
    </ConversationUsageContext.Provider>
  );
}

/** Lê o consumo compartilhado. Lança fora do provider (uso deliberado no workspace). */
export function useConversationUsage(): ConversationUsageValue {
  const ctx = useContext(ConversationUsageContext);
  if (!ctx) {
    throw new Error(
      "useConversationUsage precisa estar dentro de <ConversationUsageProvider>.",
    );
  }
  return ctx;
}
