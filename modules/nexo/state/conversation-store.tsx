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
import type { NexoArtifactKind, NexoChatMessage } from "../types";
import {
  deleteConversation as dbDelete,
  getBlob,
  getConversation,
  listConversations,
  putBlob,
  putConversation,
  type ConversationSummary,
  type StoredConversation,
  type StoredResultMeta,
} from "../lib/nexo-db";

/** Um arquivo de resultado com object URL vivo (p/ download/preview). */
export interface SavedFile {
  label: string;
  name: string;
  mime: string;
  url: string;
  /** Chave no store de blobs (persistência/reidratação). */
  blobKey: string;
  primary?: boolean;
}

/** Resultado gerado (com URLs vivas) — reidratado do IndexedDB no restore. */
export interface SavedResult {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  canvas?: { label: string; detail?: string; pageNumber?: number };
  files: SavedFile[];
  payload?: unknown;
}

/** Entrada de `saveResult`: os arquivos vêm como object URLs (o card já os tem). */
export interface SaveResultInput {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  canvas?: { label: string; detail?: string; pageNumber?: number };
  files: { label: string; name: string; mime: string; url: string; primary?: boolean }[];
  payload?: unknown;
}

interface ConversationStoreValue {
  conversationId: string;
  title: string;
  messages: NexoChatMessage[];
  seloResults: SeloResult[];
  /** Lista de conversas (resumos), mais recentes primeiro. */
  conversations: ConversationSummary[];
  /** Resultados gerados (com URLs vivas) — reidratados do IndexedDB no restore. */
  results: SavedResult[];
  appendMessage: (m: NexoChatMessage) => void;
  setSeloResults: (r: SeloResult[]) => void;
  /** Persiste um resultado gerado (blobs no IndexedDB) e o expõe reidratado. */
  saveResult: (input: SaveResultInput) => Promise<void>;
  /** Lê um resultado já gerado (nesta sessão ou restaurado). */
  getResult: (artifactId: string) => SavedResult | undefined;
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
  const [results, setResults] = useState<SavedResult[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // Snapshot mais novo p/ o persist debounced (evita closure velha). Sincronizado
  // num effect — o React Compiler proíbe tocar ref.current durante o render.
  const snapshotRef = useRef({ conversationId, title, messages, seloResults, results, createdAt: 0 });
  useEffect(() => {
    snapshotRef.current = {
      ...snapshotRef.current,
      conversationId,
      title,
      messages,
      seloResults,
      results,
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
      if (s.messages.length === 0 && s.seloResults.length === 0 && s.results.length === 0) {
        return;
      }
      const resultsMeta: StoredResultMeta[] = s.results.map((r) => ({
        artifactId: r.artifactId,
        kind: r.kind,
        summary: r.summary,
        ...(r.canvas ? { canvas: r.canvas } : {}),
        files: r.files.map((f) => ({
          label: f.label,
          name: f.name,
          mime: f.mime,
          blobKey: f.blobKey,
          ...(f.primary ? { primary: true } : {}),
        })),
        ...(r.payload !== undefined ? { payload: r.payload } : {}),
      }));
      const rec: StoredConversation = {
        id: s.conversationId,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: Date.now(),
        messages: s.messages,
        seloResults: s.seloResults,
        results: resultsMeta,
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

  // Persiste os blobs de um resultado e o expõe reidratado (URLs vivas).
  const saveResult = useCallback(
    async (input: SaveResultInput) => {
      const convId = snapshotRef.current.conversationId;
      const files: SavedFile[] = [];
      for (const f of input.files) {
        const blobKey = `${convId}:${input.artifactId}:${f.label}`;
        try {
          const blob = await fetch(f.url).then((r) => r.blob());
          await putBlob(blobKey, blob);
        } catch {
          /* persistência é best-effort; o download da sessão segue válido */
        }
        files.push({
          label: f.label,
          name: f.name,
          mime: f.mime,
          url: f.url,
          blobKey,
          ...(f.primary ? { primary: true } : {}),
        });
      }
      const saved: SavedResult = {
        artifactId: input.artifactId,
        kind: input.kind,
        summary: input.summary,
        ...(input.canvas ? { canvas: input.canvas } : {}),
        files,
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      };
      setResults((prev) => {
        const i = prev.findIndex((r) => r.artifactId === saved.artifactId);
        if (i === -1) return [...prev, saved];
        const next = [...prev];
        next[i] = saved;
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const getResult = useCallback(
    (artifactId: string) => results.find((r) => r.artifactId === artifactId),
    [results],
  );

  const newConversation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConversationId(newId());
    setTitle("Nova conversa");
    setMessages([]);
    setSeloResultsState([]);
    setResults([]);
    snapshotRef.current.createdAt = Date.now();
  }, []);

  const selectConversation = useCallback(
    async (id: string): Promise<StoredConversation | null> => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const rec = await getConversation(id);
      if (!rec) return null;
      // Reidrata os resultados: busca cada blob e cria URLs vivas.
      const restored: SavedResult[] = [];
      for (const meta of rec.results) {
        const files: SavedFile[] = [];
        for (const fm of meta.files) {
          const blob = await getBlob(fm.blobKey);
          if (!blob) continue;
          files.push({
            label: fm.label,
            name: fm.name,
            mime: fm.mime,
            url: URL.createObjectURL(blob),
            blobKey: fm.blobKey,
            ...(fm.primary ? { primary: true } : {}),
          });
        }
        restored.push({
          artifactId: meta.artifactId,
          kind: meta.kind,
          summary: meta.summary,
          ...(meta.canvas ? { canvas: meta.canvas } : {}),
          files,
          ...(meta.payload !== undefined ? { payload: meta.payload } : {}),
        });
      }
      setConversationId(rec.id);
      setTitle(rec.title);
      setMessages(rec.messages);
      setSeloResultsState(rec.seloResults);
      setResults(restored);
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
      results,
      appendMessage,
      setSeloResults,
      saveResult,
      getResult,
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
      results,
      appendMessage,
      setSeloResults,
      saveResult,
      getResult,
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
