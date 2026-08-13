/**
 * A auditoria em curso, reduzida ao que cabe numa linha.
 *
 * O painel do palco (`AuditoriaEmCurso`) lista todas as etapas; a barra do topo
 * tem uma linha só e precisa escolher uma. Escolhe a que está acontecendo — a
 * primeira não concluída. Quando todas concluíram e a auditoria ainda não
 * terminou, vale a última: o motor está fechando.
 *
 * Antes do primeiro marco não se afirma etapa alguma. É a mesma honestidade do
 * painel: passada que o motor não anunciou não entra na lista.
 *
 * O rótulo vem de `NOME_DA_PASSADA`, o mesmo que o painel usa — barra e painel
 * discordarem sobre o nome da etapa em curso seriam duas verdades sobre o mesmo
 * trabalho.
 *
 * PURO: nenhum import de runtime, para rodar em node pelado no
 * `scripts/test-nexo-resumo-da-auditoria.ts`.
 */

import { NOME_DA_PASSADA } from "../../../lib/audit-progress.ts";
import { etapasDosMarcos, type MarcoRecebido } from "./etapas-da-auditoria.ts";

export interface ResumoDaAuditoria {
  /** Nome da etapa corrente, ou o que se diz antes de haver etapa. */
  rotulo: string;
  /** "3 de 8", só enquanto a etapa contada ainda corre. */
  contagem?: string;
}

export function resumoDaAuditoria(
  marcos: readonly MarcoRecebido[],
): ResumoDaAuditoria {
  const etapas = etapasDosMarcos(marcos);
  if (etapas.length === 0) return { rotulo: "Enviando o documento…" };

  const corrente = etapas.find((e) => !e.concluida) ?? etapas[etapas.length - 1];

  /*
   * Contagem só de etapa VIVA. Uma etapa concluída que guardasse "8 de 8" faria
   * a barra anunciar trabalho em andamento sobre o que já acabou.
   */
  const contagem =
    !corrente.concluida && corrente.indice !== undefined && corrente.total !== undefined
      ? `${corrente.indice} de ${corrente.total}`
      : undefined;

  return { rotulo: NOME_DA_PASSADA[corrente.passada], ...(contagem ? { contagem } : {}) };
}
