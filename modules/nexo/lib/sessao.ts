"use client";

/**
 * Sessão expirada — percebida onde ela realmente aparece: numa resposta 401.
 *
 * Sessão longa é a NORMA neste produto. O engenheiro abre o Nexo de manhã,
 * monta um volume, sai para a obra e volta à tarde na mesma aba. Quando a
 * sessão caduca nesse meio-tempo, o que ele vê hoje é uma falha genérica de
 * geração — e a conclusão natural é que o trabalho se perdeu.
 *
 * Não se perdeu: a conversa e os documentos gerados estão no IndexedDB deste
 * navegador. Este módulo existe para que a interface possa DIZER isso, com
 * número, em vez de devolver a pessoa a um login zerado.
 *
 * É um sino, não um estado: qualquer camada que veja um 401 toca, e quem
 * desenha escuta.
 */

const EVENTO = "nexo:sessao-expirada";

/** Última vez que o servidor respondeu com sucesso nesta aba. */
let ultimoSucesso = Date.now();

/** Chame a cada resposta OK — é o relógio do "ficou N horas sem atividade". */
export function registrarSucesso(): void {
  ultimoSucesso = Date.now();
}

export function inicioDaInatividade(): number {
  return ultimoSucesso;
}

/**
 * Toca o sino. Idempotente por natureza: quem escuta só mostra uma faixa, e
 * várias chamadas falhando ao mesmo tempo não empilham avisos.
 */
export function reportarSessaoExpirada(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/**
 * Traduz uma resposta em "a sessão caiu?". Só o 401 conta: 403 é permissão
 * (conta válida, porta errada) e 500 é defeito do servidor — tratá-los como
 * sessão expirada mandaria a pessoa reautenticar sem motivo.
 */
export function conferirSessao(res: Response): void {
  if (res.status === 401) reportarSessaoExpirada();
  else if (res.ok) registrarSucesso();
}

export const EVENTO_SESSAO_EXPIRADA = EVENTO;
