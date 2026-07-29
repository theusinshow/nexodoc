"use client";

/**
 * A auditoria em curso, para o PALCO saber.
 *
 * O estado de "rodando" nascia dentro do cartão de confirmação, no chat — o
 * centro da tela não tinha como saber que havia uma análise acontecendo, e por
 * isso continuava mostrando o mapa do volume enquanto o agente trabalhava.
 *
 * Guarda só o que o palco precisa: nível, arquivo e quando começou. O RESULTADO
 * não mora aqui — ele já é artefato durável no `conversation-store`, e duplicá-lo
 * criaria duas verdades sobre a mesma auditoria.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface AuditoriaEmCursoInfo {
  nivel: "standard" | "deep";
  arquivo: string;
  inicioMs: number;
}

export type VistaDoPalco = "mapa" | "auditoria";

/**
 * A vista escolhida à mão, junto da MARCA da auditoria em que foi escolhida.
 *
 * A marca é o que faz a escolha caducar: mandei mostrar o mapa durante uma
 * análise, começou outra — o palco volta a seguir o trabalho em vez de esconder
 * a auditoria nova atrás de uma decisão tomada sobre a antiga. A marca `"*"`
 * vale para qualquer auditoria: é o "Ver o parecer" do chat, que por definição
 * fala da auditoria que estiver na tela.
 */
interface EscolhaDeVista {
  marca: string;
  vista: VistaDoPalco;
}

interface AuditoriaStoreValue {
  emCurso: AuditoriaEmCursoInfo | null;
  iniciar: (info: Omit<AuditoriaEmCursoInfo, "inicioMs">) => void;
  terminar: () => void;
  escolha: EscolhaDeVista | null;
  escolherVista: (marca: string, vista: VistaDoPalco) => void;
  /** Traz o parecer para o palco venha o pedido de onde vier (chat, atalho). */
  verNoPalco: () => void;
}

const Ctx = createContext<AuditoriaStoreValue | null>(null);

export function AuditoriaStoreProvider({ children }: { children: ReactNode }) {
  const [emCurso, setEmCurso] = useState<AuditoriaEmCursoInfo | null>(null);

  const iniciar = useCallback((info: Omit<AuditoriaEmCursoInfo, "inicioMs">) => {
    setEmCurso({ ...info, inicioMs: Date.now() });
  }, []);

  const terminar = useCallback(() => setEmCurso(null), []);

  const [escolha, setEscolha] = useState<EscolhaDeVista | null>(null);
  const escolherVista = useCallback(
    (marca: string, vista: VistaDoPalco) => setEscolha({ marca, vista }),
    [],
  );
  const verNoPalco = useCallback(() => setEscolha({ marca: "*", vista: "auditoria" }), []);

  const value = useMemo(
    () => ({ emCurso, iniciar, terminar, escolha, escolherVista, verNoPalco }),
    [emCurso, iniciar, terminar, escolha, escolherVista, verNoPalco],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuditoria(): AuditoriaStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuditoria fora do AuditoriaStoreProvider");
  return ctx;
}
