/**
 * Geometria do canvas: onde cada folha cai na grade do seu tomo e quanto cada
 * fileira ocupa em altura.
 *
 * As folhas viram GRADE, não esteira: uma fileira horizontal de 200 folhas
 * empurraria o nó do volume para fora da tela justamente no projeto grande, e o
 * volume é o resultado que o tomo produz. A grade cresce para BAIXO, que é a
 * direção em que o canvas já cresce (uma fileira por tomo).
 *
 * PURO: nenhum import — roda em Node pelado no `scripts/test-nexo-layout.ts`.
 */

/** Folhas por linha da grade. */
export const COLUNAS_DA_GRADE = 6;
/** Largura do nó da folha. */
export const LARGURA_FOLHA = 120;
/** Altura do nó da folha. */
export const ALTURA_FOLHA = 56;
/** Largura do nó da folha + respiro. */
export const PASSO_X = 128;
/** Altura do nó da folha + respiro. */
export const PASSO_Y = 64;
/** Altura de uma fileira sem folhas — o bastante para os nós de documento. */
export const ALTURA_MINIMA_FILEIRA = 330;
/** Respiro entre a grade e a fileira seguinte. */
const FOLGA_DA_FILEIRA = 40;

/** Posição da n-ésima folha dentro da grade do tomo (relativa à grade). */
export function posicaoNaGrade(
  indice: number,
  colunas: number = COLUNAS_DA_GRADE,
): { x: number; y: number } {
  return {
    x: (indice % colunas) * PASSO_X,
    y: Math.floor(indice / colunas) * PASSO_Y,
  };
}

/** Largura ocupada pela grade — para saber onde o nó seguinte começa. */
export function larguraDaGrade(
  quantidade: number,
  colunas: number = COLUNAS_DA_GRADE,
): number {
  return Math.min(quantidade, colunas) * PASSO_X;
}

/** Altura ocupada pela grade: linha começada é linha inteira. */
export function alturaDaGrade(
  quantidade: number,
  colunas: number = COLUNAS_DA_GRADE,
): number {
  return Math.ceil(quantidade / colunas) * PASSO_Y;
}

/** Altura da fileira do tomo: o que for maior entre os documentos e a grade. */
export function alturaDaFileira(quantidadeDeFolhas: number): number {
  return Math.max(ALTURA_MINIMA_FILEIRA, alturaDaGrade(quantidadeDeFolhas) + FOLGA_DA_FILEIRA);
}

/**
 * O `y` de cada fileira, ACUMULADO. Era `linha * 330` fixo — com um tomo de 200
 * folhas, a fileira de baixo era desenhada por cima da grade de cima.
 */
export function topoDasFileiras(alturas: readonly number[]): number[] {
  const topos: number[] = [];
  let cursor = 0;
  for (const altura of alturas) {
    topos.push(cursor);
    cursor += altura;
  }
  return topos;
}
