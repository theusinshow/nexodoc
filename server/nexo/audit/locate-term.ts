/**
 * Acha a posição aproximada de um trecho na camada de texto do pdf.js, para o
 * canvas da auditoria ancorar o pin do achado sobre a miniatura da página.
 *
 * É BEST-EFFORT de propósito: não achou -> null, e a UI cai no badge de página.
 * Puro (sem pdf.js, sem DOM): recebe os itens já extraídos e devolve percentual.
 */

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

// Mínimo de caracteres para um item CONTIDO no termo servir de âncora. Itens
// curtos da camada de texto ("de", "da", "e") aparecem na página inteira: casar
// com eles põe o pin em qualquer lugar, e pin errado é pior que pin nenhum.
const MIN_ANCHOR_LENGTH = 3;

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

export function locateTermOnPage(input: LocateInput): PinPosition | null {
  const { items, pageWidth, pageHeight, termo } = input;
  const needle = termNeedle(termo);
  if (!needle || pageWidth <= 0 || pageHeight <= 0) return null;

  for (const it of items) {
    const hay = norm(it.str);
    if (!hay) continue;
    // Ou o item contém o trecho, ou o item é o COMEÇO do trecho — a camada de
    // texto quebra a frase da esquerda pra direita, então o primeiro pedaço é
    // prefixo do termo. Qualquer outro "contido" é coincidência.
    const casa =
      hay.includes(needle) ||
      (hay.length >= MIN_ANCHOR_LENGTH && needle.startsWith(hay));
    if (casa) {
      const x = it.transform[4];
      const y = it.transform[5];
      return {
        xPct: clamp01(x / pageWidth),
        yPct: clamp01(1 - y / pageHeight),
      };
    }
  }
  return null;
}
