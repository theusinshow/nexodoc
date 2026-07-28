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
import type {
  LdPreviewData,
  NexoAgentProposal,
  NexoArtifactKind,
  NexoChatMessage,
  NexoSlotRequest,
} from "../types";
import { summarizeSelos } from "../lib/agent-context";
import { aplicarAjuste, type Ajuste, type FolhaId } from "../lib/folhas";
import { removerResultado } from "../lib/results";
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
  canvas?: { label: string; detail?: string; titulo?: string; pageNumber?: number };
  files: SavedFile[];
  payload?: unknown;
}

/** Entrada de `saveResult`: os arquivos vêm como object URLs (o card já os tem). */
export interface SaveResultInput {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  canvas?: { label: string; detail?: string; titulo?: string; pageNumber?: number };
  files: { label: string; name: string; mime: string; url: string; primary?: boolean }[];
  payload?: unknown;
}

interface ConversationStoreValue {
  conversationId: string;
  title: string;
  messages: NexoChatMessage[];
  seloResults: SeloResult[];
  /** O que o usuário mudou à mão nas folhas. Vazio = a projeção é a identidade. */
  ajustes: Record<FolhaId, Ajuste>;
  /** Lista de conversas (resumos), mais recentes primeiro. */
  conversations: ConversationSummary[];
  /** Resultados gerados (com URLs vivas) — reidratados do IndexedDB no restore. */
  results: SavedResult[];
  appendMessage: (m: NexoChatMessage) => void;
  /** Faz a última mensagem crescer (streaming). NÃO persiste — só memória. */
  appendDelta: (id: string, text: string) => void;
  /** Fecha o turno transmitido e persiste de uma vez. */
  finalizeMessage: (
    id: string,
    patch: {
      proposals?: NexoAgentProposal[];
      slotRequest?: NexoSlotRequest;
      ldPreview?: LdPreviewData;
      interrupted?: boolean;
    },
  ) => void;
  setSeloResults: (r: SeloResult[]) => void;
  /** Acumula um ajuste numa folha. Campo `undefined` no patch DESFAZ aquele campo. */
  ajustarFolha: (id: FolhaId, patch: Ajuste) => void;
  /** Persiste um resultado gerado (blobs no IndexedDB) e o expõe reidratado. */
  saveResult: (input: SaveResultInput) => Promise<void>;
  /** Lê um resultado já gerado (nesta sessão ou restaurado). */
  getResult: (artifactId: string) => SavedResult | undefined;
  /**
   * Remove um resultado gerado: some do canvas (o espelho é automático) e deixa
   * de entrar no volume. O card volta ao estado de proposta, então regerar é um
   * clique. Os blobs no IndexedDB ficam — o que importa é sair do estado.
   */
  removeResult: (artifactId: string) => void;
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

/** Chave da pasta = código da obra dominante dos selos (agrupa a sidebar). */
function deriveFolderKey(seloResults: SeloResult[]): string | undefined {
  if (seloResults.length === 0) return undefined;
  const facts = seloResults.map((r) => ({
    fileName: r.fileName,
    arquivo: r.extraction?.arquivo ?? null,
    disciplina: r.extraction?.disciplina ?? null,
    obra: r.extraction?.obra ?? null,
  }));
  return summarizeSelos(facts).codigo ?? undefined;
}

export function ConversationStoreProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string>(() => newId());
  const [title, setTitle] = useState("Nova conversa");
  const [messages, setMessages] = useState<NexoChatMessage[]>([]);
  const [seloResults, setSeloResultsState] = useState<SeloResult[]>([]);
  const [ajustes, setAjustes] = useState<Record<FolhaId, Ajuste>>({});
  const [results, setResults] = useState<SavedResult[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // Snapshot mais novo p/ o persist debounced (evita closure velha). Sincronizado
  // num effect — o React Compiler proíbe tocar ref.current durante o render.
  const snapshotRef = useRef({
    conversationId,
    title,
    messages,
    seloResults,
    ajustes,
    results,
    createdAt: 0,
  });
  useEffect(() => {
    snapshotRef.current = {
      ...snapshotRef.current,
      conversationId,
      title,
      messages,
      seloResults,
      ajustes,
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grava o snapshot atual AGORA (base do debounce E do flush ao trocar conversa).
  const persistNow = useCallback(() => {
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
    const folderKey = deriveFolderKey(s.seloResults);
    const rec: StoredConversation = {
      id: s.conversationId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: Date.now(),
      ...(folderKey ? { folderKey } : {}),
      messages: s.messages,
      seloResults: s.seloResults,
      ...(Object.keys(s.ajustes).length > 0 ? { ajustes: s.ajustes } : {}),
      results: resultsMeta,
    };
    putConversation(rec)
      .then(refreshList)
      .catch(() => {});
  }, [refreshList]);

  // Debounce: grava 500ms após a última mudança.
  const schedulePersist = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
  }, [persistNow]);

  // Flush: grava JÁ, antes de trocar/limpar a conversa. Sem isso, um debounce
  // pendente seria CANCELADO e a última mudança se perderia (bug #1 da revisão).
  const flushPersist = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    persistNow();
  }, [persistNow]);

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

