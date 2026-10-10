/**
 * OS CAPÍTULOS de um roteiro. O primeiro passo de cada parte traz `capitulo`;
 * os seguintes herdam. Puro (`scripts/test-nexo-tour.ts`).
 *
 * Servem para a pessoa saber onde está ("Achados · 3 de 13") e pular a parte
 * que já conhece, em vez de atravessar 28 balões para chegar à que quer.
 */
import type { PassoDoTour } from "./passos-do-tour.ts";

export interface Capitulo {
  nome: string;
  /** Índice do primeiro passo do capítulo. */
  inicio: number;
  /** Quantos passos ele tem. */
  total: number;
}

export function capitulosDoRoteiro(passos: PassoDoTour[]): Capitulo[] {
  const capitulos: Capitulo[] = [];
  passos.forEach((p, i) => {
    if (p.capitulo || capitulos.length === 0) capitulos.push({ nome: p.capitulo ?? "", inicio: i, total: 0 });
    capitulos[capitulos.length - 1].total++;
  });
  return capitulos;
}

export interface OndeEsta {
  capitulo: Capitulo;
  /** Posição do capítulo no roteiro, a partir de 0. */
  ordem: number;
  /** Posição do passo dentro do capítulo, a partir de 1. */
  passo: number;
  /** O primeiro passo do capítulo seguinte; `null` no último. */
  proximoCapitulo: number | null;
}

export function ondeEsta(capitulos: Capitulo[], indice: number): OndeEsta {
  let ordem = 0;
  for (let k = 0; k < capitulos.length; k++) if (capitulos[k].inicio <= indice) ordem = k;
  const capitulo = capitulos[ordem];
  const seguinte = capitulos[ordem + 1];
  return { capitulo, ordem, passo: indice - capitulo.inicio + 1, proximoCapitulo: seguinte ? seguinte.inicio : null };
}

/**
 * O clique de vista que um passo pressupõe: o dele, ou o do último passo antes
 * dele que trocou de vista. Quem chega por SALTO (retomada, pular capítulo,
 * voltar) não passou pelo clique do caminho.
 */
export function cliqueQueOPassoPressupoe(passos: PassoDoTour[], indice: number): string | undefined {
  for (let i = indice; i >= 0; i--) if (passos[i].clicarAntes) return passos[i].clicarAntes;
  return undefined;
}

/**
 * OS PASSOS QUE VÃO APARECER (10/10/2026). A contagem ("O mapa · 6 de 8") era
 * feita sobre o roteiro inteiro, e o passo pulado por `soSeExistir` deixava um
 * buraco: do "6 de 8" se ia ao "8 de 8". Conta-se sobre os que ficam; um
 * capítulo cujo primeiro passo saiu passa o nome ao seguinte dele.
 */
export function semOsAusentes(
  passos: PassoDoTour[],
  fora: ReadonlySet<number>,
): { passos: PassoDoTour[]; indices: number[] } {
  const ficam: PassoDoTour[] = [];
  const indices: number[] = [];
  let capituloPendente: string | undefined;
  passos.forEach((p, i) => {
    if (fora.has(i)) {
      if (p.capitulo) capituloPendente = p.capitulo;
      return;
    }
    ficam.push(capituloPendente && !p.capitulo ? { ...p, capitulo: capituloPendente } : p);
    indices.push(i);
    capituloPendente = undefined;
  });
  return { passos: ficam, indices };
}

/**
 * Os passos À FRENTE que já se sabe que vão ser pulados: pedem um alvo
 * (`soSeExistir`) que não está na tela, e nenhum passo no caminho troca de
 * vista. Depois de uma troca de vista não dá para prever — o alvo pode nascer
 * com ela. Sem a previsão, o total mudaria no meio ("6 de 8" → "7 de 7").
 */
export function ausentesPrevistos(passos: PassoDoTour[], indice: number, existe: (seletor: string) => boolean): number[] {
  const fora: number[] = [];
  for (let j = indice + 1; j < passos.length; j++) {
    if (passos[j].clicarAntes) break;
    const sel = passos[j].soSeExistir;
    if (sel && !existe(sel)) fora.push(j);
  }
  return fora;
}
