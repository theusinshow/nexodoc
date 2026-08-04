/**
 * Onde o balão do tour se encaixa em relação ao alvo.
 *
 * PURO (`scripts/test-nexo-tour.ts`): a regra que decide vira teste em vez de
 * "parece certo na minha tela". As duas coisas que quebram um tour na mão do
 * usuário são o balão que sai da janela e o balão que tapa justamente o que ele
 * aponta — as duas são geometria, e geometria se prova.
 */

export type LadoDoBalao = "acima" | "abaixo" | "esquerda" | "direita";

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Respiro entre o alvo e o balão, e entre o balão e a borda da janela. */
export const FOLGA = 12;
export const MARGEM = 16;

function cabe(
  lado: LadoDoBalao,
  alvo: Retangulo,
  balao: { largura: number; altura: number },
  janela: { largura: number; altura: number },
): boolean {
  if (lado === "acima") return alvo.y - FOLGA - balao.altura >= MARGEM;
  if (lado === "abaixo") return alvo.y + alvo.altura + FOLGA + balao.altura <= janela.altura - MARGEM;
  if (lado === "esquerda") return alvo.x - FOLGA - balao.largura >= MARGEM;
  return alvo.x + alvo.largura + FOLGA + balao.largura <= janela.largura - MARGEM;
}

function prende(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
}

/**
 * Devolve o canto superior esquerdo do balão e o lado realmente usado.
 *
 * O lado pedido é uma PREFERÊNCIA: se não couber, tenta o oposto e depois os
 * perpendiculares. Não cabendo em lado nenhum (alvo enorme, janela pequena), o
 * balão vai para o centro da janela — sem alvo é melhor que fora da tela.
 */
export function posicaoDoBalao(
  alvo: Retangulo,
  balao: { largura: number; altura: number },
  janela: { largura: number; altura: number },
  ladoPreferido: LadoDoBalao = "abaixo",
): { x: number; y: number; lado: LadoDoBalao | "centro" } {
  const oposto: Record<LadoDoBalao, LadoDoBalao> = {
    acima: "abaixo",
    abaixo: "acima",
    esquerda: "direita",
    direita: "esquerda",
  };
  const ordem: LadoDoBalao[] = [
    ladoPreferido,
    oposto[ladoPreferido],
    ...(["abaixo", "acima", "direita", "esquerda"] as LadoDoBalao[]),
  ];
  const lado = ordem.find((l) => cabe(l, alvo, balao, janela));

  if (!lado) {
    return {
      x: Math.round((janela.largura - balao.largura) / 2),
      y: Math.round((janela.altura - balao.altura) / 2),
      lado: "centro",
    };
  }

  const centroX = alvo.x + alvo.largura / 2 - balao.largura / 2;
  const centroY = alvo.y + alvo.altura / 2 - balao.altura / 2;
  const limiteX = janela.largura - balao.largura - MARGEM;
  const limiteY = janela.altura - balao.altura - MARGEM;

  if (lado === "acima" || lado === "abaixo") {
    return {
      x: Math.round(prende(centroX, MARGEM, limiteX)),
      y: Math.round(
        lado === "acima" ? alvo.y - FOLGA - balao.altura : alvo.y + alvo.altura + FOLGA,
      ),
      lado,
    };
  }

  return {
    x: Math.round(
      lado === "esquerda" ? alvo.x - FOLGA - balao.largura : alvo.x + alvo.largura + FOLGA,
    ),
    y: Math.round(prende(centroY, MARGEM, limiteY)),
    lado,
  };
}
