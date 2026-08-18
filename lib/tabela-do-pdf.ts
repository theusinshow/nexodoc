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
import {
  corpoDaFonte,
  mudouDeLinha,
  textoDosItens,
  type ItemDeTexto,
} from "./texto-do-pdf.ts";

/**
 * O vão horizontal, em corpos de fonte, a partir do qual duas palavras estão em
 * COLUNAS diferentes e não apenas separadas por espaço.
 *
 * `texto-do-pdf.ts` trata espaço entre palavras em 0,15 do corpo. 1,5 é dez
 * vezes isso: fica muito acima do espaço largo da prosa justificada e bem abaixo
 * do recuo típico entre colunas de um quadro.
 *
 * PLAUSÍVEL, NÃO MEDIDO — não há PDF real nesta máquina para calibrar. Ver o
 * risco 2 da spec.
 */
const VAO_DE_COLUNA = 1.5;

/** Quanto duas fronteiras podem diferir em `x` e ainda serem a mesma coluna. */
const TOLERANCIA_DE_FRONTEIRA = 0.8;

/**
 * Quantas linhas consecutivas precisam concordar para virar tabela.
 *
 * Três, e não duas: duas linhas concordando numa fronteira acontece por acaso em
 * prosa justificada. Três, não.
 */
const MIN_LINHAS_DA_TABELA = 3;

/** Quantas linhas precisam sustentar uma fronteira para ela valer como coluna. */
const MIN_APOIO_DA_FRONTEIRA = 2;

/** Uma tabela reconstruída: linhas de células, sem semântica nenhuma. */
export type Tabela = { pagina: number; linhas: string[][] };

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

/**
 * Os `x` onde a linha tem um salto grande o bastante para ser troca de coluna.
 * A fronteira fica no MEIO do vão — assim ela não pertence a nenhum dos lados.
 */
function fronteirasDaLinha(linha: LinhaDaPagina): number[] {
  const fronteiras: number[] = [];

  for (let i = 1; i < linha.itens.length; i += 1) {
    const anterior = linha.itens[i - 1];
    const proximo = linha.itens[i];
    const corpo = corpoDaFonte(anterior) || corpoDaFonte(proximo);
    if (corpo <= 0) continue;

    const vao = inicioDoItem(proximo) - fimDoItem(anterior);
    if (vao >= corpo * VAO_DE_COLUNA) {
      fronteiras.push((fimDoItem(anterior) + inicioDoItem(proximo)) / 2);
    }
  }

  return fronteiras;
}

/**
 * As fronteiras que se REPETEM entre as linhas de um bloco.
 *
 * É aqui que a tabela se identifica sozinha, e é a propriedade que sustenta o
 * módulo inteiro: prosa justificada também tem vãos largos, mas em `x` diferente
 * a cada linha. Ela não sustenta fronteira nenhuma, e por isso não precisa de
 * exclusão explícita — não há lista de "isto é prosa" para alguém manter.
 */
function fronteirasDoBloco(linhas: LinhaDaPagina[], corpo: number): number[] {
  const candidatas: { x: number; apoio: Set<number> }[] = [];

  linhas.forEach((linha, indice) => {
    for (const x of fronteirasDaLinha(linha)) {
      const existente = candidatas.find(
        (c) => Math.abs(c.x - x) <= corpo * TOLERANCIA_DE_FRONTEIRA,
      );
      if (existente) {
        existente.apoio.add(indice);
        continue;
      }
      candidatas.push({ x, apoio: new Set([indice]) });
    }
  });

  return candidatas
    .filter((c) => c.apoio.size >= MIN_APOIO_DA_FRONTEIRA)
    .map((c) => c.x)
    .sort((a, b) => a - b);
}

/** Corta a linha nas fronteiras dadas. Célula sem item nenhum vira `""`. */
function celulasDaLinha(linha: LinhaDaPagina, fronteiras: number[]): string[] {
  const celulas: ItemDeTexto[][] = Array.from({ length: fronteiras.length + 1 }, () => []);

  for (const item of linha.itens) {
    const x = inicioDoItem(item);
    let coluna = 0;
    while (coluna < fronteiras.length && x >= fronteiras[coluna]) coluna += 1;
    celulas[coluna].push(item);
  }

  /*
   * Dentro da célula vale a costura NORMAL da extração — é ela que impede
   * "4.530,98" de virar duas palavras quando o gerador do PDF corta o item no
   * separador de milhar.
   */
  return celulas.map((itens) => textoDosItens(itens).trim());
}

/**
 * As tabelas de uma página. Nenhuma linha declara que é tabela: um bloco de
 * linhas consecutivas que concordam em pelo menos uma fronteira é uma.
 */
export function tabelasDaPagina(items: ItemDeTexto[], pagina: number): Tabela[] {
  const linhas = linhasDaPagina(items);
  const tabelas: Tabela[] = [];

  let bloco: LinhaDaPagina[] = [];

  const fechar = () => {
    if (bloco.length >= MIN_LINHAS_DA_TABELA) {
      const corpo = corpoDaLinha(bloco[0]);
      const fronteiras = corpo > 0 ? fronteirasDoBloco(bloco, corpo) : [];
      if (fronteiras.length > 0) {
        tabelas.push({
          pagina,
          linhas: bloco.map((linha) => celulasDaLinha(linha, fronteiras)),
        });
      }
    }
    bloco = [];
  };

  for (const linha of linhas) {
    /*
     * Linha sem vão nenhum não participa de tabela — e FECHA o bloco. É o que
     * separa dois quadros interrompidos por um parágrafo de texto corrido.
     */
    if (fronteirasDaLinha(linha).length === 0) {
      fechar();
      continue;
    }
    bloco.push(linha);
  }

  fechar();
  return tabelas;
}
