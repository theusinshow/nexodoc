import { textoDosItens, type ItemDeTexto } from "./texto-do-pdf.ts";
import { tabelasDaPagina, type Tabela } from "./tabela-do-pdf.ts";
import { LIMIAR_DE_CARACTERES, type TintaDaPagina } from "./pagina-muda.ts";

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
  /**
   * QUANTO A PÁGINA MANDA DESENHAR, fora o texto.
   *
   * É o sinal que distingue a folha em branco da folha cujo texto virou curva
   * vetorial ou tira de imagem — ver [[pagina-muda.ts]]. As duas chegavam aqui
   * como `text: ""` e eram indistinguíveis, e por isso a segunda passava por
   * lida.
   *
   * OPCIONAL pelo mesmo motivo de `tabelas`: dezenas de fixtures montam
   * `ExtractedPdfPage` à mão e nenhuma precisa mudar.
   */
  tinta?: TintaDaPagina;
  /**
   * DE ONDE VEIO ESTE TEXTO. Ausente = extraído do PDF, que é o caso normal.
   *
   * `"visao"` marca a página que o modelo releu da imagem. Ela não tem
   * coordenada de palavra: o achado que sair dela ancora na PÁGINA, e o grifo
   * do trecho não tenta desenhar retângulo nenhum. Sem o campo, o visor
   * procuraria por um trecho que a folha não sabe onde fica.
   */
  origem?: "visao";
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

/**
 * Conta os ops de DESENHO e de IMAGEM da folha.
 *
 * Os dois grupos existem separados porque são dois defeitos diferentes do mesmo
 * documento, e saber qual é ajuda a diagnosticar o PDF que chegou: no 114-19 a
 * página 7 tem 74 caminhos e nenhum texto (o parágrafo virou curva, saída
 * típica de "achatar" o PDF), e a página 9 tem 24 imagens de 944x92 px (cada
 * LINHA do parágrafo virou uma tira, saída típica de colar captura de tela).
 *
 * `?? -1` em cada op: a lista de `OPS` do pdf.js já mudou entre versões, e um
 * nome que suma daqui não pode derrubar a extração inteira — só faria a folha
 * contar menos tinta, e a página cai para o lado seguro (`muda`).
 */
async function medirTinta(
  pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs"),
  page: Awaited<ReturnType<Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>["getPage"]>>,
): Promise<TintaDaPagina | undefined> {
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  if (!OPS) return undefined;

  try {
    const ops = await page.getOperatorList();
    const desenhoOps = new Set([OPS.constructPath ?? -1]);
    const imagemOps = new Set([
      OPS.paintImageXObject ?? -1,
      OPS.paintJpegXObject ?? -1,
      OPS.paintImageMaskXObject ?? -1,
      OPS.paintInlineImageXObject ?? -1,
    ]);

    let desenho = 0;
    let imagem = 0;
    for (const op of ops.fnArray) {
      if (desenhoOps.has(op)) desenho += 1;
      else if (imagemOps.has(op)) imagem += 1;
    }

    return { desenho, imagem };
  } catch {
    /*
     * Folha que o pdf.js não consegue reparsear não vira "vazia" por omissão:
     * sem o campo, [[pagina-muda.ts]] a trata como suspeita. Um sinal que falha
     * calado para o lado de "não há nada aqui" é o defeito original.
     */
    return undefined;
  }
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

    /*
     * A TINTA, e SÓ na página suspeita.
     *
     * `getOperatorList()` reparseia o content stream inteiro da folha — é caro
     * o bastante para não se pagar num volume de 400 páginas que está todo
     * certo. E não precisa: quem já entregou texto acima do limiar não é
     * candidato a transcrição, e a tinta dela não seria olhada por ninguém.
     *
     * O sinal só existe para separar duas folhas que chegam aqui idênticas
     * (`text: ""`) e não são a mesma coisa: o verso em branco, que não vale
     * nada, e a folha cujo texto virou curva vetorial, que vale o memorial
     * inteiro. Ver [[pagina-muda.ts]].
     */
    const tinta =
      text.trim().length < LIMIAR_DE_CARACTERES ? await medirTinta(pdfjs, page) : undefined;

    pages.push({
      page: pageNumber,
      text,
      ...(tabelas.length > 0 ? { tabelas } : {}),
      ...(tinta ? { tinta } : {}),
    });
  }

  await document.destroy();

  return montarDocumento(pages, document.numPages);
}

/**
 * As páginas viram o DOCUMENTO — as duas montagens e a contagem.
 *
 * Separada de `extractPdfText` porque há um segundo produtor de páginas: a
 * transcrição por visão devolve o texto de uma folha muda e precisa recompor o
 * documento com ele dentro (ver `aplicarTranscricao` em [[pagina-muda.ts]]).
 * Montar ali por conta própria significaria duas noções de "como o documento é
 * escrito", e a segunda divergiria da primeira exatamente onde dói: a trava
 * anti-alucinação procura a evidência do achado NESTA string, e um separador de
 * página com um espaço a mais faria todo achado de folha transcrita ser
 * descartado sem deixar rastro.
 */
export function montarDocumento(
  pages: ExtractedPdfPage[],
  pageCount = pages.length,
): ExtractedPdf {
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
    pageCount,
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
