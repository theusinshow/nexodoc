import { textoDosItens, type ItemDeTexto } from "./texto-do-pdf.ts";
import { tabelasDaPagina, type Tabela } from "./tabela-do-pdf.ts";

export type ExtractedPdfPage = {
  page: number;
  text: string;
  /**
   * As tabelas da pagina, reconstruidas das coordenadas.
   *
   * OPCIONAL de proposito: sete modulos consomem este tipo e nenhum precisa
   * mudar. Quem nao sabe de tabela segue lendo `text` como sempre leu.
   */
  tabelas?: Tabela[];
};

export type ExtractedPdf = {
  pages: ExtractedPdfPage[];
  /**
   * O documento COMO ESTÁ ESCRITO na folha. É o que a camada determinística
   * regex-eia e de onde sai a evidência de todo achado de regra.
   */
  text: string;
  /**
   * O documento COMO O MODELO O LÊ: o mesmo texto, com a grade das tabelas
   * anexada a cada página. Ver `textoDaPaginaParaIA`.
   *
   * OPCIONAL porque dezenas de fixtures montam `ExtractedPdf` à mão; quem não
   * tiver o campo cai em `text`, que é o comportamento de antes.
   */
  textoParaIA?: string;
  pageCount: number;
  charCount: number;
};

/**
 * O texto que a IA leu — `textoParaIA` quando existe, `text` quando não.
 *
 * Existe como função e não como `??` espalhado porque são TRÊS os lugares que
 * precisam concordar sobre isto (o contexto do prompt, a trava anti-alucinação
 * e a validação), e discordarem significa descartar em silêncio um achado que o
 * modelo leu de um insumo que nós mesmos demos a ele.
 */
export function textoDoDocumentoParaIA(extracted: ExtractedPdf): string {
  return extracted.textoParaIA ?? extracted.text;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const pages: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    /*
     * JUNTAR ITEM COM ITEM USANDO UM ESPAÇO ERA O DEFEITO. O pdf.js corta um
     * item novo quando o estado do texto muda — trocar de fonte no meio de uma
     * palavra, o que memorial faz o tempo todo, devolve `["r", "espingos"]`
     * encostados. O espaço saía daqui, não do arquivo, e o memorial chegava ao
     * auditor escrito "r espingos".
     *
     * Quem decide agora é a medida do vão, em `lib/texto-do-pdf.ts` — a mesma
     * função que o localizador do pin usa, para a evidência e o pin não lerem a
     * página de dois jeitos.
     */
    const itens = content.items.filter(
      (item): item is typeof item & ItemDeTexto =>
        "str" in item && typeof item.str === "string",
    );
    /*
     * A QUEBRA DE LINHA SOBREVIVE — e é o que faz tabela ser legível.
     *
     * Este `.replace(/\s+/g, " ")` achatava a página inteira numa linha só.
     * Numa tabela — quadro de áreas, acabamentos, esquadrias, carga de incêndio
     * — isso apaga a estrutura: linhas e colunas viram uma sequência contínua de
     * palavras, e nenhum modelo consegue dizer que valor pertence a que linha.
     * Foi o que motivou "ele não está lendo tabelas" (17/08/2026).
     *
     * E colava números: no sumário do 156-25 o "11" da página grudava no "1.1"
     * do item seguinte e chegava ao auditor como "111.1" — um número que não
     * existe no documento, oferecido a uma auditoria que confere números.
     *
     * O colapso continua na HORIZONTAL (`[^\S\n]` = branco que não é quebra):
     * vão duplo entre palavras é ruído de renderização, não estrutura. E três
     * quebras seguidas viram duas, porque parágrafo separado é informação e
     * dez linhas em branco são só o desenho da página.
     */
    const text = textoDosItens(itens, { quebrarLinhas: true })
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    /*
     * A GRADE, dos mesmos itens de que o texto saiu.
     *
     * O `transform[4]`/`[5]` de cada item ja chegava aqui e ia para o lixo. A
     * camada deterministica inteira e ancorada em prosa, e os achados
     * numericos moram em tabela.
     */
    const tabelas = tabelasDaPagina(itens, pageNumber);

    pages.push({
      page: pageNumber,
      text,
      ...(tabelas.length > 0 ? { tabelas } : {}),
    });
  }

  await document.destroy();

  const text = pages.map((page) => `--- PAGINA ${page.page} ---\n${page.text}`).join("\n\n");
  /*
   * A MESMA MONTAGEM, com a grade. Feita aqui e não em quem lê porque a
   * trava anti-alucinação e o contexto do prompt precisam da MESMA string:
   * se o modelo lê a grade e a trava procura a evidência no texto achatado,
   * todo achado tirado de tabela é descartado sem deixar rastro.
   */
  const textoParaIA = pages
    .map((page) => `--- PAGINA ${page.page} ---\n${textoDaPaginaParaIA(page)}`)
    .join("\n\n");
  const charCount = pages.reduce((total, page) => total + page.text.length, 0);

  return {
    pages,
    text,
    textoParaIA,
    pageCount: document.numPages,
    charCount,
  };
}

