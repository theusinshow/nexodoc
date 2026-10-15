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

/** O título sem o número, normalizado: "8 - PROJETO ELÉTRICO" → "PROJETO ELETRICO". */
function tituloSemNumero(capitulo: string): string {
  return capitulo
    .replace(/^\s*\d{1,2}\s*[-–—.]?\s*/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Outro capítulo de verdade, e não o mesmo título com sobra: "8 - PROJETO DE
 * PAISAGISMO PATA DE VACA" é o paisagismo com a primeira linha da página
 * colada; "8 - PROJETO ELÉTRICO" não é.
 */
function outroTitulo(novo: string, emVigor: string): boolean {
  const a = tituloSemNumero(novo);
  const b = tituloSemNumero(emVigor);
  if (!a || !b) return false;
  return !a.startsWith(b) && !b.startsWith(a);
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
      } else if (outroTitulo(cabecalho, capituloEmVigor)) {
        /*
         * MESMO NÚMERO, OUTRO TÍTULO (05/10/2026, 141-26). A separatriz do
         * capítulo de elétrica dizia "8 PROJETO ELÉTRICO" e o cabeçalho das
         * páginas de paisagismo, logo antes, "8 – PROJETO DE PAISAGISMO": a
         * numeração das separatrizes estava um atrás. Pela regra do número a
         * separatriz herdava paisagismo, e todo achado dela ia para a
         * disciplina errada. Título diferente é capítulo novo, como número diferente:
         * vale o que ELE diz — inclusive nada ("13 EQUIPE TÉCNICA").
         */
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

/**
 * As disciplinas das OUTRAS páginas do achado — fora a `principal`, sem
 * repetir, na ordem das páginas. Um achado que cita a p. 70 (capítulo de
 * arquitetura) e a p. 123 (capítulo de hidrossanitário) é dos dois capítulos;
 * a principal sozinha o escondia de quem revisa o segundo.
 */
export function disciplinasEnvolvidas(
  paginas: readonly number[],
  principal: FindingDiscipline | undefined,
  mapa: ReadonlyMap<number, FindingDiscipline> | undefined,
): FindingDiscipline[] {
  if (!mapa) return [];
  const vistas = new Set<FindingDiscipline>(principal ? [principal] : []);
  const saida: FindingDiscipline[] = [];
  for (const p of paginas) {
    const d = mapa.get(p);
    if (d && d !== "geral" && !vistas.has(d)) {
      vistas.add(d);
      saida.push(d);
    }
  }
  return saida;
}

/**
 * A disciplina que VALE para o achado nesta corrida.
 *
 * A PÁGINA MANDA, e a gravada só entra quando a página não sabe responder — a
 * ordem inversa da que estava no `app/api/audit/route.ts`, e a inversão é o
 * ponto.
 *
 * ACHADO HERDADO carrega o parecer anterior inteiro (`{...f, herdado_de}`),
 * `disciplina` incluída. Com `gravada ?? derivada`, o valor velho vencia sempre
 * — e uma correção na leitura de cabeçalho jamais alcançava um herdado. Foi
 * exatamente o caso de 21/08/2026: metade do memorial do 113-22 saía como
 * terraplenagem por um cabeçalho composto ("3 - PROJETO ARQUITETÔNICO E
 * URBANIZAÇÃO"), e o conserto teria ficado invisível justamente nos achados que
 * mais se repetem — 86 a 95% do texto é reaproveitado entre revisões.
 *
 * É SEGURO REDERIVAR porque a página do herdado JÁ foi reancorada para o
 * documento novo antes de chegar aqui, e o mapa vem desse mesmo documento. Onde
 * a página não tem cabeçalho reconhecível o mapa devolve `undefined`, e aí a
 * gravada volta a valer: rederivar nunca APAGA o que se sabia.
 *
 * Nada disso muda achado novo: ele chega sem `disciplina` (o modelo não emite
 * esse campo; quem o escreve é esta regra), e os dois caminhos coincidem.
 */
export function disciplinaQueVale(
  gravada: FindingDiscipline | undefined,
  pagina: string | undefined,
  mapa: ReadonlyMap<number, FindingDiscipline> | undefined,
): FindingDiscipline | undefined {
  const daPagina = mapa ? disciplinaDoAchado(pagina, mapa) : undefined;
  return daPagina ?? gravada;
}
