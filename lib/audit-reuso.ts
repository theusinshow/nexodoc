/**
 * O QUE SE REAPROVEITA entre duas revisões do mesmo memorial.
 *
 * Puro e sem `@/` no caminho de valor: todas as decisões de reuso são
 * determinísticas e precisam ser testáveis sem gastar token. O modelo só entra
 * para ler o que mudou — quem decide o que mudou é este arquivo.
 */
import type { DeltaDeCapitulos } from "./audit-fingerprint.ts";
import type { AuditFinding, CapituloImpresso } from "./audit-report.ts";
import type { ExtractedPdfPage } from "./pdf-text.ts";

/**
 * VERSÃO DO AUDITOR. Suba à mão ao mexer no prompt ou no modelo da leitura
 * global: achado herdado foi produzido pelo auditor de ontem, e servi-lo depois
 * de melhorar o prompt é servir leitura vencida. Mesma regra do cache de
 * leitura de selo.
 */
export const VERSAO_AUDITOR = 1;

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

export type PlanoDeReuso = {
  capitulosParaLer: CapituloImpresso[];
  achadosHerdados: AuditFinding[];
  hashesHerdados: string[];
  promovidos: { titulo: string; motivo: "sem-ancora" }[];
};

/**
 * O que o modelo vai reler e o que sobrevive da auditoria anterior.
 *
 * Ordem das decisões:
 * 1. Versão do auditor diferente (ou ausente) → nada é herdado, tudo é lido.
 * 2. Achado de regra → descartado sempre; as regras reprocessam de graça.
 * 3. Achado de capítulo que sumiu ou que mudou → descartado; o capítulo vai ao
 *    modelo e produz achado fresco.
 * 4. Achado de capítulo igual → reancora por aritmética, depois por termo.
 * 5. Falhou a âncora → o capítulo INTEIRO sai dos iguais e vai para leitura, e
 *    os achados dele são descartados (virão frescos do modelo).
 */
export function planejarReuso(args: {
  delta: DeltaDeCapitulos;
  capitulosAntes: readonly CapituloImpresso[];
  achadosAntes: readonly AuditFinding[];
  paginasAgora: readonly ExtractedPdfPage[];
  versaoAnterior?: number;
}): PlanoDeReuso {
  const mudados = [...args.delta.alterados.map((a) => a.agora), ...args.delta.novos];

  if (args.versaoAnterior !== VERSAO_AUDITOR) {
    return {
      capitulosParaLer: [...args.delta.iguais, ...mudados],
      achadosHerdados: [],
      hashesHerdados: [],
      promovidos: [],
    };
  }

  const herdadosPorHash = new Map<string, AuditFinding[]>();
  const semAncora = new Set<string>();

  for (const finding of args.achadosAntes) {
    if (finding.origem === "regra") continue;

    const capAntes = capituloDoAchado(finding.pagina, args.capitulosAntes);
    if (!capAntes) continue;

    const capAgora = args.delta.iguais.find((c) => c.hash === capAntes.hash);
    if (!capAgora) continue; // alterado, novo ou sumido: virá fresco

    const pagina =
      reancorarPorAritmetica(finding.pagina, capAntes, capAgora) ??
      reancorarPorTermo(finding.termo_busca, args.paginasAgora);

    if (pagina === null) {
      semAncora.add(capAgora.hash);
      continue;
    }

    const lista = herdadosPorHash.get(capAgora.hash) ?? [];
    lista.push({ ...finding, pagina: String(pagina) });
    herdadosPorHash.set(capAgora.hash, lista);
  }

  const promovidosCapitulos = args.delta.iguais.filter((c) => semAncora.has(c.hash));
  const iguaisMantidos = args.delta.iguais.filter((c) => !semAncora.has(c.hash));

  return {
    capitulosParaLer: [...mudados, ...promovidosCapitulos],
    achadosHerdados: iguaisMantidos.flatMap((c) => herdadosPorHash.get(c.hash) ?? []),
    hashesHerdados: iguaisMantidos.map((c) => c.hash),
    promovidos: promovidosCapitulos.map((c) => ({
      titulo: c.titulo,
      motivo: "sem-ancora" as const,
    })),
  };
}
