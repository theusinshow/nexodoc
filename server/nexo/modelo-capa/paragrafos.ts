/**
 * Os parágrafos com texto do corpo do ODT, na MESMA enumeração de
 * `server/odt/layout.ts` (parágrafo E título, auto-fechado primeiro). O índice
 * é o que a injeção usa para achar o parágrafo de volta — enumerar diferente
 * aqui marcaria a linha errada.
 *
 * PURO: nenhum import de runtime.
 */
import type { ParagrafoDaCapa } from "./tipos.ts";

export const PARAGRAFO_RE =
  /<text:(?:p|h)\b[^>]*\/>|<text:(p|h)\b[^>]*(?<!\/)>[\s\S]*?<\/text:\1>/g;

/** Início e fim do miolo de `<office:text>`. */
export function corpoDoTexto(contentXml: string): { inicio: number; fim: number } {
  const abre = /<office:text\b[^>]*>/.exec(contentXml);
  if (!abre) throw new Error("ODT sem office:text");
  const inicio = abre.index + abre[0].length;
  const fim = contentXml.indexOf("</office:text>", inicio);
  if (fim < 0) throw new Error("ODT sem fechamento de office:text");
  return { inicio, fim };
}

export function decodificar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Texto visível de um parágrafo bruto: `<text:s/>`, tab e quebra viram espaço. */
export function textoDoParagrafo(bruto: string): string {
  return decodificar(
    bruto
      .replace(/^<text:(?:p|h)\b[^>]*>/, "")
      .replace(/<\/text:(?:p|h)>$/, "")
      .replace(/<text:(?:s|tab|line-break)\b[^>]*\/>/g, " ")
      .replace(/<[^>]*>/g, ""),
  );
}

/** O XML a partir de `<office:body>` — o mesmo recorte de `lerLayoutDoModelo`. */
export function inicioDoCorpo(contentXml: string): number {
  const i = contentXml.indexOf("<office:body");
  return i >= 0 ? i : 0;
}

export function lerParagrafos(contentXml: string): ParagrafoDaCapa[] {
  const corpo = contentXml.slice(inicioDoCorpo(contentXml));
  const brutos = corpo.match(PARAGRAFO_RE) ?? [];
  const saida: ParagrafoDaCapa[] = [];
  brutos.forEach((bruto, indice) => {
    const texto = textoDoParagrafo(bruto).replace(/\s+/g, " ").trim();
    if (texto) saida.push({ indice, texto });
  });
  return saida;
}
