/**
 * O ENQUADRAMENTO DO CARIMBO — onde a página tem de estar para o selo encher o
 * quadro. Núcleo puro (só `import type`): roda no node cru.
 *
 * Confere-se o CARIMBO, não a prancha inteira. Numa A0 de 2384×1684 o carimbo
 * ocupa cerca de 4% da área — abrir a folha inteira e mandar o engenheiro
 * procurar o canto inferior direito é o gesto mais repetido do produto, e o
 * único que o software podia ter poupado desde o começo.
 *
 * A caixa NÃO é chutada: vem de `acharCaixaDoSelo`, que a mede pelos rótulos do
 * próprio carimbo (PRANCHA, ESCALA, ARQUIVO…). É a MESMA caixa que o recorte
 * enviado ao modelo usa — e isso importa mais do que parece: se o olho humano
 * enquadrasse um pedaço de papel diferente daquele de onde saíram os dados, a
 * conferência estaria julgando outra coisa.
 *
 * O resultado é uma transformação CSS (escala + deslocamento), não um recorte
 * de imagem: assim o texto continua selecionável, o zoom continua nítido, e sair
 * do modo selo é trocar dois números — não recarregar a página.
 */

/** Retângulo normalizado (0..1), y crescendo para baixo. */
export interface CaixaNormalizada {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** O que o CSS precisa: `transform: translate(x, y) scale(escala)`. */
export interface Enquadramento {
  escala: number;
  x: number;
  y: number;
}

/**
 * Folga em volta do carimbo. Sem ela o selo encosta nas bordas do quadro e
 * perde o contexto do canto da prancha — e é o canto que diz "isto é o carimbo,
 * não uma tabela qualquer".
 */
const FOLGA = 0.88;

/** Escala máxima: acima disto o raster do pdfjs aparece antes do carimbo. */
const ESCALA_MAXIMA = 6;

/**
 * A página inteira, sem enquadramento nenhum. É o estado de saída do modo selo,
 * e o de reserva quando a geometria falha.
 */
export const PAGINA_INTEIRA: Enquadramento = { escala: 1, x: 0, y: 0 };

/**
 * Onde pôr a página para o carimbo encher o quadro.
 *
 * `origem` do transform é o canto superior esquerdo — é o que torna a conta
 * `escala · ponto + deslocamento`, sem termo de correção.
 */
/**
 * Teto de densidade de render. Quatro: acima disso a tela ganha pouco e a
 * memória do canvas cresce ao quadrado — uma prancha A0 a 8× passa de 100
 * megapixels, e o navegador devolve canvas em branco em vez de erro.
 */
export const DENSIDADE_MAXIMA = 4;

/**
 * EM QUE DENSIDADE RASTERIZAR a página para que o carimbo seja LEGÍVEL.
 *
 * O visor rasterizava numa largura fixa e depois ampliava por CSS. Ampliar
 * bitmap não cria detalhe: enquadrar o carimbo a 3× entregava o carimbo borrado
 * — e um carimbo que não se lê derruba a razão de existir do modo selo, que é
 * justamente conferir o carimbo.
 *
 * A correção é pedir ao pdfjs mais PIXEL, não mais tamanho: o layout continua
 * em pixels de CSS (o enquadramento não muda), só a densidade do canvas sobe
 * junto com o zoom.
 */
export function densidadeDeRender(escala: number, dpr = 1): number {
  const base = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const desejada = (Number.isFinite(escala) && escala > 0 ? escala : 1) * base;
  // Nunca abaixo da densidade da tela: a folha inteira (escala 1) já precisa
  // do dpr do monitor para não sair borrada num display retina.
  return Math.min(DENSIDADE_MAXIMA, Math.max(base, desejada));
}

export function enquadrarSelo(
  caixa: CaixaNormalizada,
  pagina: { largura: number; altura: number },
  quadro: { largura: number; altura: number },
): Enquadramento {
  const largura = (caixa.x1 - caixa.x0) * pagina.largura;
  const altura = (caixa.y1 - caixa.y0) * pagina.altura;

  /*
   * Caixa degenerada = geometria falhou (nenhuma âncora, página sem texto).
   * Devolve a página inteira em vez de dividir por zero: a regra do produto é
   * que a ausência nunca vira conflito, e aqui ela vira "veja a folha toda".
   */
  if (largura <= 0 || altura <= 0) return PAGINA_INTEIRA;
  if (quadro.largura <= 0 || quadro.altura <= 0) return PAGINA_INTEIRA;

  const escala = Math.min(
    ESCALA_MAXIMA,
    (Math.min(quadro.largura / largura, quadro.altura / altura) * FOLGA),
  );

  const centroX = ((caixa.x0 + caixa.x1) / 2) * pagina.largura;
  const centroY = ((caixa.y0 + caixa.y1) / 2) * pagina.altura;

  return {
    escala,
    x: quadro.largura / 2 - escala * centroX,
    y: quadro.altura / 2 - escala * centroY,
  };
}
