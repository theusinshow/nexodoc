/**
 * A ESCALA SEQUENCIAL DE DADO (DESIGN.md §2) — quantas fatias, quais degraus.
 *
 * A rampa `--data-*` existia em `globals.css` sem ninguém a consumir, enquanto o
 * donut de consumo pintava as fatias com `var(--ring)` e duas transparências do
 * teal. O comentário de lá dizia "escala do teal do sistema — distinção, não
 * semântica", e é justamente essa distinção que o sistema não permite: teal
 * significa interativo, e fatia de gráfico não se clica. Um leitor que aprende
 * a regra na primeira tela desaprende na segunda.
 *
 * A ESCOLHA DOS DEGRAUS ESPALHA em vez de sequenciar. Com duas fatias, pegar
 * `--data-5` e `--data-4` daria dois azuis quase iguais num anel de 2,5px de
 * traço — e o anel tem 14px de diâmetro. Pegar os extremos é o que faz duas
 * fatias se distinguirem de longe, e é o mesmo raciocínio que faz três pegarem
 * extremos + meio.
 *
 * DO CLARO PARA O ESCURO: no fundo escuro do produto, o degrau mais claro é o
 * que mais avança, e a primeira fatia é sempre a maior (o chamador ordena).
 *
 * PURO e sem imports: roda no node cru.
 */

/** A rampa inteira, na ordem de leitura: primeiro o que mais aparece. */
export const ESCALA_DE_DADO = [
  "var(--data-5)",
  "var(--data-4)",
  "var(--data-3)",
  "var(--data-2)",
  "var(--data-1)",
] as const;

/**
 * O que sobra quando há mais fatias do que degraus. Borda estrutural, de
 * propósito: repetir um degrau MENTIRIA (dois valores diferentes com a mesma
 * cor), e inventar um sexto azul é ampliar a paleta sem trabalho declarado —
 * exatamente o que o §2 proíbe.
 */
export const FORA_DA_ESCALA = "var(--border)";

/**
 * As cores de `quantas` fatias, da maior para a menor. Acima de cinco, o
 * excedente sai da escala em vez de dar a volta.
 */
export function fatiasDaEscala(quantas: number): string[] {
  if (quantas <= 0) return [];
  if (quantas === 1) return [ESCALA_DE_DADO[0]];

  if (quantas > ESCALA_DE_DADO.length) {
    const excedente = quantas - ESCALA_DE_DADO.length;
    return [
      ...ESCALA_DE_DADO,
      ...Array.from({ length: excedente }, () => FORA_DA_ESCALA),
    ];
  }

  const passo = (ESCALA_DE_DADO.length - 1) / (quantas - 1);
  return Array.from(
    { length: quantas },
    (_, i) => ESCALA_DE_DADO[Math.round(i * passo)],
  );
}
