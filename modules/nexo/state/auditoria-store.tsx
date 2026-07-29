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

interface AuditoriaStoreValue {
  emCurso: AuditoriaEmCursoInfo | null;
  iniciar: (info: Omit<AuditoriaEmCursoInfo, "inicioMs">) => void;
  terminar: () => void;
}

const Ctx = createContext<AuditoriaStoreValue | null>(null);

export function AuditoriaStoreProvider({ children }: { children: ReactNode }) {
  const [emCurso, setEmCurso] = useState<AuditoriaEmCursoInfo | null>(null);

  const iniciar = useCallback((info: Omit<AuditoriaEmCursoInfo, "inicioMs">) => {
    setEmCurso({ ...info, inicioMs: Date.now() });
  }, []);

  const terminar = useCallback(() => setEmCurso(null), []);

  const value = useMemo(() => ({ emCurso, iniciar, terminar }), [emCurso, iniciar, terminar]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuditoria(): AuditoriaStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuditoria fora do AuditoriaStoreProvider");
  return ctx;
}
