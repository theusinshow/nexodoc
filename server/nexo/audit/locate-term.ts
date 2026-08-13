/**
 * Acha a posição aproximada de um trecho na camada de texto do pdf.js, para o
 * canvas da auditoria ancorar o pin do achado sobre a miniatura da página.
 *
 * É BEST-EFFORT de propósito: não achou -> null, e a UI cai no badge de página.
 * Puro (sem pdf.js, sem DOM): recebe os itens já extraídos e devolve percentual.
 */

// Caminho relativo COM extensão, e não o alias `@/`: este módulo é carregado
// por `node` cru no `test:nexo:locate-term`, que não tem resolvedor de alias.
import { separadorEntreItens } from "../../../lib/texto-do-pdf.ts";

// Item da camada de texto do pdf.js (subconjunto usado). transform[4]=x,
// transform[5]=y na origem inferior-esquerda do PDF.
export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export interface LocateInput {
  items: TextItem[];
  pageWidth: number; // em unidades do PDF (viewport.width)
  pageHeight: number; // em unidades do PDF (viewport.height)
  termo: string;
}

export interface PinPosition {
  xPct: number; // 0..1 a partir da esquerda
  yPct: number; // 0..1 a partir do TOPO (y do PDF já invertido)
}

// Quanto do trecho um item precisa cobrir para servir de âncora sozinho.
// Itens curtos da camada de texto ("de", "unidade") aparecem na página inteira:
// ancorar neles põe o pin em qualquer lugar, e pin errado é pior que pin nenhum.
const MIN_ANCHOR_LENGTH = 3;
const MIN_ANCHOR_COVERAGE = 0.5;

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Prefixo significativo do termo pra casar itens curtos da camada de texto
// (a evidência costuma ser mais longa que um item isolado).
function termNeedle(termo: string): string {
  const n = norm(termo);
  const words = n.split(" ").slice(0, 4).join(" ");
  return words.length >= 4 ? words : n;
}

function pinOf(item: TextItem, pageWidth: number, pageHeight: number): PinPosition {
  return {
    xPct: clamp01(item.transform[4] / pageWidth),
    yPct: clamp01(1 - item.transform[5] / pageHeight),
  };
}

export function locateTermOnPage(input: LocateInput): PinPosition | null {
  const { items, pageWidth, pageHeight, termo } = input;
  const needle = termNeedle(termo);
  if (!needle || pageWidth <= 0 || pageHeight <= 0) return null;

  const uteis = items
    .map((item) => ({ item, texto: norm(item.str) }))
    .filter((i) => i.texto.length > 0);

  // 1) O trecho cabe dentro de UM item — a âncora mais precisa que existe.
  for (const { item, texto } of uteis) {
    if (texto.includes(needle)) return pinOf(item, pageWidth, pageHeight);
  }

  // 2) O trecho está QUEBRADO entre itens vizinhos. Medido no 017_26: o pdfjs
  //    devolve "unidade básica de saúde" em pedaços, e sem esta passada o pin
  //    simplesmente não existia para 1 em cada 5 achados reais. Junta os itens
  //    na ordem de leitura e ancora no pedaço onde o trecho COMEÇA.
  //
  //    A COSTURA É A MESMA DA EXTRAÇÃO, e tem de ser. A evidência que chega
  //    aqui foi lida pelo modelo no texto montado por `textoDosItens`; se este
  //    laço juntasse tudo com espaço como antes, ele procuraria "r espingos"
  //    numa página onde a evidência diz "respingos", e o achado perderia o pin
  //    justamente nas palavras que a Etapa 2 consertou.
  const inicios: number[] = [];
  let juntado = "";
  let anterior: TextItem | null = null;
  for (const { item, texto } of uteis) {
    if (anterior) juntado += separadorEntreItens(anterior, item);
    inicios.push(juntado.length);
    juntado += texto;
    anterior = item;
  }
  const at = juntado.indexOf(needle);
  if (at >= 0) {
    let idx = 0;
    // Último item que começa em ou antes do casamento = onde o trecho começa.
    while (idx + 1 < inicios.length && inicios[idx + 1] <= at) idx++;
    return pinOf(uteis[idx].item, pageWidth, pageHeight);
  }

  // 3) Último recurso: o item é o COMEÇO do trecho (a evidência é mais longa que
  //    o que está escrito na página). Só vale se o item cobrir metade do trecho —
  //    a primeira palavra sozinha ("Rua", "unidade") repete na página inteira.
  for (const { item, texto } of uteis) {
    if (
      texto.length >= MIN_ANCHOR_LENGTH &&
      texto.length >= needle.length * MIN_ANCHOR_COVERAGE &&
      needle.startsWith(texto)
    ) {
      return pinOf(item, pageWidth, pageHeight);
    }
  }

  return null;
}
