/**
 * Persistência local das conversas do Nexo (IndexedDB, sem dependência nova).
 * HEADLESS: só IO + tipos serializáveis — a UI (conversation-store, sidebar) fica
 * por cima. Guarda o DURÁVEL de cada conversa; os arquivos de ENTRADA
 * (pranchas/memorial) NÃO entram aqui (decisão: só os gerados persistem).
 *
 * Dois stores (v1):
 * - `conversations` (LEVE, keyPath id): metadados + mensagens + selos + META dos
 *   resultados. Tudo JSON — a lista da sidebar carrega rápido, sem blobs.
 * - `result_blobs` (keyPath key): os Blobs dos documentos gerados, fora do
 *   registro leve. IndexedDB guarda Blob nativamente (sobrevive ao reload).
 */
import type { SeloResult } from "./selo-render";
import type { NexoArtifactKind, NexoChatMessage } from "../types";

const DB_NAME = "nexo";
const DB_VERSION = 1;
const STORE_CONVERSATIONS = "conversations";
const STORE_BLOBS = "result_blobs";

/** Metadados de um arquivo gerado (o Blob mora no store `result_blobs`). */
export interface StoredFileMeta {
  label: string;
  name: string;
  mime: string;
  /** Chave no store de blobs: `${convId}:${artifactId}:${label}`. */
  blobKey: string;
  primary?: boolean;
}

/** Metadados de um resultado gerado (sem os bytes). */
export interface StoredResultMeta {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  /** Metadados leves p/ o canvas (miniatura). */
  canvas?: { label: string; detail?: string; pageNumber?: number };
  files: StoredFileMeta[];
}

/** Registro LEVE de uma conversa (sem blobs). */
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: NexoChatMessage[];
  seloResults: SeloResult[];
  results: StoredResultMeta[];
}

/** Resumo p/ a lista da sidebar (sem carregar mensagens/blobs). */
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        const store = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponível."));
  });
  return dbPromise;
}

/** Promisifica uma IDBRequest. */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha no IndexedDB."));
  });
}

/** Grava (upsert) uma conversa. Não toca nos blobs (esses vão por `putBlob`). */
export async function putConversation(conv: StoredConversation): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_CONVERSATIONS, "readwrite");
  tx.objectStore(STORE_CONVERSATIONS).put(conv);
  await txDone(tx);
}

/** Lê uma conversa completa (mensagens + selos + meta dos resultados). */
export async function getConversation(id: string): Promise<StoredConversation | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_CONVERSATIONS, "readonly");
  const rec = await reqToPromise(tx.objectStore(STORE_CONVERSATIONS).get(id));
  return (rec as StoredConversation) ?? null;
}

/** Lista os resumos das conversas, mais recentes primeiro. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_CONVERSATIONS, "readonly");
  const all = (await reqToPromise(
    tx.objectStore(STORE_CONVERSATIONS).getAll(),
  )) as StoredConversation[];
  return all
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, createdAt: c.createdAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Apaga uma conversa e todos os seus blobs. */
export async function deleteConversation(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_CONVERSATIONS, STORE_BLOBS], "readwrite");
  tx.objectStore(STORE_CONVERSATIONS).delete(id);
  // Blobs têm key `${id}:...` — varre por range de prefixo.
  const blobStore = tx.objectStore(STORE_BLOBS);
  const range = IDBKeyRange.bound(`${id}:`, `${id}:￿`);
  const cursorReq = blobStore.openCursor(range);
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  await txDone(tx);
}

/** Grava um Blob de resultado. */
export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, "readwrite");
  tx.objectStore(STORE_BLOBS).put({ key, blob });
  await txDone(tx);
}

/** Lê um Blob de resultado (ou null). */
export async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, "readonly");
  const rec = (await reqToPromise(tx.objectStore(STORE_BLOBS).get(key))) as
    | { key: string; blob: Blob }
    | undefined;
  return rec?.blob ?? null;
}

/** Resolve quando a transação commita (ou rejeita no erro/abort). */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Transação falhou."));
    tx.onabort = () => reject(tx.error ?? new Error("Transação abortada."));
  });
}