/**
 * O MARCADOR DA GRADE no texto que a IA lê.
 *
 * Curto de propósito: um memorial real tem ~120 tabelas, e cada caractere de
 * moldura é pago 120 vezes em toda passada de leitura.
 */
const ABRE_TABELA = "[TABELA]";
const FECHA_TABELA = "[/TABELA]";

/**
 * O TEXTO DA PÁGINA COMO O MODELO PRECISA LÊ-LA: a prosa, e depois a grade.
 *
 * O defeito que isto conserta (24/08/2026): `page.tabelas` era reconstruída
 * corretamente das coordenadas e tinha UM ÚNICO consumidor no repositório
 * inteiro — `runDeclaredTotalAreaRule`, na camada determinística. Tudo que a IA
 * lê sai de `page.text`, que é a página achatada. A tabela chegava ao modelo
 * como uma fila de palavras sem dono:
 *
 *     AMBIENTE AREA (m2) PISO
 *     Circulacao Ceramica          <- a célula de área está VAZIA, e some
 *
 * — e "Circulacao" passa a ter área "Ceramica". Daí o achado "não existe
 * tabela" num documento que TEM a tabela: o modelo não estava errado sobre o
 * que recebeu, e nenhuma instrução de prompt conserta um insumo que não chegou.
 *
 * A GRADE VEM DEPOIS DA PROSA, e não no lugar dela. Duas razões, e a segunda é
 * a que decide:
 *
 *  1. A reconstrução é best-effort. Uma linha cuja célula quebra em duas linhas
 *     visuais vira duas linhas de grade. Perder a prosa custaria o texto
 *     correto em troca de uma estrutura aproximada.
 *  2. `page.text` é o que a camada determinística regex-eia, e é de onde sai a
 *     EVIDÊNCIA de todo achado de regra. Mexer nele mudaria o recorte de
 *     `snippet()` e faria a evidência apontar para um texto que não está
 *     escrito na folha. A grade é uma VISTA para o modelo, não a folha.
 *
 * O preço é a repetição do conteúdo da tabela dentro da mesma página. Ele é
 * pago no prompt do auditor, que diz o que o bloco é — sem isso o modelo abre
 * achado de "conteúdo duplicado" contra a nossa própria moldura.
 */
export function textoDaPaginaParaIA(page: ExtractedPdfPage): string {
  const tabelas = page.tabelas ?? [];
  if (tabelas.length === 0) return page.text;

  const grades = tabelas.map((tabela) => {
    const linhas = tabela.linhas
      // Célula vazia vira `-`: sem ela as colunas se deslocam e "Circulação"
      // passa a ter área "Cerâmica" — o defeito original, agora dentro da grade.
      .map((celulas) => celulas.map((c) => c.trim() || "-").join(" | "))
      .join("\n");
    return `${ABRE_TABELA}\n${linhas}\n${FECHA_TABELA}`;
  });

  return `${page.text}\n${grades.join("\n")}`;
}

export type AuditTextChunk = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  text: string;
};

/**
 * O CABEÇALHO em vigor nesta página — o título de capítulo que ela traz, ou "".
 *
 * Exportado porque tem dois consumidores e uma verdade só: o corte em blocos
 * logo abaixo, e a disciplina do achado (`lib/disciplina-da-pagina.ts`). Ter
 * duas noções de "de que capítulo é esta página" no mesmo repositório seria
 * garantir que um dia elas discordassem sobre a mesma folha.
 */
export function getPageChapter(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const match =
    normalized.match(/(?:^|\s)(\d{1,2})\s+[–-]?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s/]{5,80})/) ??
    normalized.match(/Cap\.\s*(\d{1,2})\s*[–-]\s*([^|]{5,80})/i);

  if (!match) {
    return "";
  }

  return `${match[1]} - ${match[2].trim()}`.replace(/\s+/g, " ");
}

