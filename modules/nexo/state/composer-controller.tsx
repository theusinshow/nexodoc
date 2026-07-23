"use client";

/**
 * ComposerController (§10 da ARQUITETURA.md) — ponte fina entre os chips de
 * pré-resposta e o composer. Um chip `fill` ESCREVE no composer (o usuário edita
 * e dá Enter); um chip `send` ENVIA direto. Sem isto, os chips precisariam de
 * prop-drilling do `setInput`/`send` do NexoChat por toda a lista de mensagens.
 *
 * É o embrião do que o PR5 promove ao <NexoComposer> dock. O objeto de controles
 * é ESTÁVEL (delega a um ref), então quem consome (`useComposer`) não re-renderiza
 * a cada mensagem — só o NexoChat, dono do input, atualiza a implementação real.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

export interface ComposerControls {
  /** Escreve no composer, foca e seleciona o texto (chip `fill`). */
  fill(text: string): void;
  /** Envia a mensagem imediatamente (chip `send` / "Sim, pode gerar"). */
  send(text: string): void;
  /** Só devolve o foco ao composer. */
  focus(): void;
}

interface ComposerContextValue {
  controls: ComposerControls;
  /** O NexoChat registra os controles reais (setInput/focus/send). */
  register: (impl: ComposerControls | null) => void;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

export function ComposerControllerProvider({ children }: { children: ReactNode }) {
  const implRef = useRef<ComposerControls | null>(null);

  const register = useCallback((impl: ComposerControls | null) => {
    implRef.current = impl;
  }, []);

  // Fachada estável que delega ao ref atual — não muda de identidade, então
  // os consumidores (chips) nunca re-renderizam por causa do controller.
  const controls = useMemo<ComposerControls>(
    () => ({
      fill: (text) => implRef.current?.fill(text),
      send: (text) => implRef.current?.send(text),
      focus: () => implRef.current?.focus(),
    }),
    [],
  );

  const value = useMemo<ComposerContextValue>(
    () => ({ controls, register }),
    [controls, register],
  );

  return (
    <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>
  );
}

/** Consumido pelos chips. Lança se usado fora do provider. */
export function useComposer(): ComposerControls {
  const ctx = useContext(ComposerContext);
  if (!ctx) {
    throw new Error("useComposer precisa estar dentro de <ComposerControllerProvider>.");
  }
  return ctx.controls;
}

/** Usado pelo NexoChat para publicar a implementação real do composer. */
export function useRegisterComposer(): (impl: ComposerControls | null) => void {
  const ctx = useContext(ComposerContext);
  if (!ctx) {
    throw new Error(
      "useRegisterComposer precisa estar dentro de <ComposerControllerProvider>.",
    );
  }
  return ctx.register;
}
