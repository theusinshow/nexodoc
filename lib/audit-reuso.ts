/**
 * O QUE SE REAPROVEITA entre duas revisões do mesmo memorial.
 *
 * Puro e sem `@/` no caminho de valor: todas as decisões de reuso são
 * determinísticas e precisam ser testáveis sem gastar token. O modelo só entra
 * para ler o que mudou — quem decide o que mudou é este arquivo.
 */
import type { CapituloImpresso } from "./audit-report.ts";
import type { ExtractedPdfPage } from "./pdf-text.ts";

/**
 * A página de um achado é texto livre no parecer ("7", "11 e 14", "pág. 5").
 * Vale o PRIMEIRO número: é nele que o visor de PDF abre.
 */
export function paginaDoAchado(pagina: string): number | null {
  const m = /\d+/.exec(pagina ?? "");
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A qual capítulo pertence o achado — POR PÁGINA, nunca pelo campo `capitulo`.
 * O texto do campo é ambíguo: "1 - APRESENTACAO" aparece três vezes nos
 * memoriais reais, e casar por título traria o achado do capítulo errado.
 */
export function capituloDoAchado(
  pagina: string,
  capitulos: readonly CapituloImpresso[],
): CapituloImpresso | null {
  const n = paginaDoAchado(pagina);
  if (n === null) return null;
  return capitulos.find((c) => n >= c.startPage && n <= c.endPage) ?? null;
}

/**
 * Capítulo casado por HASH é byte a byte idêntico. Se ele ocupa o mesmo número
 * de páginas antes e agora, tudo dentro dele andou o mesmo tanto, e a âncora é
 * uma soma — sem busca e sem token. É o caso que motivou o projeto: entrou um
 * capítulo no meio e o resto do documento desceu junto.
 *
 * Se o número de páginas MUDOU, as quebras internas se moveram e a soma
 * uniforme mentiria. Devolve `null` para quem chama tentar o caminho seguinte.
 */
export function reancorarPorAritmetica(
  pagina: string,
  antes: CapituloImpresso,
  agora: CapituloImpresso,
): number | null {
  const n = paginaDoAchado(pagina);
  if (n === null) return null;
  if (n < antes.startPage || n > antes.endPage) return null;
  if (agora.endPage - agora.startPage !== antes.endPage - antes.startPage) return null;
  return n + (agora.startPage - antes.startPage);
}

/**
 * Normalização para BUSCA — e só para busca. Aqui, ao contrário do hash da
 * impressão digital, tirar acento e caixa é o certo: o termo foi escrito pelo
 * modelo e o texto veio do pdf.js, e os dois divergem em acentuação e
 * espaçamento sem que o trecho seja outro.
 */
function paraBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Onde está o termo no documento NOVO. Usado quando a aritmética não serve —
 * capítulo que passou a ocupar outro número de páginas.
 *
 * Devolve `null` quando não acha: o chamador trata isso promovendo o capítulo
 * para releitura, que é o lado seguro (gastar, não perder).
 */
export function reancorarPorTermo(
  termo: string | undefined,
  paginas: readonly ExtractedPdfPage[],
): number | null {
  const alvo = paraBusca(termo ?? "");
  if (!alvo) return null;
  const encontrada = paginas.find((p) => paraBusca(p.text).includes(alvo));
  return encontrada ? encontrada.page : null;
}