export function chunkPdfByChapter(extracted: ExtractedPdf, maxChunkChars = 28000) {
  const chunks: AuditTextChunk[] = [];
  let currentTitle = "Inicio do documento";
  let currentStartPage = extracted.pages[0]?.page ?? 1;
  let currentText = "";

  function pushCurrent(endPage: number) {
    const text = currentText.trim();

    if (!text) {
      return;
    }

    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      title: currentTitle,
      startPage: currentStartPage,
      endPage,
      text,
    });
  }

  for (const page of extracted.pages) {
    const chapter = getPageChapter(page.text);
    // O CAPÍTULO sai do texto cru (a grade não tem cabeçalho de capítulo); o
    // BLOCO leva a grade junto, porque é ele que o modelo lê.
    const pageText = `--- PAGINA ${page.page} ---\n${textoDaPaginaParaIA(page)}\n`;
    const shouldSplitByChapter =
      chapter && chapter !== currentTitle && currentText.length > 0;
    const shouldSplitBySize = currentText.length + pageText.length > maxChunkChars;

    if (shouldSplitByChapter || shouldSplitBySize) {
      pushCurrent(page.page - 1);
      currentText = "";
      currentStartPage = page.page;
      currentTitle = chapter || currentTitle;
    } else if (chapter) {
      currentTitle = chapter;
    }

    currentText += pageText;
  }

  pushCurrent(extracted.pages.at(-1)?.page ?? currentStartPage);

  return chunks;
}

/**
 * JUNTA CAPÍTULOS VIZINHOS ATÉ ENCHER UM BLOCO — só para a passada de leitura.
 *
 * `chunkPdfByChapter` corta em TODO cabeçalho, sem piso de tamanho: um memorial
 * de 361 mil caracteres vira 72 blocos de ~5k. Como cada bloco carrega o prompt
 * do auditor e tem teto de saída próprio, o custo de ler o documento passa a ser
 * função do NÚMERO de blocos, não do tamanho do texto — medido em 17/08/2026:
 * US$ 14,77 com um bloco por capítulo contra US$ 4,46 com os mesmos capítulos
 * agrupados, para a MESMA cobertura. Ver `scripts/mede-cobertura-total.ts`.
 *
 * NÃO É PARA SER USADA NO LUGAR DE `chunkPdfByChapter`, e esta é a parte que
 * importa: a IMPRESSÃO DIGITAL da auditoria incremental
 * (`impressaoDosCapitulos`) hasheia o corte por capítulo, e é o casamento desses
 * hashes entre revisões que sustenta os 86-95% de texto reaproveitado. Agrupar
 * antes de imprimir trocaria 72 hashes estáveis por 17 hashes que mudam de
 * conteúdo assim que qualquer capítulo do grupo muda — e o delta desabaria de
 * "3 capítulos alterados" para "o documento inteiro mudou". O corte continua
 * sendo o dos capítulos; o agrupamento é uma vista SOBRE ele, para ler.
 *
 * O bloco resultante é contíguo e sempre começa em fronteira de capítulo. O
 * título vira "primeiro … último" quando junta mais de um, porque é ele que o
 * modelo recebe como contexto do trecho — e "1 - PAREDES" num bloco que vai até
 * o capítulo 6 seria uma etiqueta errada, não uma etiqueta curta.
 *
 * Um capítulo maior que o teto sozinho vira bloco sozinho: cortá-lo aqui é
 * exatamente o que `chunkPdfByChapter` já fez por tamanho.
 */
export function agruparBlocosParaLeitura(
  chunks: readonly AuditTextChunk[],
  tetoChars = 28000,
): AuditTextChunk[] {
  const blocos: AuditTextChunk[] = [];

  for (const chunk of chunks) {
    const ultimo = blocos.at(-1);
    const cabe = ultimo && ultimo.text.length + chunk.text.length + 1 <= tetoChars;

    if (!ultimo || !cabe) {
      blocos.push({ ...chunk, id: `bloco-${blocos.length + 1}` });
      continue;
    }

    ultimo.text = `${ultimo.text}\n${chunk.text}`;
    ultimo.endPage = chunk.endPage;
    // O título do grupo nomeia o INTERVALO. `split(" … ")[0]` porque o primeiro
    // já pode ser um intervalo de uma junção anterior.
    const primeiro = ultimo.title.split(" … ")[0];
    ultimo.title =
      primeiro && chunk.title && primeiro !== chunk.title
        ? `${primeiro} … ${chunk.title}`
        : primeiro || chunk.title;
  }

  return blocos;
}
