/**
 * Soltar uma folha no canvas → o que escrever em `ajustes`.
 *
 * O canvas só reporta COORDENADA; a regra mora aqui, onde dá para testar em Node
 * pelado. Ordem esparsa é aritmética que erra em silêncio — folha que "volta"
 * para o lugar, duas folhas com a mesma ordem — e um defeito desses só apareceria
 * no PDF montado.
 *
 * PURO: nenhum import de runtime.
 */

import { chaveDeOrdem, type Ajuste, type Folha, type FolhaId } from "./folhas.ts";
import { COLUNAS_DA_GRADE, PASSO_X, PASSO_Y } from "./layout-canvas.ts";

/** Uma fileira, como o canvas a desenhou: onde está e o que tem dentro. */
export interface FileiraDoDrop {
  tomo: number;
  /** Caixa da fileira inteira, em coordenadas do canvas. */
  topo: number;
  altura: number;
  /** Canto superior esquerdo da grade de folhas. */
  gradeX: number;
  gradeY: number;
  /** Ids das folhas da fileira, na ordem em que estão desenhadas. */
  folhas: FolhaId[];
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Em que tomo e em que posição da grade o ponto caiu. `null` quando cai fora de
 * qualquer fileira — soltar no vazio não inventa tomo (isso é o 4B).
 *
 * A coluna usa ARREDONDAMENTO, não truncamento: o alvo é a fresta ENTRE duas
 * folhas, então soltar na metade direita de uma folha insere depois dela.
 */
export function alvoDoDrop(
  ponto: { x: number; y: number },
  fileiras: readonly FileiraDoDrop[],
): { tomo: number; indice: number } | null {
  const fileira = fileiras.find(
    (f) => ponto.y >= f.topo && ponto.y < f.topo + f.altura,
  );
  if (!fileira) return null;

  const coluna = limitar(Math.round((ponto.x - fileira.gradeX) / PASSO_X), 0, COLUNAS_DA_GRADE);
  const linha = Math.max(0, Math.floor((ponto.y - fileira.gradeY) / PASSO_Y));
  const indice = limitar(linha * COLUNAS_DA_GRADE + coluna, 0, fileira.folhas.length);
  return { tomo: fileira.tomo, indice };
}

/**
 * As ordens esparsas para `quantas` folhas soltas entre dois vizinhos. Reparte o
 * intervalo em partes iguais, preservando a ordem relativa de quem foi junto.
 *
 * Esparsa de propósito: mover uma folha não renumera as outras, e é isso que faz
 * dois arrastos seguidos não brigarem.
 */
export function ordensEntre(
  anterior: number | null,
  proxima: number | null,
  quantas: number,
): number[] {
  if (quantas <= 0) return [];
  if (anterior === null && proxima === null) {
    return Array.from({ length: quantas }, (_, i) => i);
  }
  if (anterior === null) {
    return Array.from({ length: quantas }, (_, i) => proxima! - (quantas - i));
  }
  if (proxima === null) {
    return Array.from({ length: quantas }, (_, i) => anterior + 1 + i);
  }
  const passo = (proxima - anterior) / (quantas + 1);
  return Array.from({ length: quantas }, (_, i) => anterior + passo * (i + 1));
}

/**
 * O que escrever em `ajustes` por causa deste arrasto.
 *
 * `temDivisao` falso (uma fileira só) NÃO escreve `grupo`: sem divisão, gravar o
 * tomo seria inventar uma decisão que o usuário não tomou.
 */
export function ajusteDoDrop(
  movidas: readonly Folha[],
  alvo: { tomo: number; indice: number },
  fileiraAlvo: readonly Folha[],
  temDivisao: boolean,
): { id: FolhaId; patch: Ajuste }[] {
  if (movidas.length === 0) return [];

  const indoJunto = new Set(movidas.map((f) => f.id));
  /*
   * A fileira de destino SEM quem está sendo movido: soltar entre A e B tem de
   * olhar para quem VAI ficar lá. Contar a própria folha arrastada como vizinha
   * daria uma ordem no lugar de onde ela está saindo.
   */
  const restantes = fileiraAlvo.filter((f) => !indoJunto.has(f.id));
  const indice = limitar(alvo.indice, 0, restantes.length);

  // Quem foi junto entra na ordem em que já estava — arrastar não embaralha.
  const naOrdem = [...movidas].sort((a, b) => chaveDeOrdem(a) - chaveDeOrdem(b));

  /*
   * Soltar exatamente onde já estava não escreve nada. Sem esta guarda, encostar
   * numa folha e largar no mesmo lugar gravaria `grupo` e `ordem` — o estado
   * cresceria a cada gesto sem efeito, e a folha passaria a ter posição FIXADA à
   * mão sem que ninguém tenha decidido isso.
   */
  const jaMoravamAqui = naOrdem.every((f) => fileiraAlvo.some((g) => g.id === f.id));
  if (jaMoravamAqui) {
    const depois = [
      ...restantes.slice(0, indice).map((f) => f.id),
      ...naOrdem.map((f) => f.id),
      ...restantes.slice(indice).map((f) => f.id),
    ];
    const antes = fileiraAlvo.map((f) => f.id);
    if (antes.length === depois.length && antes.every((id, i) => id === depois[i])) {
      return [];
    }
  }

  const anterior = indice > 0 ? chaveDeOrdem(restantes[indice - 1]) : null;
  const proxima = indice < restantes.length ? chaveDeOrdem(restantes[indice]) : null;
  const ordens = ordensEntre(anterior, proxima, naOrdem.length);

  return naOrdem.map((f, i) => ({
    id: f.id,
    patch: temDivisao ? { grupo: alvo.tomo, ordem: ordens[i] } : { ordem: ordens[i] },
  }));
}
