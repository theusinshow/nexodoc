"use client";

/**
 * Acumulador leve de consumo de IA (tokens) da sessão — alimenta o indicador
 * sutil perto do Nexo. Os tokens vêm das respostas das rotas (agente + leitura
 * de selos, que já devolvem `usage`). Fora do provider vira no-op.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ApiUsageValue {
  /** Tokens de IA acumulados na sessão. */
  tokens: number;
  addTokens: (n: number) => void;
}

const ApiUsageContext = createContext<ApiUsageValue | null>(null);

export function ApiUsageProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState(0);
  const addTokens = useCallback((n: number) => {
    if (n > 0) setTokens((t) => t + n);
  }, []);
  const value = useMemo(() => ({ tokens, addTokens }), [tokens, addTokens]);
  return <ApiUsageContext.Provider value={value}>{children}</ApiUsageContext.Provider>;
}

/** No-op fora do provider (componentes reusáveis não quebram). */
export function useApiUsage(): ApiUsageValue {
  return useContext(ApiUsageContext) ?? { tokens: 0, addTokens: () => {} };
}
