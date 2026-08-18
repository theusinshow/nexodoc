/**
 * A GRADE DAS TABELAS, reconstruída das coordenadas.
 *
 * Puro de propósito: recebe os itens já extraídos, não importa o pdf.js. É o que
 * permite testá-lo em node cru (`scripts/test-tabela-do-pdf.ts`), com fixtures
 * de coordenadas escritas à mão.
 *
 * Existe porque a camada determinística da auditoria é toda ancorada em PROSA e
 * os achados numéricos moram em TABELA — `runDeclaredTotalAreaRule` exige a
 * frase "área total construída" logo antes do número, e numa célula não há
 * frase nenhuma antes do número.
 *
 * Pré-requisito que só passou a existir em 17/08/2026: até então a extração
 * achatava a página numa linha só, e sem quebra de linha não há linha de tabela.
 */
import { corpoDaFonte, mudouDeLinha, type ItemDeTexto } from "./texto-do-pdf.ts";

/** Uma linha visual da página: os itens que dividem o mesmo `y`. */
export type LinhaDaPagina = { itens: ItemDeTexto[] };

/**
 * Agrupa os itens da página em linhas, pela MESMA medida que a extração usa para
 * decidir quebra de linha. Se divergissem, a tabela veria linhas que o texto não
 * vê, e a evidência de um achado apontaria para uma linha que não existe.
 */
export function linhasDaPagina(items: ItemDeTexto[]): LinhaDaPagina[] {
  const linhas: LinhaDaPagina[] = [];
  let atual: ItemDeTexto[] = [];
  let anterior: ItemDeTexto | null = null;

  const fechar = () => {
    if (atual.length > 0) linhas.push({ itens: atual });
    atual = [];
    anterior = null;
  };

  for (const item of items) {
    /*
     * O pdf.js marca fim de linha num item VAZIO. Ele não escreve nada, então
     * não entra na linha; mas descartá-lo sem olhar jogaria fora a única marca
     * de quebra que alguns PDFs emitem.
     */
    if (!item.str) {
      if (item.hasEOL) fechar();
      continue;
    }

    if (anterior && mudouDeLinha(anterior, item)) fechar();

    atual.push(item);
    anterior = item;
  }

  fechar();
  return linhas;
}

/** O `x` onde o item começa. */
export function inicioDoItem(item: ItemDeTexto): number {
  return item.transform?.[4] ?? 0;
}

/** O `x` onde o item termina. */
export function fimDoItem(item: ItemDeTexto): number {
  return inicioDoItem(item) + (item.width ?? 0);
}

/** O corpo de fonte representativo de uma linha — o do primeiro item que tiver um. */
export function corpoDaLinha(linha: LinhaDaPagina): number {
  for (const item of linha.itens) {
    const corpo = corpoDaFonte(item);
    if (corpo > 0) return corpo;
  }
  return 0;
}
