"use client";

import { O_DINHEIRO_12, O_DINHEIRO_17 } from "./folhas/o-dinheiro";
import { O_PEDIDO } from "./folhas/o-pedido";
import { O_PROBLEMA } from "./folhas/o-problema";
import { O_QUE_E } from "./folhas/o-que-e";
import { O_QUE_EXISTE } from "./folhas/o-que-existe";
import { POSSIVEIS_PERGUNTAS } from "./folhas/possiveis-perguntas";
import type { Slide } from "./palco";

/**
 * O CONTEÚDO DO DECK — a ordem das folhas, e só ela. Cada bloco mora em
 * `folhas/`, com o texto e as notas de 09/09/2026 sem alteração; a composição
 * é a do spec `2026-09-10-deck-instrumento-design.md`.
 *
 * TRÊS REGRAS QUE ESTE DECK NÃO PODE PERDER:
 *
 *  1. **Todo número aqui foi medido, e o que é conta aparece como estimativa.**
 *     Os custos saíram de `AiUsageEvent`; os achados, de execuções reais. Onde
 *     há premissa, a palavra fica na tela, em âmbar.
 *  2. **Nenhuma cifra de preço nas folhas 01 a 19.** Valor do piloto e
 *     propriedade do software vivem em `/apresentacao/valores`, e a folha 17
 *     só traz o BOTÃO que abre aquela rota — nunca uma seta a mais.
 *  3. **Nada se mexe sem dizer algo.** Ver a seção de movimento em `palco.css`.
 *
 * SEM DATA DE EXECUÇÃO EM LUGAR NENHUM. O deck fala do que o sistema faz, não
 * de quando uma corrida específica rodou.
 */
export const SLIDES: readonly Slide[] = [
  ...O_QUE_E,
  ...O_PROBLEMA,
  ...O_QUE_EXISTE,
  O_DINHEIRO_12,
  ...POSSIVEIS_PERGUNTAS,
  O_DINHEIRO_17,
  ...O_PEDIDO,
];
