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

import type { MarcoDaAuditoria } from "@/lib/audit-progress";
/*
 * O carimbo de chegada é do CLIENTE porque quem precisa dele é a tela: para
 * dizer "esta etapa passou do orçamento" é preciso saber quando ela começou.
 */
import type { MarcoRecebido } from "../lib/etapas-da-auditoria";

export interface AuditoriaEmCursoInfo {
  /**
   * De QUAL conversa é esta auditoria.
   *
   * Sem isto o `emCurso` é global de verdade: trocar de conversa no meio de uma
   * análise levava o progresso junto e o exibia sobre a conversa nova, que não
   * pediu nada. No palco passava; numa barra sempre visível, não passa.
   */
  conversationId: string;
  nivel: "standard" | "deep";
  arquivo: string;
  inicioMs: number;
  /** Os marcos que o motor JÁ relatou, na ordem em que chegaram. */
  marcos: MarcoRecebido[];
  /** Existe enquanto der para desistir. */
  cancelar?: () => void;
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
  iniciar: (info: Omit<AuditoriaEmCursoInfo, "inicioMs" | "marcos">) => void;
  /** Registra um marco vindo do motor. */
  marcar: (marco: MarcoDaAuditoria) => void;
  terminar: () => void;
  escolha: EscolhaDeVista | null;
  escolherVista: (marca: string, vista: VistaDoPalco) => void;
  /** Traz o parecer para o palco venha o pedido de onde vier (chat, atalho). */
  verNoPalco: () => void;
}

const Ctx = createContext<AuditoriaStoreValue | null>(null);

export function AuditoriaStoreProvider({ children }: { children: ReactNode }) {
  const [emCurso, setEmCurso] = useState<AuditoriaEmCursoInfo | null>(null);

  const iniciar = useCallback(
    (info: Omit<AuditoriaEmCursoInfo, "inicioMs" | "marcos">) => {
      setEmCurso({ ...info, inicioMs: Date.now(), marcos: [] });
    },
    [],
  );

  const marcar = useCallback((cru: MarcoDaAuditoria) => {
    const marco: MarcoRecebido = { ...cru, emMs: Date.now() };
    setEmCurso((atual) => {
      if (!atual) return atual;
      /*
       * Um marco de MESMA passada e mesmo estado substitui o anterior em vez de
       * empilhar: os blocos relatam a cada conclusão ("3 de 8", "4 de 8") e sem
       * isto a lista cresceria uma linha por bloco.
       */
      const i = atual.marcos.findIndex(
        (m) => m.passada === marco.passada && m.estado === marco.estado,
      );
      const marcos =
        i >= 0
          ? atual.marcos.map((m, j) => (j === i ? marco : m))
          : [...atual.marcos, marco];
      return { ...atual, marcos };
    });
  }, []);

  const terminar = useCallback(() => setEmCurso(null), []);

  const [escolha, setEscolha] = useState<EscolhaDeVista | null>(null);
  const escolherVista = useCallback(
    (marca: string, vista: VistaDoPalco) => setEscolha({ marca, vista }),
    [],
  );
  const verNoPalco = useCallback(() => setEscolha({ marca: "*", vista: "auditoria" }), []);

  const value = useMemo(
    () => ({ emCurso, iniciar, marcar, terminar, escolha, escolherVista, verNoPalco }),
    [emCurso, iniciar, marcar, terminar, escolha, escolherVista, verNoPalco],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuditoria(): AuditoriaStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuditoria fora do AuditoriaStoreProvider");
  return ctx;
}

/**
 * A auditoria em curso SE ela for desta conversa — senão, nada.
 *
 * Um helper e não um filtro dentro do provider: o store guarda o fato, e cada
 * tela decide o que fazer com ele. Assim a retomada pós-F5, que é por conversa
 * e vive no `conversation-store`, continua sendo o outro caminho legítimo.
 */
export function auditoriaDaConversa(
  emCurso: AuditoriaEmCursoInfo | null,
  conversationId: string,
): AuditoriaEmCursoInfo | null {
  return emCurso && emCurso.conversationId === conversationId ? emCurso : null;
}
