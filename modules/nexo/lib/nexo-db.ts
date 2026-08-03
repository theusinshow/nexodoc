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
import type { Ajuste, FolhaId } from "./folhas";
import type { IdentidadeDoProjeto } from "./identidade";
import type { NexoArtifactKind, NexoChatMessage, NexoDossieDraft } from "../types";

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
  /** Tamanho em bytes. Opcional: registros antigos não têm. */
  sizeBytes?: number;
}

/** Metadados de um resultado gerado (sem os bytes). */
export interface StoredResultMeta {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  /** Metadados leves p/ o canvas (miniatura). */
  canvas?: { label: string; detail?: string; titulo?: string; pageNumber?: number };
  files: StoredFileMeta[];
  /** Resultado JSON de análises SEM arquivo (conferência/auditoria). */
  payload?: unknown;
  /**
   * QUANDO o documento foi gerado. É o que permite dizer "gerada há 42 min"
   * quando os parâmetros mudam depois: sem isso, o card sabe que o arquivo na
   * mão do engenheiro envelheceu, mas não sabe dizer de quando ele é — e "está
   * velho" sem idade é um aviso que não ajuda a decidir.
   *
   * Opcional: registros gravados antes desta versão não têm (schemaless).
   */
  generatedAt?: number;
}

/** Registro LEVE de uma conversa (sem blobs). */
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Chave da pasta = código da obra (dos selos). Agrupa na sidebar. */
  folderKey?: string;
  messages: NexoChatMessage[];
  seloResults: SeloResult[];
  /**
   * O que o usuário mudou à mão nas folhas (título etc.). OPCIONAL: conversas
   * gravadas antes desta versão não têm o campo, e ausente = nenhum ajuste. Por
   * isso não há migração de `DB_VERSION` — o registro é schemaless.
   */
  ajustes?: Record<FolhaId, Ajuste>;
  /**
   * Ids das folhas criadas à mão (prancha que não foi lida). Só os ids: o
   * conteúdo delas mora em `ajustes`, como o de qualquer folha.
   *
   * Opcional, como `ajustes`.
   */
  avulsas?: FolhaId[];
  /**
   * Total de folhas de cada disciplina, dito por uma pessoa — o "24" de "05/24".
   * Chave = código de três letras do escritório (`his`, `arq`…).
   *
   * Opcional, como `ajustes`.
   */
  totaisPorDisciplina?: Record<string, number>;
  /**
   * Órgão, secretaria, obra, fase, código e revisão ditos por uma pessoa — o
   * escape de quando o carimbo mente. Vale para a conversa: capa e LD imprimem
   * os mesmos fatos.
   *
   * Opcional, como `ajustes`.
   */
  identidade?: IdentidadeDoProjeto;
  /**
   * Quantos tomos o usuário declarou pelo canvas. Existe para a fileira do tomo
   * novo nascer VAZIA, antes de haver documento nela — sem fileira não há para
   * onde arrastar folha.
   */
  tomosDeclarados?: number;
  /**
   * Achados de auditoria que o engenheiro já corrigiu, por `auditId`.
   *
   * É progresso de trabalho, não conteúdo do parecer — por isso vive fora do
   * `results` e não altera o relatório. Sem persistir, fechar a aba no meio de
   * uma revisão de 22 achados apagaria a única marca de onde ele parou.
   *
   * Opcional, como `ajustes`: registro é schemaless, ausente = nada resolvido.
   */
  achadosResolvidos?: Record<string, string[]>;
  results: StoredResultMeta[];
  /**
   * Auditoria disparada e ainda sem resultado NESTA conversa.
   *
   * A análise leva de 3 a 6 minutos e vivia presa à aba: um F5 ou uma troca de
   * conversa matava a espera, e com ela os minutos de modelo já pagos — o
   * servidor seguia trabalhando sozinho, sem ninguém para receber. Guardando o
   * `auditId` (gerado pelo cliente ANTES de começar), dá para voltar e
   * perguntar o que aconteceu.
   *
   * Opcional, como `ajustes`: registro é schemaless, ausente = nada em voo.
   */
  auditoriaPendente?: {
    auditId: string;
    artifactId: string;
    nivel: "standard" | "deep";
    arquivo: string;
    inicioMs: number;
  };
  /**
   * O PDF do memorial, retido para PODER AUDITAR DE NOVO.
   *
   * Os arquivos de entrada são efêmeros por decisão de projeto — pranchas são
   * muitas e pesadas, e não vale guardá-las. O memorial é a exceção: é um só, é
   * o que a auditoria consome, e é justamente ele que falta quando o veredito
   * volta "ANÁLISE PARCIAL — rode de novo" numa conversa restaurada. Sem os
   * bytes, a única ordem que o sistema dá é a que ele impede de cumprir.
   *
   * Os bytes moram no store de blobs, sob `${convId}:memorial` — o prefixo faz
   * `deleteConversation` limpá-los junto, sem código novo.
   */
  memorial?: {
    name: string;
    blobKey: string;
    /**
     * A identidade LIDA do memorial (obra, órgão, município, código).
     *
     * Vai junto porque reter só os bytes não basta: sem os fatos, a conversa
     * restaurada oferece "Auditar" com o gabarito vazio, e a auditoria roda
     * comparando o documento consigo mesmo — cega justamente para o erro que
     * originou o produto. Reclassificar custaria uma leitura de PDF a cada
     * restauração, para reobter um dado que já era conhecido.
     */
    dossie?: NexoDossieDraft;
  };
}

/** Resumo p/ a lista da sidebar (sem carregar mensagens/blobs). */
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
  folderKey?: string;
  /**
   * Tem auditoria disparada e ainda sem resultado.
   *
   * Entra no resumo (e não só no registro completo) porque é lido ao ABRIR a
   * aplicação, para decidir qual conversa retomar — carregar todas as conversas
   * inteiras só para descobrir isso seria caro à toa.
   */
  temAuditoriaPendente?: boolean;
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
    .map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      folderKey: c.folderKey,
      ...(c.auditoriaPendente ? { temAuditoriaPendente: true } : {}),
    }))
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
