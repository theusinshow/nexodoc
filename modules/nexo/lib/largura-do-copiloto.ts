"use client";

/**
 * A LARGURA DA COLUNA DO COPILOTO — e por que ela tem um dono só.
 *
 * Ela morava dentro do `ShellSplitter`, em estado local. Funcionava enquanto o
 * splitter era o único a mexer. O botão "ver como sai" do frame também precisa
 * mexer, e dois donos escrevendo a MESMA variável CSS é como o estado do
 * splitter fica velho: a coluna alarga, o usuário aperta a seta do teclado, e o
 * splitter devolve a largura que ele achava ser a atual.
 *
 * Aqui a largura é um valor com assinatura. Quem muda, muda por aqui; quem
 * desenha, escuta.
 *
 * As CONSTANTES e `limitar` são puras e ficam no topo, antes de qualquer import
 * de React, para o teste em node cru alcançá-las.
 */
import { useCallback, useEffect, useState } from "react";

export const CHAVE = "nexo:copilot-w";
export const PADRAO = 520;
/** Abaixo disto o composer e os cards ficam apertados demais. */
export const MIN = 320;
/** Acima disto o canvas deixa de caber como área de trabalho. */
export const MAX = 760;
export const PASSO = 24;

export function limitar(px: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(px)));
}

/**
 * A largura do modo DOCUMENTO.
 *
 * É o teto do shell, e essa é a resposta honesta em vez de um número medido de
 * mentira: acima de `MAX` o canvas deixaria de caber como área de trabalho,
 * então não há largura maior a escolher. Se o parágrafo mais largo do modelo
 * ainda quebrar aqui, o limite é o shell — não esta escolha.
 */
export function larguraDeDocumento(): number {
  return MAX;
}

/* ------------------------------------------------------------------ estado */

let larguraAtual = PADRAO;
/** A largura de antes de abrir o documento, para o fechar poder devolvê-la. */
let larguraGuardada: number | null = null;
const ouvintes = new Set<() => void>();

function aplicar(px: number) {
  larguraAtual = limitar(px);
  const shell = document.querySelector<HTMLElement>(".nexo-shell");
  shell?.style.setProperty("--nexo-copilot-w", `${larguraAtual}px`);
  for (const avisar of ouvintes) avisar();
}

/**
 * A preferência SÓ é gravada quando o usuário decide a largura — nunca quando o
 * modo documento a impõe. Sem essa distinção, abrir o documento e fechar o
 * navegador deixaria a coluna larga para sempre, e a preferência real estaria
 * perdida sem ninguém ter mudado nada.
 */
function gravar() {
  try {
    window.localStorage.setItem(CHAVE, String(larguraAtual));
  } catch {
    /* modo privado / cota cheia: a largura vale só para esta sessão */
  }
}

export function usarLarguraDoCopiloto() {
  const [, redesenhar] = useState(0);

  useEffect(() => {
    const ouvinte = () => redesenhar((n) => n + 1);
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);

  /** O usuário decidiu a largura: vale, é gravada, e cancela o modo documento. */
  const definir = useCallback((px: number) => {
    larguraGuardada = null;
    aplicar(px);
    gravar();
  }, []);

  const abrirDocumento = useCallback(() => {
    if (larguraGuardada === null) larguraGuardada = larguraAtual;
    aplicar(larguraDeDocumento());
  }, []);

  const fecharDocumento = useCallback(() => {
    if (larguraGuardada === null) return;
    aplicar(larguraGuardada);
    larguraGuardada = null;
  }, []);

  return {
    largura: larguraAtual,
    definir,
    abrirDocumento,
    fecharDocumento,
    emDocumento: larguraGuardada !== null,
  };
}

/**
 * Lê a preferência guardada. Chamada uma vez, DEPOIS de montar: no servidor não
 * existe `localStorage`, e ler no primeiro render faria o HTML do servidor
 * divergir do cliente.
 */
export function restaurarPreferencia() {
  const salvo = Number(window.localStorage.getItem(CHAVE));
  aplicar(Number.isFinite(salvo) && salvo > 0 ? salvo : PADRAO);
}
