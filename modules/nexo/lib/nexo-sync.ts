"use client";

import type { StoredConversation, ConversationSummary } from "./nexo-db";

/**
 * O LADO DE CÁ DA SINCRONIZAÇÃO.
 *
 * Uma camada fina sobre `/api/nexo/conversas`, com uma postura só: **falhar
 * aqui nunca pode travar o trabalho.** O IndexedDB continua sendo a gravação
 * que importa no instante; o servidor é o que faz o trabalho sobreviver a
 * trocar de máquina.
 *
 * O que ela NÃO faz é engolir a falha. Toda função devolve o que aconteceu, e
 * quem chama decide o que mostrar — porque o modo de falhar que esse projeto já
 * pagou caro é o silencioso: parece que salvou.
 */

export type EstadoDaSincronizacao =
  | { estado: "ok"; em: number }
  | { estado: "desligada" }
  | { estado: "falhou"; motivo: string; em: number };

const ROTA = "/api/nexo/conversas";

/** Lista os resumos que o servidor tem para o usuário logado. */
export async function listarNoServidor(): Promise<{
  conversas: ConversationSummary[];
  sincronizando: boolean;
}> {
  const resp = await fetch(ROTA, { method: "GET", cache: "no-store" });
  if (!resp.ok) throw new Error(`servidor respondeu ${resp.status}`);
  const json = (await resp.json()) as {
    conversas?: ConversationSummary[];
    sincronizando?: boolean;
  };
  return {
    conversas: json.conversas ?? [],
    sincronizando: json.sincronizando === true,
  };
}

/**
 * Manda a conversa para o servidor.
 *
 * Devolve o estado em vez de lançar: quem chama é o `persistNow`, que roda
 * atrás de um debounce e não tem para onde propagar uma exceção.
 */
export async function gravarNoServidor(
  rec: StoredConversation,
): Promise<EstadoDaSincronizacao> {
  const agora = Date.now();
  try {
    const resp = await fetch(ROTA, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rec),
    });
    if (resp.ok) return { estado: "ok", em: agora };
    // 404 é a resposta de "módulo desligado" — não é falha, é ausência.
    if (resp.status === 404) return { estado: "desligada" };
    const json = (await resp.json().catch(() => null)) as { error?: string } | null;
    return {
      estado: "falhou",
      motivo: json?.error ?? `servidor respondeu ${resp.status}`,
      em: agora,
    };
  } catch {
    // Sem rede. Não é erro de programa, e o trabalho local está a salvo.
    return { estado: "falhou", motivo: "sem conexão com o servidor", em: agora };
  }
}

/** Busca uma conversa que existe no servidor e não neste disco. */
export async function lerDoServidor(id: string): Promise<StoredConversation | null> {
  try {
    const resp = await fetch(`${ROTA}/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!resp.ok) return null;
    return (await resp.json()) as StoredConversation;
  } catch {
    return null;
  }
}

/**
 * Apaga no servidor.
 *
 * Best-effort de propósito: o local já foi apagado quando isto roda, e recusar
 * a exclusão porque a rede caiu deixaria a pessoa presa a uma conversa que ela
 * mandou sumir.
 */
export async function apagarNoServidor(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`${ROTA}/${encodeURIComponent(id)}`, { method: "DELETE" });
    return resp.ok;
  } catch {
    return false;
  }
}
