"use client";

import { CAPA } from "./folhas/abertura";
import { DECISAO } from "./folhas/decisao";
import { MATURIDADE } from "./folhas/maturidade";
import { O_PRODUTO } from "./folhas/o-produto";
import { OBJECOES } from "./folhas/objecoes";
import { O_PROBLEMA } from "./folhas/problema";
import type { Slide } from "./palco";

/**
 * O CONTEÚDO DO DECK — a ordem das folhas, e só ela. Cada capítulo mora em
 * `folhas/`. Desde 02/10/2026 (segunda versão), cinco capítulos — o produto, o
 * problema, a maturidade, as objeções e o piloto —, e cada folha é MANCHETE
 * (a conclusão, dita primeiro) mais UMA peça que a prova.
 *
 * REVISÃO DE 13/10/2026: 20 folhas viraram 18. A maturidade virou uma escala
 * só (eram três folhas dizendo "duas capacidades, duas provas"), o checklist
 * do piloto saiu (a última folha já pede as mesmas três decisões), a segurança
 * passou a dizer a verdade sobre o cofre cifrado, e entrou o 129-24 contra
 * outra IA como prova antes da objeção do ChatGPT.
 *
 * TRÊS REGRAS QUE ESTE DECK NÃO PODE PERDER:
 *
 *  1. **Todo número aqui foi medido, e o que é conta aparece como estimativa.**
 *     Os custos saíram de `AiUsageEvent`; os achados, de execuções reais. Onde
 *     há premissa, a palavra fica na tela, em âmbar. Onde o deck desenha a
 *     página em volta de um trecho, são linhas cinzas — nunca texto inventado.
 *  2. **Nenhuma cifra de preço nas folhas 01 a 18.** Valor do piloto e
 *     propriedade do software vivem em `/apresentacao/valores`, e a folha 17
 *     só traz o BOTÃO que abre aquela rota — nunca uma seta a mais.
 *  3. **Nada se mexe sem dizer algo.** Ver a seção de movimento em `palco.css`.
 *
 * SEM DATA DE EXECUÇÃO NA TELA. O deck fala do que o sistema faz, não de quando
 * uma corrida específica rodou.
 */
export const SLIDES: readonly Slide[] = [
  CAPA,
  ...O_PRODUTO,
  ...O_PROBLEMA,
  ...MATURIDADE,
  ...OBJECOES,
  ...DECISAO,
];
