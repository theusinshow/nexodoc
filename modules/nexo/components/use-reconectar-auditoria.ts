"use client";

/**
 * Reconecta a uma auditoria que ficou rodando no servidor.
 *
 * A análise leva de 3 a 6 minutos e vivia presa à aba que a disparou: um F5 ou
 * uma troca de conversa matava a espera, e com ela os minutos de modelo já
 * pagos. O servidor nunca parou de trabalhar nesses casos — faltava voltar e
 * perguntar.
 *
 * Quem dispara grava um bilhete durável na conversa (`auditoriaPendente`) com o
 * `auditId` escolhido antes de começar. Este gancho, ao montar, vê o bilhete e
 * pergunta ao servidor até obter resposta: pronta vira artefato como se a aba
 * nunca tivesse fechado; falhou ou irrecuperável some, com o motivo.
 *
 * Não há aqui progresso por marcos: o fluxo de eventos morreu junto com a
 * conexão anterior, e inventar etapas para preencher a espera seria exatamente
 * a animação que este módulo inteiro se recusa a fazer. A tela diz o que sabe —
 * que a análise está rodando no servidor desde tal hora.
 */

import { useEffect, useRef, useState } from "react";

import { consultarAuditoria } from "../lib/audit";
import { useConversation } from "../state/conversation-store";

/** Espaço entre perguntas. A auditoria leva minutos; insistir mais é ruído. */
const INTERVALO_MS = 5000;

export interface ReconexaoDaAuditoria {
  /** Existe enquanto há auditoria em voo herdada de outra sessão. */
  pendente: { arquivo: string; nivel: "standard" | "deep"; inicioMs: number } | null;
  /** Motivo de ter desistido — some sozinho quando o usuário age. */
  falha: string | null;
}

export function useReconectarAuditoria(): ReconexaoDaAuditoria {
  const { auditoriaPendente, marcarAuditoriaPendente, saveResult, getResult } =
    useConversation();
  const [falha, setFalha] = useState<string | null>(null);
  /*
   * Guarda de reentrada: sem ela, cada re-render agenda uma nova consulta e a
   * mesma auditoria passa a ser perguntada várias vezes por segundo.
   */
  const consultando = useRef<string | null>(null);

  useEffect(() => {
    const bilhete = auditoriaPendente;
    if (!bilhete) return;

    // Já temos o resultado (a aba que disparou concluiu): o bilhete é resíduo.
    if (getResult(bilhete.artifactId)) {
      marcarAuditoriaPendente(null);
      return;
    }

    if (consultando.current === bilhete.auditId) return;
    consultando.current = bilhete.auditId;

    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const perguntar = async () => {
      if (!vivo) return;
      let estado;
      try {
        estado = await consultarAuditoria(bilhete.auditId);
      } catch {
        // Rede caiu: tentar de novo é mais útil que declarar fracasso.
        timer = setTimeout(perguntar, INTERVALO_MS);
        return;
      }
      if (!vivo) return;

      if (estado.situacao === "rodando") {
        timer = setTimeout(perguntar, INTERVALO_MS);
        return;
      }

      if (estado.situacao === "pronta") {
        const r = estado.resultado;
        await saveResult({
          artifactId: bilhete.artifactId,
          kind: "auditoria",
          summary: `Auditoria — ${r.report.status_geral}`,
          files: [],
          payload: r,
          canvas: {
            label: "Auditoria",
            detail: `${r.report.status_geral} · ${r.report.total_incongruencias} achado(s)`,
          },
        });
      } else {
        setFalha(estado.motivo);
      }
      marcarAuditoriaPendente(null);
      consultando.current = null;
    };

    void perguntar();

    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      consultando.current = null;
    };
  }, [auditoriaPendente, marcarAuditoriaPendente, saveResult, getResult]);

  return {
    pendente: auditoriaPendente
      ? {
          arquivo: auditoriaPendente.arquivo,
          nivel: auditoriaPendente.nivel,
          inicioMs: auditoriaPendente.inicioMs,
        }
      : null,
    falha,
  };
}
