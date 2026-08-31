"use client";

/**
 * ONDE O ENGENHEIRO PAROU — para o F5 não virar uma conversa nova.
 *
 * `conversationId` nascia de um `newId()` a cada montagem e nada reabria a
 * anterior: só o clique no histórico chamava `selectConversation`. Toda
 * recarga, toda aba nova, todo "volto depois do almoço" começava do zero — e o
 * trabalho seguinte virava OUTRA linha na barra. Numa pasta real
 * (`088-25-CRICIUMA`) isso rendeu quatro conversas chamadas "MET", todas do
 * mesmo volume, indistinguíveis entre si a não ser pelo horário.
 *
 * NO NAVEGADOR, E NÃO NO SERVIDOR. É deliberado: os BYTES dos artefatos vivem
 * aqui, no IndexedDB desta máquina. Reabrir "onde parei" noutro computador
 * devolveria a conversa com a lista de arquivos e sem os arquivos — que é
 * exatamente a tela que já confunde hoje. Cada máquina lembra da sua.
 *
 * Toda leitura e escrita é protegida: `localStorage` LANÇA em janela anônima
 * com cookies bloqueados, e perder a memória de onde se parou não pode derrubar
 * a abertura do produto.
 */

export const CHAVE_ULTIMA_CONVERSA = "nexo:ultima-conversa";

/** Guarda qual conversa estava aberta. Falha em silêncio: é conveniência. */
export function lembrarUltimaConversa(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    window.localStorage.setItem(CHAVE_ULTIMA_CONVERSA, id);
  } catch {
    /* storage indisponível — o produto abre em branco, e só. */
  }
}

/** Qual conversa reabrir, ou `null` para começar em branco. */
export function ultimaConversaLembrada(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE_ULTIMA_CONVERSA) || null;
  } catch {
    return null;
  }
}

/**
 * Esquece — usado quando a conversa lembrada deixa de existir.
 *
 * Sem isto, apagar a conversa aberta deixaria a chave apontando para um
 * registro morto: toda abertura tentaria restaurar, falharia, e cairia em
 * branco. Funciona, mas gasta uma ida ao disco por abertura para sempre.
 */
export function esquecerUltimaConversa(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE_ULTIMA_CONVERSA);
  } catch {
    /* idem */
  }
}

/**
 * A restauração deve acontecer nesta abertura?
 *
 * NÃO quando a URL já manda em qual conversa abrir. Quem chega por
 * `/nexo?auditoria=<id>` pediu um parecer específico, e reabrir por cima o
 * último trabalho jogaria fora o link que a pessoa acabou de clicar — o mesmo
 * defeito que o `?auditoria=` já teve uma vez. `?intencao=` também manda: quem
 * chega com uma intenção escrita vem começar algo, não continuar.
 *
 * Puro (recebe a query, não a lê do `window`) → testável em node cru.
 */
export function deveRestaurar(query: string): boolean {
  const params = new URLSearchParams(query);
  return !params.get("auditoria") && !params.get("intencao");
}
