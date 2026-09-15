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
import {
  type BloqueioDaReconexao,
  vistaDaReconexao,
} from "../lib/vista-da-reconexao";
import { auditoriaDaConversa, useAuditoria } from "../state/auditoria-store";
import { useConversation } from "../state/conversation-store";
import { detalheDoParecer, resumoDoParecer } from "@/lib/auditoria-incompleta";

/** Espaço entre perguntas. A auditoria leva minutos; insistir mais é ruído. */
const INTERVALO_MS = 5000;

export interface ReconexaoDaAuditoria {
  /** Existe enquanto há auditoria em voo herdada de outra sessão. */
  pendente: {
    arquivo: string;
    nivel: "standard" | "deep";
    inicioMs: number;
  } | null;
  /** Motivo de ter desistido — some sozinho quando o usuário age. */
  falha: string | null;
  /**
   * Descarta a espera bloqueada por falta de acesso (403): tira o bilhete e o
   * motivo. `null` quando não há o que descartar (ver `vistaDaReconexao`).
   */
  descartar: (() => void) | null;
}

export function useReconectarAuditoria(): ReconexaoDaAuditoria {
  const {
    auditoriaPendente,
    marcarAuditoriaPendente,
    saveResult,
    getResult,
    conversationId,
  } = useConversation();
  /*
   * A ABA QUE DISPAROU NÃO SE RECONECTA A SI MESMA.
   *
   * O bilhete é gravado no clique, ANTES da transcrição das folhas mudas — e
   * ela roda no navegador, meio minuto ou mais, antes de o POST criar a linha no
   * banco. Este gancho via o bilhete na hora, perguntava pelo id, levava 404 e
   * declarava "Auditoria não encontrada no servidor" sobre uma análise que
   * ainda nem tinha começado. Em 14/09/2026 o 117_25 terminou COMPLETED com 56
   * achados enquanto a tela dizia que a análise não tinha terminado.
   *
   * Enquanto o cartão desta aba conduz a corrida, a espera é dele. Se a conexão
   * cair, ele encerra o `emCurso` e deixa o bilhete — e aí sim o gancho assume.
   */
  const conduzidaAqui =
    auditoriaDaConversa(useAuditoria().emCurso, conversationId) !== null;
  const [falha, setFalha] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState<BloqueioDaReconexao>(null);
  // Uma corrida nova aposenta o motivo da anterior: sem isto a falha velha
  // ficaria por cima do parecer novo quando ele chegasse (o palco a desenha
  // antes do parecer). Ajuste durante o render, e não num effect.
  if (conduzidaAqui && falha !== null) setFalha(null);
  /*
   * Guarda de reentrada: sem ela, cada re-render agenda uma nova consulta e a
   * mesma auditoria passa a ser perguntada várias vezes por segundo.
   */
  const consultando = useRef<string | null>(null);

  useEffect(() => {
    const bilhete = auditoriaPendente;
    if (!bilhete) return;

    if (conduzidaAqui) return;

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

      /*
       * SEM SESSÃO: PARA DE PERGUNTAR E GUARDA O BILHETE — 15/09/2026, jornada
       * x1. A faixa de sessão expirada já acendeu (`conferirSessao`). Entrar de
       * novo recarrega a página, e a reconexão recomeça daqui, do bilhete: é o
       * "nada é perdido". Limpar o bilhete agora jogaria fora o único ponteiro
       * para uma análise que o servidor segue terminando.
       */
      if (estado.situacao === "sem-sessao") return;

      /*
       * SEM ACESSO (403): DIZ, PARA DE PERGUNTAR E GUARDA O BILHETE — revisão
       * final da segunda rodada, 15/09/2026. Caía no "rodando" e perguntava para
       * sempre. O bilhete fica pelo mesmo motivo da sessão: se o acesso voltar, o
       * próximo carregamento reconecta à análise que o servidor terminou.
       */
      if (estado.situacao === "sem-acesso") {
        setSemAcesso({ auditId: bilhete.auditId, motivo: estado.motivo });
        return;
      }

      if (estado.situacao === "pronta") {
        const r = estado.resultado;
        await saveResult({
          artifactId: bilhete.artifactId,
          kind: "auditoria",
          summary: resumoDoParecer(r.report),
          files: [],
          payload: r,
          canvas: {
            label: "Auditoria",
            detail: detalheDoParecer(r.report),
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
  }, [
    auditoriaPendente,
    conduzidaAqui,
    marcarAuditoriaPendente,
    saveResult,
    getResult,
  ]);

  const vista = vistaDaReconexao({
    bilhete: auditoriaPendente,
    semAcesso,
    falha,
  });
  return {
    pendente:
      auditoriaPendente && vista.mostrarPendente
        ? {
            arquivo: auditoriaPendente.arquivo,
            nivel: auditoriaPendente.nivel,
            inicioMs: auditoriaPendente.inicioMs,
          }
        : null,
    falha: vista.falha,
    descartar: vista.podeDescartar
      ? () => {
          marcarAuditoriaPendente(null);
          setSemAcesso(null);
          setFalha(null);
          consultando.current = null;
        }
      : null,
  };
}
