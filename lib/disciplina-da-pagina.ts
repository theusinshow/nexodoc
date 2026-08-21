/**
 * De que disciplina é a PÁGINA — e, por tabela, o achado que mora nela.
 *
 * POR QUE ISTO É REGRA E NÃO IA
 *
 * A disciplina de um trecho de memorial é fato objetivo: está escrita no
 * cabeçalho do capítulo em que o trecho está. Perguntar a um modelo o que a
 * própria página declara é pagar token para adivinhar um dado que já está lá —
 * e adivinhação erra.
 *
 * A classificação anterior varria a prosa do achado inteira, `evidencia`
 * incluída. Mas a evidência são as PALAVRAS DO MEMORIAL, não a natureza do
 * defeito: um achado do capítulo de instalações elétricas cuja frase citada
 * mencionasse "bancada em granito" era arquivado como arquitetura, e sumia do
 * filtro de elétrica de quem estava revisando a elétrica.
 *
 * NADA DE PARSER NOVO. `getPageChapter` já responde "de que capítulo é esta
 * página" — é ela que corta o documento em blocos para a leitura por capítulo —
 * e `disciplinaDoTitulo` já tem o vocabulário de disciplina que a tela usa —
 * o mesmo de `disciplinaDoTexto`, desempatado pela ordem das palavras, que é o
 * que um TÍTULO pede (ver o comentário lá). Este
 * módulo é só a amarração das duas, mais a regra de continuidade abaixo.
 *
 * Puro: recebe as páginas já extraídas, sem pdf.js e sem IO.
 */

import { getPageChapter, type ExtractedPdfPage } from "./pdf-text.ts";
import { disciplinaDoTitulo, type FindingDiscipline } from "./audit-report.ts";
import { primeiraPagina } from "./pins-do-parecer.ts";

/** O número do capítulo ("12 - INSTALAÇÕES ELÉTRICAS" → "12"), ou "". */
function numeroDoCapitulo(capitulo: string): string {
  return capitulo.match(/^\s*(\d{1,2})\b/)?.[1] ?? "";
}

/**
 * A disciplina de cada página, quando dá para saber. Página fora do mapa é
 * página sem cabeçalho reconhecível — e aí quem responde é a inferência antiga.
 *
 * A REGRA DE CONTINUIDADE, que é o miolo disto: um capítulo ocupa várias
 * páginas, e só a primeira costuma trazer o título inteiro. As seguintes trazem
 * subtítulo ("12.3 Quadros de distribuição") ou nada. Então:
 *
 *  - página sem cabeçalho HERDA a disciplina em vigor;
 *  - subtítulo do MESMO capítulo (mesmo número) não derruba o que já se sabe —
 *    ele acrescenta, se o título anterior não tiver dito a disciplina;
 *  - capítulo NOVO (número diferente) zera: "13 - CONSIDERAÇÕES FINAIS" não é
 *    elétrica só por vir depois do capítulo de elétrica.
 *
 * Sem a última regra, a primeira disciplina encontrada contaminaria o resto do
 * documento — que é pior do que não saber, porque parece que se sabe.
 */
export function disciplinaPorPagina(
  pages: readonly ExtractedPdfPage[],
): Map<number, FindingDiscipline> {
  const mapa = new Map<number, FindingDiscipline>();
  let capituloEmVigor = "";
  let disciplinaEmVigor: FindingDiscipline | null = null;

  for (const page of pages) {
    const cabecalho = getPageChapter(page.text);

    if (cabecalho) {
      const numeroNovo = numeroDoCapitulo(cabecalho);
      const numeroEmVigor = numeroDoCapitulo(capituloEmVigor);

      if (numeroNovo !== numeroEmVigor) {
        disciplinaEmVigor = disciplinaDoTitulo(cabecalho);
      } else {
        disciplinaEmVigor = disciplinaEmVigor ?? disciplinaDoTitulo(cabecalho);
      }

      capituloEmVigor = cabecalho;
    }

    if (disciplinaEmVigor) {
      mapa.set(page.page, disciplinaEmVigor);
    }
  }

  return mapa;
}

/**
 * A disciplina do achado, pela página que ele cita. `undefined` quando o achado
 * não diz página ou quando a página dele não tem cabeçalho — nos dois casos não
 * há fato a declarar, e mentir "geral" apagaria o fallback.
 *
 * Intervalo ("12-14") vale pela primeira página, pela mesma razão que o pin do
 * parecer usa: é onde o trecho começa.
 */
export function disciplinaDoAchado(
  pagina: string | undefined,
  mapa: ReadonlyMap<number, FindingDiscipline>,
): FindingDiscipline | undefined {
  const numero = primeiraPagina(pagina);
  if (numero === null) return undefined;
  return mapa.get(numero);
}
