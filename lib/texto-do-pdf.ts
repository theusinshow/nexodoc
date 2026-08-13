/**
 * Quando dois pedaços da camada de texto do PDF são a MESMA palavra.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * O pdf.js não devolve uma linha por vez: devolve os trechos na ordem em que o
 * arquivo os desenha. Ele já junta sozinho o que está colado — inclusive
 * kerning — e, quando enxerga um vão de espaço, emite um item `" "` explícito.
 * Mas ele CORTA um item novo quando muda o estado do texto, e a troca de fonte
 * no meio de uma palavra é o caso que aparece em memorial: um "R" em negrito
 * seguido de "espingos" em regular são dois itens encostados, sem espaço nenhum
 * entre eles.
 *
 * Enquanto a extração juntava item com item usando um espaço, essa palavra
 * chegava ao modelo escrita "r espingos" — e o auditor, corretamente, relatava
 * erro de português em palavra que na página está escrita certo. O falso
 * positivo não era do prompt: era do texto. Medido num PDF montado com a mesma
 * troca de fonte: `["r", "espingos"]` a 0,6pt de distância viravam "r espingos".
 *
 * POR QUE GEOMETRIA, E NÃO EXPRESSÃO REGULAR
 *
 * A tentação é costurar depois: juntar letra solta com a palavra seguinte. Mas
 * um memorial é cheio de coisa que É letra solta e tem de continuar solta —
 * siglas ("P.C.D.", "ABNT NBR"), unidades ("m 2", "kg f"), numeração de item
 * ("1 . 2 . 3"). Uma regra de texto não tem como distinguir, e errar para o
 * outro lado GRUDA palavras: dois erros de português inventados no lugar de um.
 *
 * A página, porém, sabe. Um espaço de verdade ocupa largura; um ajuste de
 * kerning não. A decisão aqui é medida, não adivinhada — e por isso não precisa
 * conhecer o idioma, a sigla nem a unidade.
 *
 * Puro de propósito: recebe os itens já extraídos, não importa o pdf.js. É o
 * que permite testá-lo em node cru (`scripts/test-texto-do-pdf.ts`).
 */

/**
 * O subconjunto do item da camada de texto do pdf.js que interessa aqui.
 * `transform` é a matriz do texto: `[a, b, c, d, e, f]`, com `e` = x e `f` = y
 * na origem inferior-esquerda da página.
 */
export interface ItemDeTexto {
  str: string;
  transform: number[];
  width: number;
  /** Altura da fonte já escalada. O pdf.js entrega; o fallback é `transform[3]`. */
  height?: number;
  /** O pdf.js marca com isto o item que termina uma linha. */
  hasEOL?: boolean;
}

/**
 * A fração do corpo da fonte a partir da qual um vão vira espaço.
 *
 * Os dois lados são medidos, e ficam longe um do outro: o avanço de um espaço
 * fica entre 0,20 e 0,30 do corpo nas fontes de texto (e não desce de ~0,20 nem
 * nas condensadas), enquanto ajuste de kerning e tracking de título raramente
 * passam de 0,10. 0,15 cai na terra de ninguém entre os dois — com margem para
 * os dois erros, que não são simétricos:
 *
 *  - alto demais GRUDA palavras ("PROJETOEXECUTIVO"), inventando erro novo;
 *  - baixo demais deixa o defeito de pé ("r espingos").
 */
const FRACAO_DE_ESPACO = 0.15;

/** Quanto os `y` podem diferir e ainda ser a mesma linha. */
const FRACAO_DE_LINHA = 0.5;

function corpoDaFonte(item: ItemDeTexto): number {
  const altura = Math.abs(item.height ?? 0);
  if (altura > 0) return altura;
  return Math.abs(item.transform?.[3] ?? 0);
}

/**
 * O que vai ENTRE dois itens vizinhos: `""` (mesma palavra) ou `" "`.
 *
 * É a única regra do assunto no repositório. A extração (`lib/pdf-text.ts`) e o
 * localizador do pin (`server/nexo/audit/locate-term.ts`) chamam esta função em
 * vez de cada um juntar do seu jeito — se divergissem, a evidência diria
 * "respingos" e o pin procuraria "r espingos" na mesma página.
 */
export function separadorEntreItens(anterior: ItemDeTexto, proximo: ItemDeTexto): string {
  // O pdf.js já disse que a linha acabou. Não há o que medir.
  if (anterior.hasEOL) return " ";

  // O espaço já está escrito num dos lados — repeti-lo criaria vão duplo.
  if (/\s$/.test(anterior.str) || /^\s/.test(proximo.str)) return "";

  const corpo = corpoDaFonte(anterior) || corpoDaFonte(proximo);
  // Sem corpo de fonte não há como medir nada. Cai no comportamento antigo, que
  // erra para o lado de separar — errar para o lado de grudar seria pior.
  if (corpo <= 0) return " ";

  const yAnterior = anterior.transform?.[5] ?? 0;
  const yProximo = proximo.transform?.[5] ?? 0;
  if (Math.abs(yProximo - yAnterior) > corpo * FRACAO_DE_LINHA) return " ";

  const fimDoAnterior = (anterior.transform?.[4] ?? 0) + (anterior.width ?? 0);
  const vao = (proximo.transform?.[4] ?? 0) - fimDoAnterior;

  /*
   * Vão negativo é sobreposição: acontece em texto redesenhado por cima de si
   * (efeito de negrito falso) e em kerning agressivo. Nos dois casos é a mesma
   * palavra — separar ali é que seria a invenção.
   */
  return vao >= corpo * FRACAO_DE_ESPACO ? " " : "";
}

/**
 * A linha de texto de uma página, com os pedaços costurados pela medida acima.
 *
 * Não colapsa espaço nem apara as pontas: quem chama decide, porque o
 * localizador do pin precisa das posições preservadas para mapear o casamento
 * de volta ao item.
 */
export function textoDosItens(items: ItemDeTexto[]): string {
  let texto = "";
  let anterior: ItemDeTexto | null = null;
  /*
   * O pdf.js marca o fim de linha num item VAZIO (`{ str: "", hasEOL: true }`)
   * — visto no PDF da prova, entre duas linhas. Ele não escreve nada, então é
   * descartado; mas descartá-lo sem olhar era jogar fora a única marca de
   * quebra que existe, e as duas linhas se encostavam.
   */
  let quebraPendente = false;

  for (const item of items) {
    if (!item.str) {
      if (item.hasEOL) quebraPendente = true;
      continue;
    }
    if (anterior) {
      texto += quebraPendente ? " " : separadorEntreItens(anterior, item);
    }
    texto += item.str;
    anterior = item;
    quebraPendente = false;
  }

  return texto;
}
