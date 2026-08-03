/**
 * Reconciliação de folhas por ORDEM DE PÁGINA — núcleo PURO (sem imports), para
 * ser testável com node cru.
 *
 * Problema: num PDF COMBINADO (várias pranchas no mesmo arquivo), o OCR do
 * carimbo é instável e às vezes devolve o mesmo número (ex.: "16") para várias
 * folhas. Mas as pranchas vêm EM ORDEM no PDF — a posição da página é 100%
 * confiável. Quando os candidatos têm DUPLICATAS, reatribuímos a folha pela
 * ordem da página, ancorando nas leituras boas (candidatos únicos): a folha
 * cresce de 1 em 1 por página (modelo linear folha = página + offset). Isso
 * também descarta capas/índice no começo (folha ≤ 0 -> null).
 *
 * Sem duplicatas (arquivos separados ou OCR limpo), mantém o candidato original.
 */

export interface SheetItem {
  /** Número da página dentro do PDF (1-based). */
  pageNumber: number;
  /** Folha lida pelo OCR/carimbo/nome; null se desconhecida. */
  candidate: number | null;
}

/**
 * A CORREÇÃO À MÃO, aplicada por último sobre o resultado já reconciliado.
 *
 * Vence tudo — o código do carimbo, o nome do arquivo, o OCR e a reconciliação
 * por ordem de página. A reconciliação é um MODELO e pode discordar de quem
 * está olhando a prancha; entre o modelo e quem viu, ganha quem viu.
 *
 * Sem esse último passo a correção não teria efeito nenhum: a resolução prefere
 * o campo ARQUIVO do carimbo, e é justamente quando ele está errado que alguém
 * corrige. Correção que perde para o parser é pior que correção nenhuma — o
 * engenheiro digita, vê o valor voltar, e para de confiar na tela.
 *
 * Valor ausente, zero ou negativo é IGNORADO: limpar o campo desfaz o ajuste e
 * devolve o que o carimbo dizia.
 */
export function aplicarFolhaManual(
  resolvidas: readonly (number | null)[],
  manuais: readonly (number | null | undefined)[],
): (number | null)[] {
  return resolvidas.map((valor, i) => {
    const manual = manuais[i];
    if (typeof manual === "number" && Number.isFinite(manual) && manual > 0) {
      return Math.trunc(manual);
    }
    return valor;
  });
}

/**
 * O TOTAL DE REFERÊNCIA — o "24" de "05/24" — com a correção à mão por cima.
 *
 * Irmã de `aplicarFolhaManual`, e aqui pelo mesmo motivo: é uma regra de
 * PRECEDÊNCIA, e regra de precedência sem teste é onde a correção silenciosamente
 * deixa de valer. `build-ld-proposal.ts` e `light-check-core.ts` calculam este
 * número separadamente (um numera a LD, o outro decide quantas folhas deveriam
 * existir) — e os dois têm de chegar ao mesmo, senão a LD diz "05/11" enquanto a
 * conferência cobra 21 folhas.
 *
 * O manual vence INCLUSIVE QUANDO É MENOR que o inferido. Tomar o máximo entre
 * os dois pareceria conservador e seria o pior dos mundos: o caso que motiva a
 * correção é justamente o OCR lendo o total A MAIS, e ali o conserto seria
 * aceito e descartado — o engenheiro digitaria 11, veria 21 de volta, e pararia
 * de confiar na tela.
 *
 * Valor ausente, zero ou negativo é IGNORADO: limpar o campo desfaz.
 */
export function totalDeReferencia(
  inferido: number,
  manual: number | null | undefined,
): number {
  if (typeof manual === "number" && Number.isFinite(manual) && manual > 0) {
    return Math.trunc(manual);
  }
  return inferido;
}

/** Valor mais frequente entre números. */
function modeOf(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/**
 * Reconcilia as folhas de UM arquivo (lista de páginas). Devolve a folha
 * resolvida de cada item, alinhada à entrada.
 */
export function reconcileByPageOrder(items: SheetItem[]): (number | null)[] {
  const result: (number | null)[] = items.map((it) => it.candidate);
  if (items.length <= 1) return result;

  const counts = new Map<number, number>();
  for (const it of items) {
    if (it.candidate != null) counts.set(it.candidate, (counts.get(it.candidate) ?? 0) + 1);
  }
  const hasDup = [...counts.values()].some((c) => c > 1);
  if (!hasDup) return result;

  // Índices ordenados pela página.
  const order = items
    .map((_, i) => i)
    .sort((a, b) => items[a].pageNumber - items[b].pageNumber);

  // Âncoras: candidatos ÚNICOS e positivos (leituras confiáveis).
  const anchors = order.filter(
    (i) =>
      items[i].candidate != null &&
      counts.get(items[i].candidate as number) === 1 &&
      (items[i].candidate as number) > 0,
  );

  if (anchors.length === 0) {
    // Sem âncora: rank puro por ordem de página (1..N).
    let rank = 1;
    for (const i of order) result[i] = rank++;
    return result;
  }

  // Offset dominante (folha - página) entre as âncoras → modelo linear.
  const offset = modeOf(
    anchors.map((i) => (items[i].candidate as number) - items[i].pageNumber),
  );
  for (const i of order) {
    const f = items[i].pageNumber + offset;
    result[i] = f > 0 ? f : null;
  }
  return result;
}
