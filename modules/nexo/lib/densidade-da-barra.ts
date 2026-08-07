/**
 * A RÉGUA da barra de leitura: espessura e respiro por tamanho do lote.
 *
 * Mora fora do componente para poder ser testada em node cru — o `.tsx` não
 * parseia sem JSX, e é esta função que carrega a única decisão da barra.
 *
 * Os segmentos dividem a largura disponível (`1fr` cada no grid), então quem
 * muda com a contagem não é a largura de cada um, e sim quanto respiro cabe
 * entre eles. O GAP ENCOLHE ANTES DA ALTURA: num lote de 200 folhas, separar
 * traços com 4px de vão gastaria mais largura com espaço do que com informação.
 *
 * ACIMA DE 150 O VÃO ZERA e a barra vira uma fita contínua. A conversa tem
 * ~736px: com 400 folhas e 1px de vão, os vãos sozinhos somam 399px e sobra
 * menos de 1px por folha — os retângulos caem no sub-pixel e a barra some
 * justamente no lote em que ela mais serve. Passado esse ponto, distinguir
 * folha a folha deixou de ser possível de qualquer jeito, e a fita contínua
 * (que é a progress bar de sempre) diz a mesma coisa sem desaparecer.
 *
 * PURO: sem imports, sem relógio.
 */
export function densidadeDaBarra(total: number): {
  alturaPx: number;
  gapPx: number;
} {
  if (total <= 12) return { alturaPx: 10, gapPx: 4 };
  if (total <= 40) return { alturaPx: 10, gapPx: 3 };
  if (total <= 90) return { alturaPx: 8, gapPx: 2 };
  if (total <= 150) return { alturaPx: 8, gapPx: 1 };
  return { alturaPx: 8, gapPx: 0 };
}
