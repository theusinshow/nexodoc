/**
 * Soltar uma folha no canvas → o que escrever em `ajustes`.
 *
 * O canvas só reporta COORDENADA; a regra mora aqui, onde dá para testar em Node
 * pelado. Ordem esparsa é aritmética que erra em silêncio — folha que "volta"
 * para o lugar, duas folhas com a mesma ordem — e um defeito desses só apareceria
 * no PDF montado.
 *
 * PURO: nenhum import de VALOR. Só `import type`, que é apagado em runtime — um
 * import de valor com `.ts` faz o `tsc` do projeto falhar (TS5097), e sem o `.ts`
 * o Node não resolve. Por isso a grade e a chave de ordenação chegam INJETADAS,
 * do mesmo jeito que `folhas.ts` recebe `repartir`.
 */

import type { Ajuste, Folha, FolhaId } from "./folhas.ts";

/** As medidas da grade (`layout-canvas`), injetadas. */
export interface GradeDoDrop {
  colunas: number;
  passoX: number;
  passoY: number;
}

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
 * As folhas de UM tomo, na ordem da projeção. É esta lista que vai para a
 * montagem — antes o servidor refazia a divisão por quantidade, e o PDF saía com
 * uma organização diferente da que o canvas mostrava.
 *
 * `divisao` é a saída de `gruposDasFolhas`, injetada pelo mesmo motivo de sempre:
 * este módulo roda em Node pelado.
 */
export function folhasDoTomo(
  projecao: readonly Folha[],
  divisao: readonly (readonly FolhaId[])[],
  tomo: number,
): Folha[] {
  const ids = new Set(divisao[tomo - 1] ?? []);
  return projecao.filter((f) => ids.has(f.id));
}

/**
 * Assinatura das folhas de um tomo: quem são, em que ordem, com que título.
 *
 * Gravada no `payload` do documento no momento da geração e recalculada a partir
 * da projeção na hora de comparar — é isso que faz o nó saber que envelheceu.
 * O TÍTULO entra porque a LD imprime o título de cada folha: corrigir um deixa o
 * PDF velho tanto quanto mover uma folha de tomo.
 *
 * O separador é o caractere de unidade (U+001F), que não existe em nome de
 * arquivo nem em título de prancha. Juntar por um caractere comum deixaria a
 * assinatura de duas folhas colidir com a de uma só, e a marca deixaria de
 * acender exatamente quando devia.
 */
export function assinaturaDoTomo(doTomo: readonly Folha[]): string {
  const SEP = "\u001f";
  return doTomo.map((f) => `${f.id}${SEP}${f.conteudo ?? ""}`).join(SEP);
}

/**
 * Alguma folha deste tomo foi reordenada à mão?
 *
 * Quando não, a montagem deve continuar ordenando pelo número do carimbo — é o
 * comportamento validado à mão, e mudá-lo mexeria no resultado de projetos que já
 * estavam certos. Quando sim, a ordem desenhada manda naquele tomo.
 */
export function precisaRespeitarOrdem(doTomo: readonly Folha[]): boolean {
  return doTomo.some((f) => f.ordem !== undefined);
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
  grade: GradeDoDrop,
): { tomo: number; indice: number } | null {
  const fileira = fileiras.find(
    (f) => ponto.y >= f.topo && ponto.y < f.topo + f.altura,
  );
  if (!fileira) return null;

  const coluna = limitar(
    Math.round((ponto.x - fileira.gradeX) / grade.passoX),
    0,
    grade.colunas,
  );
  const linha = Math.max(0, Math.floor((ponto.y - fileira.gradeY) / grade.passoY));
  const indice = limitar(linha * grade.colunas + coluna, 0, fileira.folhas.length);
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
 * CONGELA o palpite: toda folha sem `grupo` ganha o tomo em que já está. Sem isso,
 * arrastar uma folha faz outra pular de tomo sozinha — a divisão automática
 * reequilibra e puxa uma folha para a vaga que abriu.
 *
 * `divisaoAtual` nula (uma fileira só) NÃO escreve `grupo` nenhum: sem divisão,
 * gravar o tomo seria inventar uma decisão que o usuário não tomou.
 */
export function ajusteDoDrop(
  movidas: readonly Folha[],
  alvo: { tomo: number; indice: number },
  fileiraAlvo: readonly Folha[],
  divisaoAtual: readonly { tomo: number; folhas: readonly Folha[] }[] | null,
  chaveDeOrdem: (f: Folha) => number,
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

  const patches = new Map<FolhaId, Ajuste>();

  // Congela o palpite: quem não tem grupo ganha o tomo em que já está. Sem ordem
  // — não se moveu, e inventar ordem para todo mundo fixaria o que não foi
  // decidido.
  if (divisaoAtual) {
    for (const fileira of divisaoAtual) {
      for (const f of fileira.folhas) {
        if (f.grupo === undefined) patches.set(f.id, { grupo: fileira.tomo });
      }
    }
  }

  // As arrastadas vêm por último: elas mandam sobre o congelamento.
  naOrdem.forEach((f, i) => {
    patches.set(f.id, {
      ...(divisaoAtual ? { grupo: alvo.tomo } : {}),
      ordem: ordens[i],
    });
  });

  return [...patches].map(([id, patch]) => ({ id, patch }));
}
