"use client";

/**
 * Store HEADLESS da conversa ativa + histórico (item 4). Fonte única do DURÁVEL:
 * mensagens + selos lidos + (4B) resultados gerados. Persiste debounced no
 * IndexedDB (lib/nexo-db.ts) e serve a lista de conversas p/ a sidebar.
 *
 * Só o durável mora aqui — os arquivos de ENTRADA (pranchas/memorial) seguem
 * efêmeros no NexoWorkspace (não persistem). A refatoração de UI vem por cima
 * sem tocar nesta camada.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { SeloResult } from "../lib/selo-render";
import type { NexoChatMessage } from "../types";
import {
  deleteConversation as dbDelete,
  getConversation,
  listConversations,
  putConversation,
  type ConversationSummary,
  type StoredConversation,
} from "../lib/nexo-db";

interface ConversationStoreValue {
  conversationId: string;
  title: string;
  messages: NexoChatMessage[];
  seloResults: SeloResult[];
  /** Lista de conversas (resumos), mais recentes primeiro. */
  conversations: ConversationSummary[];
  appendMessage: (m: NexoChatMessage) => void;
  setSeloResults: (r: SeloResult[]) => void;
  newConversation: () => void;
  /** Carrega uma conversa; devolve o registro (p/ o dono restaurar o shell). */
  selectConversation: (id: string) => Promise<StoredConversation | null>;
  removeConversation: (id: string) => Promise<void>;
}

const ConversationStoreContext = createContext<ConversationStoreValue | null>(null);

const PERSIST_DEBOUNCE_MS = 500;

/** Título derivado: obra do selo > 1ª mensagem do usuário > "Nova conversa". */
function deriveTitle(
  current: string,
  messages: NexoChatMessage[],
  seloResults: SeloResult[],
): string {
  const obra = seloResults.find((r) => r.extraction?.obra?.trim())?.extraction?.obra?.trim();
  if (obra) return obra.length > 60 ? `${obra.slice(0, 57)}…` : obra;
  const firstUser = messages.find((m) => m.role === "user")?.content.trim();
  if (firstUser) return firstUser.length > 48 ? `${firstUser.slice(0, 45)}…` : firstUser;
  return current || "Nova conversa";
}

function newId(): string {
  return crypto.randomUUID();
}

export function ConversationStoreProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string>(() => newId());
  const [title, setTitle] = useState("Nova conversa");
  const [messages, setMessages] = useState<NexoChatMessage[]>([]);
  const [seloResults, setSeloResultsState] = useState<SeloResult[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // Snapshot mais novo p/ o persist debounced (evita closure velha). Sincronizado
  // num effect — o React Compiler proíbe tocar ref.current durante o render.
  const snapshotRef = useRef({ conversationId, title, messages, seloResults, createdAt: 0 });
  useEffect(() => {
    snapshotRef.current = {
      ...snapshotRef.current,
      conversationId,
      title,
      messages,
      seloResults,
      createdAt: snapshotRef.current.createdAt || Date.now(),
    };
  });

  const refreshList = useCallback(() => {
    listConversations()
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Persistência debounced: só grava conversa COM conteúdo (não cria registro vazio).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const s = snapshotRef.current;
      if (s.messages.length === 0 && s.seloResults.length === 0) return;
      const rec: StoredConversation = {
        id: s.conversationId,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: Date.now(),
        messages: s.messages,
        seloResults: s.seloResults,
        results: [],
      };
      putConversation(rec)
        .then(refreshList)
        .catch(() => {});
    }, PERSIST_DEBOUNCE_MS);
  }, [refreshList]);

  const appendMessage = useCallback(
    (m: NexoChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, m];
        setTitle((t) => deriveTitle(t, next, snapshotRef.current.seloResults));
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const setSeloResults = useCallback(
    (r: SeloResult[]) => {
      setSeloResultsState(r);
      setTitle((t) => deriveTitle(t, snapshotRef.current.messages, r));
      schedulePersist();
    },
    [schedulePersist],
  );

  const newConversation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConversationId(newId());
    setTitle("Nova conversa");
    setMessages([]);
    setSeloResultsState([]);
    snapshotRef.current.createdAt = Date.now();
  }, []);

  const selectConversation = useCallback(
    async (id: string): Promise<StoredConversation | null> => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const rec = await getConversation(id);
      if (!rec) return null;
      setConversationId(rec.id);
      setTitle(rec.title);
      setMessages(rec.messages);
      setSeloResultsState(rec.seloResults);
      snapshotRef.current.createdAt = rec.createdAt;
      return rec;
    },
    [],
  );

  const removeConversation = useCallback(
    async (id: string) => {
      await dbDelete(id);
      refreshList();
    },
    [refreshList],
  );

  const value = useMemo<ConversationStoreValue>(
    () => ({
      conversationId,
      title,
      messages,
      seloResults,
      conversations,
      appendMessage,
      setSeloResults,
      newConversation,
      selectConversation,
      removeConversation,
    }),
    [
      conversationId,
      title,
      messages,
      seloResults,
      conversations,
      appendMessage,
      setSeloResults,
      newConversation,
      selectConversation,
      removeConversation,
    ],
  );

  return (
    <ConversationStoreContext.Provider value={value}>
      {children}
    </ConversationStoreContext.Provider>
  );
}

/** Lê o store da conversa. Lança fora do provider (uso deliberado no workspace). */
export function useConversation(): ConversationStoreValue {
  const ctx = useContext(ConversationStoreContext);
  if (!ctx) {
    throw new Error("useConversation precisa estar dentro de <ConversationStoreProvider>.");
  }
  return ctx;
}
