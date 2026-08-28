/**
 * O RECIBO DO QUE ENTROU — a conta que fecha.
 *
 * A mensagem do intake contava só os acertos ("Li 198 folhas") e enterrava o
 * resto em prosa, no fim: quem soltou um PDF de 200 páginas não tinha como
 * saber, de relance, se as 200 estavam contabilizadas. Uma contagem que só
 * conta o que deu certo é a forma mais cara de esconder um defeito — e a
 * ressalva no fim da frase é a segunda mais cara.
 *
 * A REGRA É O FECHAMENTO: `recebidas` não é um número à parte, é a SOMA das
 * três parcelas. Assim é impossível o recibo mentir por omissão — se aparecer
 * uma quarta categoria amanhã e ninguém a somar aqui, o total muda e a
 * discrepância aparece na tela em vez de sumir.
 *
 * PURO e sem imports: roda no node cru.
 */

export interface ContagemDoDrop {
  /** Folhas com selo lido. */
  lidas: number;
  /** Folhas que a leitura não conseguiu ler — vão para o canvas em branco. */
  falharam: number;
  /** Páginas que não são prancha (capa, separatriz, índice). Ficar de fora é o certo. */
  ignoradas: number;
}

export function reciboDoDrop({
  lidas,
  falharam,
  ignoradas,
}: ContagemDoDrop): string {
  const recebidas = lidas + falharam + ignoradas;

  /*
   * As duas primeiras parcelas ficam SEMPRE, mesmo iguais ("200 recebidas ·
   * 200 lidas"): recibo com forma variável não se lê de relance, e é para ser
   * lido de relance que ele existe. As outras duas só aparecem quando há o que
   * dizer — "0 falharam" gasta a atenção que a linha economiza.
   */
  const partes = [
    `${recebidas} ${recebidas === 1 ? "recebida" : "recebidas"}`,
    `${lidas} ${lidas === 1 ? "lida" : "lidas"}`,
  ];
  if (falharam > 0)
    partes.push(`${falharam} ${falharam === 1 ? "falhou" : "falharam"}`);
  if (ignoradas > 0) {
    partes.push(
      `${ignoradas} fora (não ${ignoradas === 1 ? "é prancha" : "são prancha"})`,
    );
  }

  return partes.join(" · ");
}
