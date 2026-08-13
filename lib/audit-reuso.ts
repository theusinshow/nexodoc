/**
 * O QUE SE REAPROVEITA entre duas revisões do mesmo memorial.
 *
 * Puro e sem `@/` no caminho de valor: todas as decisões de reuso são
 * determinísticas e precisam ser testáveis sem gastar token. O modelo só entra
 * para ler o que mudou — quem decide o que mudou é este arquivo.
 */
import type { CapituloImpresso } from "./audit-report.ts";

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
