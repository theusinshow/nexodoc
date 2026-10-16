/**
 * O CORTE DOS TOMOS (16/10/2026): a divisão em tomos vista como UMA sequência
 * de folhas com marcas de corte. É o que a régua desenha e arrasta.
 * Desenho: docs/superpowers/specs/2026-10-16-corte-dos-tomos-design.md
 *
 * `cortes[i]` é a posição na sequência onde um tomo NOVO começa: sempre
 * crescente, sempre em 1..total-1 — por construção, nenhum tomo fica vazio.
 *
 * PURO: nenhum import.
 */
export interface Cortes {
  sequencia: string[];
  cortes: number[];
}

export function cortesDasFaixas(faixas: readonly (readonly string[])[]): Cortes {
  const cheias = faixas.filter((f) => f.length > 0);
  const sequencia = cheias.flat();
  const cortes: number[] = [];
  let acumulado = 0;
  cheias.forEach((f, i) => {
    if (i > 0) cortes.push(acumulado);
    acumulado += f.length;
  });
  return { sequencia, cortes };
}

export function faixasDosCortes(sequencia: readonly string[], cortes: readonly number[]): string[][] {
  const bordas = [0, ...cortes, sequencia.length];
  const faixas: string[][] = [];
  for (let i = 0; i < bordas.length - 1; i++) {
    const faixa = sequencia.slice(bordas[i], bordas[i + 1]);
    if (faixa.length > 0) faixas.push(faixa);
  }
  return faixas;
}

/**
 * Arrasta o corte `i` para `pos`. Não atravessa a vizinha: passar dela (ou
 * encostar nela, ou na borda) JUNTA os dois tomos — o corte some.
 */
export function moverCorte(cortes: readonly number[], i: number, pos: number, total: number): number[] {
  const anterior = i > 0 ? cortes[i - 1] : 0;
  const proximo = i < cortes.length - 1 ? cortes[i + 1] : total;
  const resto = cortes.filter((_, j) => j !== i);
  if (pos <= anterior || pos >= proximo) return resto;
  return [...resto, Math.round(pos)].sort((a, b) => a - b);
}

export function criarCorte(cortes: readonly number[], pos: number, total: number): number[] {
  const p = Math.round(pos);
  if (p <= 0 || p >= total || cortes.includes(p)) return [...cortes];
  return [...cortes, p].sort((a, b) => a - b);
}

export function removerCorte(cortes: readonly number[], i: number): number[] {
  return cortes.filter((_, j) => j !== i);
}

/** O tomo de CADA folha — gravar todas é o que congela a divisão. */
export function patchesDosCortes(
  sequencia: readonly string[],
  cortes: readonly number[],
): { id: string; patch: { grupo: number } }[] {
  return faixasDosCortes(sequencia, cortes).flatMap((faixa, i) =>
    faixa.map((id) => ({ id, patch: { grupo: i + 1 } })),
  );
}

/** Bytes por faixa; `null` quando alguma folha da faixa tem peso desconhecido. */
export function pesoDasFaixas(
  faixas: readonly (readonly string[])[],
  bytesDe: (id: string) => number | null,
): (number | null)[] {
  return faixas.map((faixa) => {
    let soma = 0;
    for (const id of faixa) {
      const b = bytesDe(id);
      if (b === null) return null;
      soma += b;
    }
    return soma;
  });
}
