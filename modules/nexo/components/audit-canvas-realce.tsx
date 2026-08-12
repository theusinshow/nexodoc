"use client";

/**
 * O REALCE do canvas da auditoria: quem está aceso agora.
 *
 * DUAS RAZÕES para isto ser contexto, e não um campo em `node.data`:
 *
 * 1. O DESENHO. Antes o hover era HOLOFOTE — acendia um achado e apagava o
 *    mundo. Com cinco achados isso destaca; com 45 espalhados por 28 páginas,
 *    atravessar a grade apagava 21 das 56 arestas a cada card tocado, e a tela
 *    virava um estroboscópio (medido em `scripts/repro-canvas-piscando.mjs`).
 *    Agora o realce é LOCAL: acende o par, não apaga ninguém.
 *
 * 2. O CUSTO. Com o id aceso dentro de `node.data`, cada movimento do ponteiro
 *    reconstruía os 32 objetos de nó e o React Flow redesenhava a cena inteira —
 *    inclusive as 28 miniaturas de PDF. Pelo contexto, a lista de nós fica
 *    estável e só os componentes que leem o valor reagem.
 */

import { createContext, useContext } from "react";

export interface Realce {
  /** Ids dos achados acesos. Vazio = ninguém aceso (estado normal). */
  acesos: readonly string[];
  /** Acende (hover) — lista, porque a pilha de recorrentes acende várias. */
  acender: (ids: readonly string[]) => void;
  apagar: () => void;
}

const VAZIO: Realce = { acesos: [], acender: () => {}, apagar: () => {} };

export const RealceContext = createContext<Realce>(VAZIO);

export function useRealce(): Realce {
  return useContext(RealceContext);
}

/** Este achado está aceso agora? */
export function useAceso(achadoId: string): boolean {
  const { acesos } = useRealce();
  return acesos.includes(achadoId);
}

/** Algum destes achados está aceso? (a página pergunta pelos seus). */
export function useAlgumAceso(ids: readonly string[]): boolean {
  const { acesos } = useRealce();
  return acesos.length > 0 && ids.some((id) => acesos.includes(id));
}
