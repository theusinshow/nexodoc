/**
 * A ABA TRAVADA NÃO GASTA — revisão final da segunda rodada, 15/09/2026.
 *
 * `conflitoDeVersao` acende quando outra aba (ou máquina) gravou a conversa
 * depois que esta a abriu (jornada c3). Desde então a fila de gravação desta aba
 * descarta tudo (`fila-de-gravacao.ts`) — mas auditoria, agente e LD seguiam
 * ligados: a auditoria paga rodava até o fim e o parecer nunca era registrado.
 *
 * A regra fica aqui, pura, para o botão de confirmar, o `confirm` da auditoria e
 * o envio do chat lerem a MESMA decisão e a MESMA frase — a da faixa.
 *
 * PURO e sem imports: roda no node cru.
 */
export const MOTIVO_ABA_TRAVADA =
  "Esta conversa mudou em outra aba. Recarregue a conversa para continuar — daqui, nada fica salvo.";

export function podeGastar(estado: { conflitoDeVersao: boolean }): boolean {
  return !estado.conflitoDeVersao;
}

export function motivoParaNaoGastar(estado: { conflitoDeVersao: boolean }): string | null {
  return podeGastar(estado) ? null : MOTIVO_ABA_TRAVADA;
}
