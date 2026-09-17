/**
 * PROMESSA QUE NÃO VOLTA É PIOR QUE ERRO.
 *
 * 17/09/2026, Urubici. `putBlob` do memorial de 26,8 MB ficou pendente e nunca
 * se resolveu: a referência do memorial não foi gravada, quem chamou não
 * recebeu rejeição — e por isso nem a mensagem de "não consegui guardar"
 * apareceu. A conversa ficou com o memorial nulo, o cartão pedia o PDF de novo
 * e o botão AUDITAR não fazia nada.
 *
 * Erro dá para contar ao usuário; silêncio, não. Esta função transforma o
 * segundo no primeiro.
 *
 * NÃO CANCELA o trabalho: uma gravação de IndexedDB não se cancela, e mentir
 * que cancelou seria outro silêncio. Ela só para de ESPERAR e diz por quê.
 *
 * PURO.
 */
export async function comPrazo<T>(
  promessa: Promise<T>,
  ms: number,
  oQue: string,
): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promessa,
      new Promise<never>((_, rejeitar) => {
        relogio = setTimeout(
          () =>
            rejeitar(
              new Error(
                `A gravação de ${oQue} neste navegador não respondeu em ${Math.round(ms / 1000)}s.`,
              ),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    if (relogio) clearTimeout(relogio);
  }
}
