"use client";

/**
 * Provider da máquina de estados da sessão do Nexo (§2 da ARQUITETURA.md).
 *
 * DOIS contexts separados de propósito (§2): `NexoSessionStateContext` (o estado)
 * e `NexoSessionDispatchContext` (o dispatch, referência ESTÁVEL). Assim o
 * composer/frames que só despacham não re-renderizam a cada nova mensagem — só
 * quem lê o estado reage. `dispatch` do `useReducer` é estável por contrato do
 * React, então o context de dispatch nunca muda de valor.
 *
 * O reducer é PURO (./session-reducer.ts). Todo IO (chamar a IA, gerar artefato,
 * ler selos) vive em hooks action-creators FORA daqui, que despacham
 * `*_SUCCEEDED`/`*_FAILED`. Este PR só monta a fundação — não fia nada externo.
 */

import { createContext, useContext, useReducer, type ReactNode } from "react";

import {
  initNexoSession,
  nexoSessionReducer,
  type NexoSession,
  type NexoSessionEvent,
} from "./session-reducer";

/** Context do ESTADO — muda a cada transição; só quem lê estado reage. */
const NexoSessionStateContext = createContext<NexoSession | null>(null);

/** Context do DISPATCH — referência estável; composer/frames não re-renderizam. */
type NexoDispatch = (event: NexoSessionEvent) => void;
const NexoSessionDispatchContext = createContext<NexoDispatch | null>(null);

export function NexoSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    nexoSessionReducer,
    undefined,
    initNexoSession,
  );
  return (
    <NexoSessionStateContext.Provider value={state}>
      <NexoSessionDispatchContext.Provider value={dispatch}>
        {children}
      </NexoSessionDispatchContext.Provider>
    </NexoSessionStateContext.Provider>
  );
}

/** Lê o estado da sessão. Lança se usado fora do `<NexoSessionProvider>`. */
export function useNexoSessionState(): NexoSession {
  const ctx = useContext(NexoSessionStateContext);
  if (ctx === null) {
    throw new Error(
      "useNexoSessionState precisa estar dentro de <NexoSessionProvider>.",
    );
  }
  return ctx;
}

/** Lê o dispatch da sessão. Lança se usado fora do `<NexoSessionProvider>`. */
export function useNexoSessionDispatch(): NexoDispatch {
  const ctx = useContext(NexoSessionDispatchContext);
  if (ctx === null) {
    throw new Error(
      "useNexoSessionDispatch precisa estar dentro de <NexoSessionProvider>.",
    );
  }
  return ctx;
}