  // Crescimento por delta: mexe SÓ no estado em memória. Persistir a cada token
  // viraria centenas de gravações no IndexedDB por resposta — o `finalizeMessage`
  // grava uma vez, no fim.
  const appendDelta = useCallback((id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
    );
  }, []);

  const finalizeMessage = useCallback(
    (
      id: string,
      patch: {
        proposals?: NexoAgentProposal[];
        slotRequest?: NexoSlotRequest;
        ldPreview?: LdPreviewData;
        interrupted?: boolean;
      },
    ) => {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
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

  /*
   * ÚNICO escritor de ajustes. `aplicarAjuste` é puro e já testado: acumula sem
   * mutar, e apaga a entrada quando o ajuste fica vazio — desfazer não pode
   * deixar lixo ocupando o estado.
   */
  const ajustarFolha = useCallback(
    (id: FolhaId, patch: Ajuste) => {
      setAjustes((prev) => aplicarAjuste(prev, id, patch));
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
        // Regerar o mesmo artefato → revoga os URLs antigos antes de trocar (#4).
        prev[i].files.forEach((f) => URL.revokeObjectURL(f.url));
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

  const removeResult = useCallback(
    (artifactId: string) => {
      setResults((prev) => {
        const { restantes, removido } = removerResultado(prev, artifactId);
        // Revoga as URLs do que saiu: sem isto cada exclusão deixa um blob preso
        // na memória da aba, e o vazamento é invisível.
        removido?.files.forEach((f) => URL.revokeObjectURL(f.url));
        return restantes;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const newConversation = useCallback(() => {
    flushPersist(); // grava a conversa atual antes de largar (#1)
    setConversationId(newId());
    setTitle("Nova conversa");
    setMessages([]);
    setSeloResultsState([]);
    setAjustes({});
    // Revoga os object URLs dos resultados antes de largar (evita vazamento).
    setResults((prev) => {
      prev.forEach((r) => r.files.forEach((f) => URL.revokeObjectURL(f.url)));
      return [];
    });
    snapshotRef.current.createdAt = Date.now();
  }, [flushPersist]);

  const selectConversation = useCallback(
    async (id: string): Promise<StoredConversation | null> => {
      flushPersist(); // grava a conversa atual antes de trocar (#1)
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
      // Conversa gravada antes deste campo existir não tem `ajustes`.
      setAjustes(rec.ajustes ?? {});
      // Revoga os URLs da conversa anterior antes de trocar (evita vazamento).
      setResults((prev) => {
        prev.forEach((r) => r.files.forEach((f) => URL.revokeObjectURL(f.url)));
        return restored;
      });
      snapshotRef.current.createdAt = rec.createdAt;
      return rec;
    },
    [flushPersist],
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
      ajustes,
      conversations,
      results,
      appendMessage,
      appendDelta,
      finalizeMessage,
      setSeloResults,
      ajustarFolha,
      saveResult,
      getResult,
      removeResult,
      newConversation,
      selectConversation,
      removeConversation,
    }),
    [
      conversationId,
      title,
      messages,
      seloResults,
      ajustes,
      conversations,
      results,
      appendMessage,
      appendDelta,
      finalizeMessage,
      setSeloResults,
      ajustarFolha,
      saveResult,
      getResult,
      removeResult,
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
