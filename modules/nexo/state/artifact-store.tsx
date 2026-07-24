"use client";

/**
 * Store leve de artefatos gerados, para o canvas (Apêndice G). É a ponte entre a
 * geração (no ConfirmationCard, dentro do copiloto) e a vista de canvas (no stage):
 * ao gerar um documento, o card registra o artefato aqui; o `NexoCanvas` lê e
 * desenha os nós na ordem canônica.
 *
 * Deliberadamente MÍNIMO (não é o `NexoSessionProvider` completo — esse wiring é
 * passo à parte): só metadados leves + o object URL do PDF para a miniatura. Os
 * bytes pesados NÃO entram aqui (§2 "binários pesados fora do estado React").
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { NexoArtifactKind } from "../types";

export interface CanvasArtifact {
  /** Id determinístico (kind + campos estruturados) — regenerar substitui. */
  id: string;
  kind: NexoArtifactKind;
  /** Rótulo mono curto ("LD ESTRUTURAL", "Capa Chapecó"). */
  label: string;
  /** Resumo de uma linha (código · rev · folhas…). */
  detail?: string;
  /** Object URL do PDF (miniatura). Ausente = sem PDF (degrada p/ ícone). */
  pdfUrl?: string;
  /** Página para a miniatura (capa = 1). */
  pageNumber?: number;
}

interface ArtifactStoreValue {
  artifacts: CanvasArtifact[];
  addArtifact: (artifact: CanvasArtifact) => void;
  /** SUBSTITUI todos os artefatos (espelho da conversa ativa; evita acumular
   *  artefatos de conversas anteriores no canvas — bug #2 da revisão). */
  replaceArtifacts: (artifacts: CanvasArtifact[]) => void;
}

const ArtifactStoreContext = createContext<ArtifactStoreValue | null>(null);

export function ArtifactStoreProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<CanvasArtifact[]>([]);

  const addArtifact = useCallback((artifact: CanvasArtifact) => {
    setArtifacts((prev) => {
      const i = prev.findIndex((a) => a.id === artifact.id);
      if (i === -1) return [...prev, artifact];
      const next = [...prev];
      next[i] = artifact; // regenerou o mesmo artefato → substitui
      return next;
    });
  }, []);

  const replaceArtifacts = useCallback((list: CanvasArtifact[]) => {
    setArtifacts(list);
  }, []);

  const value = useMemo(
    () => ({ artifacts, addArtifact, replaceArtifacts }),
    [artifacts, addArtifact, replaceArtifacts],
  );
  return (
    <ArtifactStoreContext.Provider value={value}>
      {children}
    </ArtifactStoreContext.Provider>
  );
}

/** Lê o store. Retorna um no-op fora do provider (o ConfirmationCard é reusável). */
export function useArtifactStore(): ArtifactStoreValue {
  const ctx = useContext(ArtifactStoreContext);
  if (!ctx) {
    return { artifacts: [], addArtifact: () => {}, replaceArtifacts: () => {} };
  }
  return ctx;
}
