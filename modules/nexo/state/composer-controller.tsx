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
  useSyncExternalStore,
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

/**
 * O que o composer está VIVENDO agora — o orbe lê isto para reagir.
 *
 * Não entra em `ComposerControls` de propósito, e a separação é a razão de este
 * arquivo ter duas coisas. Os controles são uma fachada estável (`useMemo` sem
 * dependências) justamente para que os chips nunca re-renderizem por causa do
 * composer; um booleano que muda a cada tecla dentro dela desfaria isso na
 * primeira letra digitada.
 */
export interface ComposerFoco {
  /** O cursor está no campo. */
  focado: boolean;
  /** Há texto escrito (não vazio, não só espaço). */
  temTexto: boolean;
}

interface ComposerContextValue {
  controls: ComposerControls;
  /** O NexoChat registra os controles reais (setInput/focus/send). */
  register: (impl: ComposerControls | null) => void;
  /** O NexoChat publica foco/texto a cada mudança. */
  publicarFoco: (f: ComposerFoco) => void;
  /** Assinatura para quem quer reagir (o orbe). */
  assinarFoco: (aviso: () => void) => () => void;
  lerFoco: () => ComposerFoco;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

const FOCO_PARADO: ComposerFoco = { focado: false, temTexto: false };

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

  /*
   * FOCO E TEXTO SÃO ASSINATURA, não estado de React.
   *
   * Este provider embrulha o workspace inteiro. Guardar aqui um `useState` que
   * muda a cada tecla re-renderizaria a árvore toda enquanto se digita — o
   * oposto do que o arquivo já conquistou com a fachada estável.
   *
   * Com assinatura, quem lê (`useComposerFoco`, via `useSyncExternalStore`)
   * re-renderiza sozinho, e é um componente só: o orbe.
   */
  const focoRef = useRef<ComposerFoco>(FOCO_PARADO);
  const assinantes = useRef(new Set<() => void>());

  const publicarFoco = useCallback((f: ComposerFoco) => {
    const atual = focoRef.current;
    // Só troca o objeto quando o VALOR muda: `useSyncExternalStore` compara a
    // referência, e um objeto novo a cada tecla seria um re-render a cada tecla
    // — exatamente o que a assinatura existe para evitar.
    if (atual.focado === f.focado && atual.temTexto === f.temTexto) return;
    focoRef.current = f;
    for (const aviso of assinantes.current) aviso();
  }, []);

  const assinarFoco = useCallback((aviso: () => void) => {
    assinantes.current.add(aviso);
    return () => {
      assinantes.current.delete(aviso);
    };
  }, []);

  const lerFoco = useCallback(() => focoRef.current, []);

  const value = useMemo<ComposerContextValue>(
    () => ({ controls, register, publicarFoco, assinarFoco, lerFoco }),
    [controls, register, publicarFoco, assinarFoco, lerFoco],
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

/**
 * Foco e texto do composer, para quem reage a eles (o orbe).
 *
 * `useSyncExternalStore` e não contexto de estado: assim só quem chama este
 * hook re-renderiza ao digitar, em vez de toda a árvore abaixo do provider.
 * O terceiro argumento é o snapshot do servidor — sem ele, o SSR estoura.
 */
export function useComposerFoco(): ComposerFoco {
  const ctx = useContext(ComposerContext);
  const assinar = ctx?.assinarFoco ?? (() => () => {});
  const ler = ctx?.lerFoco ?? (() => FOCO_PARADO);
  return useSyncExternalStore(assinar, ler, () => FOCO_PARADO);
}

/** Usado pelo NexoChat para dizer que o campo ganhou/perdeu foco ou texto. */
export function usePublicarFocoDoComposer(): (f: ComposerFoco) => void {
  const ctx = useContext(ComposerContext);
  if (!ctx) {
    throw new Error(
      "usePublicarFocoDoComposer precisa estar dentro de <ComposerControllerProvider>.",
    );
  }
  return ctx.publicarFoco;
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
