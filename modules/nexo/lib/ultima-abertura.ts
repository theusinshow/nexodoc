/**
 * A ÚLTIMA ABERTURA VENCE — revisão final da segunda rodada, 15/09/2026.
 *
 * `selectConversation` espera o commit da conversa que sai, a fila de gravação,
 * a lista do servidor (até 4s na carga), o disco e às vezes a rede, e só então
 * troca de conversa. Duas aberturas soltas pela mesma espera — o F5 restaurando
 * a última conversa, a retomada da auditoria em voo, um clique na barra —
 * terminavam em qualquer ordem, e valia a que terminasse por ÚLTIMO: o F5
 * podia desfazer o clique. Antes disto só se silenciava o sintoma no
 * `motion.ts` ("Transition was skipped").
 *
 * Cada abertura pega um número ao começar; depois de cada espera ela pergunta
 * se ainda é a mais recente, e a que não é desiste sem trocar nada.
 *
 * PURO e sem imports: roda no node cru.
 */
export function criarUltimaAbertura() {
  let ultima = 0;
  return {
    comecar(): number {
      return ++ultima;
    },
    valeAinda(abertura: number): boolean {
      return abertura === ultima;
    },
  };
}
