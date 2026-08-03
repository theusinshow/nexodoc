/**
 * O TOTAL DE REFERÊNCIA de um conjunto de folhas — o "24" de "05/24".
 *
 * Ele é inferido do carimbo (o `/TT` dominante) e decide duas coisas: como a LD
 * numera as folhas e quantas folhas a conferência espera encontrar. Quando o OCR
 * lê o total errado na maioria das pranchas, a inferência vira acusação — um
 * bloco completo sai com folhas "faltando" — e até aqui não havia como dizer que
 * o carimbo mentiu.
 *
 * A correção é guardada POR DISCIPLINA, porque é assim que o escritório numera:
 * cada disciplina vai de 1 a N, e todas as folhas dela imprimem o mesmo total.
 *
 * PURO: nenhum import de runtime, para rodar em Node pelado no
 * `scripts/test-nexo-totais.ts`. A disciplina de cada folha chega INJETADA
 * (`codigoDe`) porque quem a resolve é `disciplina-da-folha.ts`, que importa o
 * parser de nome de arquivo e não roda em node cru.
 */

import type { Folha } from "./folhas.ts";

/**
 * O total corrigido à mão que vale para ESTE conjunto, ou `undefined` quando não
 * há um que valha.
 *
 * Só devolve número quando o conjunto inteiro é de UMA disciplina. Um documento
 * que mistura duas não tem um total só: "de 11" e "de 5" são verdades de blocos
 * diferentes, e escolher uma delas numeraria metade das folhas errado. Nesse
 * caso o carimbo continua mandando, que é o comportamento de sempre.
 */
export function totalDoConjunto(
  lista: readonly Folha[],
  totais: Readonly<Record<string, number>>,
  codigoDe: (folha: Folha) => string,
): number | undefined {
  if (lista.length === 0) return undefined;

  const codigos = new Set<string>();
  for (const folha of lista) codigos.add(codigoDe(folha).trim().toLowerCase());
  if (codigos.size !== 1) return undefined;

  const [codigo] = [...codigos];
  const total = totais[codigo];
  return typeof total === "number" && Number.isFinite(total) && total > 0
    ? Math.trunc(total)
    : undefined;
}
