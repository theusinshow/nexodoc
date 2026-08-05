/**
 * Leitura de selo (carimbo) de pranchas — CLIENT-ONLY (usa canvas do browser).
 *
 * Espelha a logica provada do modulo LD (components/ld/ld-workspace.tsx): renderiza
 * o recorte do selo + monta o texto posicional, e POSTa para a rota existente
 * /api/ld/extract-stamp (que ja faz auth + OpenAI->MiMo + telemetria). Mantido
 * isolado de proposito: o Nexo nao depende de refatorar o LD.
 *
 * O QUE VAI AO MODELO é decidido por três módulos puros, e não mais por
 * constantes chutadas:
 *
 *   - `selo-regiao`  onde fica o carimbo (medido pelas âncoras) e o que a
 *                    página é (prancha, capa, índice);
 *   - `texto-cad`    o texto de fonte quebrada, recuperado antes de sair daqui;
 *   - `textoPorPosicao`  a ordem de leitura, linha a linha.
 *
 * Antes, o recorte fixo entregava 228 itens de tabela de lajes rotulados como
 * "região do selo", com o carimbo perdido no meio; agora entrega ~33, que são o
 * carimbo. A medida está provada em `scripts/test-nexo-selo-regiao.ts` e nos
 * arquivos reais de `docs/samples/040-26`.
 */

import {
  acharCaixaDoSelo,
  classificarPagina,
  conteudoDoSelo,
  textoPorPosicao,
  tituloDaPrancha,
  valeLerComoPrancha,
  type Caixa,
  type ItemPosicionado,
  type TipoDePagina,
} from "@/server/nexo/selo-regiao";
import { repararTextoCad } from "@/server/nexo/texto-cad";

import { renderSeloCrop } from "./selo-render-crop";

const MAX_TEXT_CHARS = 24000;
/**
 * Prancha A0 pesa para renderizar e o modelo às vezes demora. Trinta segundos
 * derrubavam leitura boa, e folha derrubada SUMIA do conjunto sem erro — era o
 * "pulou prancha". Ver `postExtractStamp`, que ainda tenta de novo.
 */
const REQUEST_TIMEOUT_MS = 60000;
const MAX_CONCURRENT = 3;

export interface StampExtraction {
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  arquivo: string | null;
  conteudo: string | null;
  cliente: string | null;
  secretaria: string | null;
  obra: string | null;
  fase: string | null;
  tituloSecao: string | null;
  confianca: "alta" | "media" | "baixa";
  provider?: string;
  model?: string;
}

export interface SeloResult {
  fileName: string;
  pageNumber: number;
  pageCount: number;
  extraction: StampExtraction | null;
  error?: string;
  /**
   * A página foi PULADA de propósito: não é prancha (capa, separatriz, índice).
   *
   * Diferente de `error`, e a diferença importa na tela: pular capa é o
   * comportamento certo e não pede nada de ninguém; falhar ao ler uma prancha
   * pede uma segunda tentativa. Sem distinguir os dois, ou a capa vira alarme,
   * ou a falha vira silêncio — e o silêncio é o defeito que se está consertando.
   */
  ignorada?: TipoDePagina;
  /** Tokens de IA gastos nesta leitura de selo (indicador de consumo). */
  usage?: number;
}

/**
 * O selo de uma folha que NÃO pôde ser lida: todos os campos vazios.
 *
 * Existe para a folha continuar existindo. Antes, a página cuja leitura falhava
 * era filtrada fora e sumia — a conversa dizia "Li 14 folha(s)" de um PDF de 16
 * e ninguém ficava sabendo das duas. Com a casca vazia, a folha aparece no
 * canvas, a contagem fecha, o número dela ainda sai do nome do arquivo e da
 * ordem da página, e quem estiver olhando pode corrigir o resto à mão — que é
 * exatamente o que o popover "Corrigir" já sabe fazer.
 */
export function seloNaoLido(): StampExtraction {
  return {
    disciplina: null,
    folha: null,
    total: null,
    numeroFolha: null,
    arquivo: null,
    conteudo: null,
    cliente: null,
    secretaria: null,
    obra: null,
    fase: null,
    tituloSecao: null,
    confianca: "baixa",
  };
}

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * O recorte do selo de UMA página, como JPEG data URL — o mesmo recorte que
 * vai ao OCR na leitura.
 *
 * Existe para a CONFERÊNCIA DE IDENTIDADE (`selo-check.ts`) reusar exatamente
 * o enquadramento provado. Recortar de novo por lá, com outras constantes,
 * faria a conferência julgar uma região do papel diferente daquela de onde
 * saíram os dados que ela confere.
 */
export async function recortarSelo(file: File, pageNumber: number): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    // A caixa é medida aqui também, e pelo mesmo caminho: é o que garante que a
    // conferência de identidade julgue exatamente o pedaço de papel de onde
    // saíram os dados que ela confere.
    const { caixa } = await analisarPagina(page as never);
    return await renderSeloCrop(page as never, caixa);
  } finally {
    await doc.destroy();
  }
}

interface TextItemLike {
  str?: string;
  transform?: number[];
  fontName?: string;
}

interface PaginaPdf {
  getViewport: (o: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportPoint: (x: number, y: number) => number[];
  };
  getTextContent: () => Promise<{ items: unknown[] }>;
}

/** O que se sabe de uma página ANTES de gastar uma chamada de modelo com ela. */
export interface PaginaAnalisada {
  tipo: TipoDePagina;
  caixa: Caixa;
  /** Quantas âncoras do carimbo foram achadas; 0 = a caixa é a de reserva. */
  ancoras: number;
  /** O texto do carimbo, em ordem de leitura, pronto para o modelo. */
  texto: string;
  /**
   * O CONTEÚDO lido pela GEOMETRIA da grade — determinístico, sem IA.
   *
   * Existe porque num projeto real de 71 pranchas o modelo devolveu 5 títulos
   * vazios, e o título é a coluna DESCRIÇÃO da LD. Medido nas amostras, a
   * geometria acerta 45 de 45. Quem decide entre ela e o modelo é
   * `tituloDaPrancha`: a geometria conhece a BORDA da célula (e por isso corta
   * o campo vizinho que o modelo cola no fim), o modelo conhece o ACENTO.
   */
  conteudo: string;
  /**
   * Esta página teve texto vindo de FONTE QUEBRADA (sem mapa de caracteres).
   *
   * É o que decide quem vence no título: com a fonte sã, a geometria é a
   * transcrição fiel do documento; com ela quebrada, os caracteres lidos não
   * valem ("PAGINAdO" por "PAGINAÇÃO") e o modelo, que leu da imagem, é a
   * leitura melhor.
   */
  textoRecuperado: boolean;
}

/** Aviso que acompanha o texto quando houve fonte quebrada nesta página. */
const AVISO_RECUPERADO =
  "AVISO: parte do texto desta pagina veio de fonte sem mapa de caracteres e foi RECUPERADA por deslocamento. " +
  "As letras estao certas; os ACENTOS podem estar trocados (ex.: \"CHAPECI\" onde se le \"CHAPECO\", \"REVITALIZAdO\" onde se le \"REVITALIZACAO\"). " +
  "Onde o texto discordar da imagem, vale a IMAGEM. Trechos marcados [ilegivel] nao puderam ser recuperados: leia esse campo pela imagem.";

/**
 * Lê a página SEM gastar modelo: recupera o texto, mede a caixa do carimbo,
 * classifica o papel e monta o texto em ordem de leitura.
 *
 * Tudo aqui é determinístico e barato — é o que permite decidir se vale a pena
 * chamar o modelo antes de chamá-lo.
 */
export async function analisarPagina(page: PaginaPdf): Promise<PaginaAnalisada> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const w = viewport.width;
  const h = viewport.height;

  const brutos: { item: TextItemLike; texto: string; fonte: string }[] = [];
  for (const raw of content.items) {
    const item = raw as TextItemLike;
    const str = typeof item.str === "string" ? item.str.trim() : "";
    if (!str || !item.transform) continue;
    brutos.push({ item, texto: item.str as string, fonte: item.fontName ?? "" });
  }

  // O reparo vem PRIMEIRO: as âncoras do carimbo e o código da prancha podem
  // estar dentro do que a fonte quebrada escreveu.
  const { textos, marcaveis, fontesQuebradas } = repararTextoCad(brutos);
  const marcados = new Set(marcaveis);

  const itens: ItemPosicionado[] = brutos.map((b, i) => {
    const [vx, vy] = viewport.convertToViewportPoint(
      b.item.transform![4],
      b.item.transform![5],
    );
    return {
      texto: marcados.has(i) ? "[ilegivel]" : textos[i].trim(),
      x: vx / w,
      y: vy / h,
    };
  });

  const tipo = classificarPagina({ largura: w, altura: h, itens });
  const { caixa, ancoras } = acharCaixaDoSelo(itens);

  /*
   * Duas regiões, e nesta ordem. O SELO é a caixa medida — é dele que saem
   * PRANCHA, ARQUIVO e CONTEÚDO. A PÁGINA COMPLETA fica depois porque órgão,
   * obra e fase às vezes moram no cabeçalho, fora do carimbo; e fica DEPOIS
   * para que, se o corte por tamanho vier, ele coma o geral e não o específico.
   */
  const partes = [
    ...(fontesQuebradas.length > 0 ? [AVISO_RECUPERADO] : []),
    `REGIAO DO SELO${ancoras > 0 ? " (medida pelos rotulos do carimbo)" : " (aproximada: nenhum rotulo encontrado)"}:\n${textoPorPosicao(itens, caixa)}`,
    `PAGINA COMPLETA:\n${textoPorPosicao(itens, { x0: 0, y0: 0, x1: 1, y1: 1 })}`,
  ];

  return {
    tipo,
    caixa,
    ancoras,
    texto: partes.join("\n\n").slice(0, MAX_TEXT_CHARS),
    conteudo: conteudoDoSelo(itens),
    textoRecuperado: fontesQuebradas.length > 0,
  };
}

/**
 * Falha que vale uma segunda tentativa: timeout, rede caída, indisponibilidade
 * momentânea do provedor. Teto estourado (402) e não-autenticado (401) não
 * entram — tentar de novo só gasta tempo e dá a mesma resposta.
 */
function valeTentarDeNovo(erro: unknown): boolean {
  if (erro instanceof DOMException && erro.name === "AbortError") return true;
  const msg = erro instanceof Error ? erro.message : "";
  return /Erro (429|500|502|503|504)|Failed to fetch|NetworkError|load failed/i.test(msg);
}

/**
 * Uma folha que falha ao ler não pode SUMIR — era o "pulou prancha". A defesa
 * tem duas camadas, e as duas são necessárias:
 *
 *   1. AQUI, uma segunda tentativa. Prancha A0 com três leituras simultâneas
 *      esbarrava no timeout de 30s, e um esbarrão custava a folha inteira.
 *   2. Em `extractSeloFromPage`, a folha entra no conjunto MESMO ASSIM, com o
 *      erro à mostra — porque a segunda tentativa também pode falhar, e aí a
 *      folha tem de aparecer na tela para alguém decidir o que fazer.
 */
const TENTATIVAS = 2;

async function postExtractStamp(
  imageDataUrl: string,
  pdfText: string,
  metadata: Record<string, unknown>,
  conversationId?: string | null,
): Promise<{ extraction: StampExtraction; usage: number }> {
  let ultimo: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      return await postExtractStampUmaVez(imageDataUrl, pdfText, metadata, conversationId);
    } catch (err) {
      ultimo = err;
      if (tentativa === TENTATIVAS || !valeTentarDeNovo(err)) break;
    }
  }
  throw ultimo;
}

async function postExtractStampUmaVez(
  imageDataUrl: string,
  pdfText: string,
  metadata: Record<string, unknown>,
  conversationId?: string | null,
): Promise<{ extraction: StampExtraction; usage: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/ld/extract-stamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, pdfText, metadata, conversationId }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Erro ${res.status} no OCR do selo.`);
    }
    const json = (await res.json()) as StampExtraction & {
      usage?: { totalTokens?: number };
    };
    const usage = typeof json.usage?.totalTokens === "number" ? json.usage.totalTokens : 0;
    return { extraction: json, usage };
  } finally {
    clearTimeout(timeout);
  }
}

/** Lê um File como data URL (base64 com prefixo) — para imagens avulsas. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Lê o selo de uma IMAGEM avulsa (ex.: foto de um carimbo) pela MESMA rota de OCR
 * — a imagem já é o recorte, então não há render de PDF (pdfText vazio). Multimodal
 * "do jeito do domínio": uma foto de carimbo vira dados de selo no contexto.
 */
export async function extractSeloFromImage(
  file: File,
  conversationId?: string | null,
): Promise<SeloResult> {
  try {
    const imageDataUrl = await fileToDataUrl(file);
    const { extraction, usage } = await postExtractStamp(imageDataUrl, "", {
      fileName: file.name,
      source: "image",
      operation: "nexo-selo-image",
    }, conversationId);
    return { fileName: file.name, pageNumber: 1, pageCount: 1, extraction, usage };
  } catch (err) {
    return {
      fileName: file.name,
      pageNumber: 1,
      pageCount: 1,
      extraction: null,
      error: err instanceof Error ? err.message : "Falha ao ler a imagem.",
    };
  }
}

/** Le o selo de UMA pagina de um documento pdf.js JA ABERTO (sem re-parsear). */
async function extractSeloFromPage(
  doc: { getPage: (n: number) => Promise<unknown> },
  file: File,
  pageNumber: number,
  pageCount: number,
  conversationId?: string | null,
): Promise<SeloResult> {
  try {
    const page = await doc.getPage(pageNumber);
    // A análise é determinística e barata, e decide se vale gastar o modelo:
    // capa, separatriz e índice saem daqui sem custar uma chamada.
    const { tipo, caixa, ancoras, texto, conteudo, textoRecuperado } =
      await analisarPagina(page as never);
    if (!valeLerComoPrancha(tipo)) {
      return { fileName: file.name, pageNumber, pageCount, extraction: null, ignorada: tipo };
    }

    const imageDataUrl = await renderSeloCrop(page as never, caixa);
    const { extraction, usage } = await postExtractStamp(imageDataUrl, texto, {
      fileName: file.name,
      pageNumber,
      source: "visual",
      operation: "nexo-selo",
      // Telemetria do que mudou: dá para ver, na fatura, se a caixa foi medida
      // ou se caiu na de reserva — e em quais arquivos.
      ancoras,
    }, conversationId);
    /*
     * O TÍTULO é decidido entre as DUAS leituras — ver `tituloDaPrancha`.
     *
     * Antes a geometria só entrava quando o modelo devolvia vazio, e por isso o
     * título contaminado passava batido: "ESCADA 01: DETALHAMENTO GERAL EST"
     * chegou assim à lista entregue, com o "EST" da célula vizinha pendurado.
     * Quem sabe onde a célula do CONTEÚDO termina é a geometria; o modelo só
     * decide acento, e só quando as duas dizem a mesma coisa.
     */
    const completada = extraction
      ? {
          ...extraction,
          conteudo:
            tituloDaPrancha(extraction.conteudo, conteudo, { textoRecuperado }) || null,
        }
      : extraction;
    return { fileName: file.name, pageNumber, pageCount, extraction: completada, usage };
  } catch (err) {
    return {
      fileName: file.name,
      pageNumber,
      pageCount,
      extraction: null,
      error: err instanceof Error ? err.message : "Falha ao ler o selo.",
    };
  }
}

/**
 * Le os selos de todas as paginas de todas as pranchas anexadas, ~3 por vez.
 * `onResult` recebe cada resultado assim que fica pronto (feedback incremental).
 */
/** Chave de uma folha já lida: `arquivo#pagina`. */
export function chaveDaFolha(fileName: string, pageNumber: number): string {
  return `${fileName}#${pageNumber}`;
}

/**
 * Preenche o TÍTULO das folhas que estão sem ele, pela geometria do carimbo.
 *
 * Custa ZERO: não abre o modelo, só relê o texto do PDF que já está na mão.
 *
 * Existe porque a leitura de selo nunca relê uma página já lida — é a economia
 * que torna a retomada barata, e ela também congela o que foi lido com um
 * defeito antigo. Num projeto real de 71 pranchas, sete folhas ficaram sem
 * título porque foram lidas antes de a geometria existir, e a única saída era
 * pagar 71 chamadas de novo ou corrigir sete títulos à mão.
 *
 * Só toca no que está VAZIO. O que o modelo leu fica como está — ele lê da
 * imagem e acerta os acentos que a fonte quebrada mangala aqui.
 */
export async function preencherTitulosFaltantes(
  files: File[],
  resultados: SeloResult[],
): Promise<number> {
  const faltantes = resultados.filter(
    (r) => r.extraction && !r.extraction.conteudo?.trim(),
  );
  if (faltantes.length === 0) return 0;

  const pdfjs = await loadPdfjs();
  const porNome = new Map(files.map((f) => [f.name, f]));
  let preenchidos = 0;

  // Agrupa por arquivo: abrir um PDF de 18 MB uma vez por folha seria lento à
  // toa quando as sete folhas moram no mesmo documento.
  const porArquivo = new Map<string, SeloResult[]>();
  for (const r of faltantes) {
    const lista = porArquivo.get(r.fileName);
    if (lista) lista.push(r);
    else porArquivo.set(r.fileName, [r]);
  }

  for (const [nome, doArquivo] of porArquivo) {
    const file = porNome.get(nome);
    if (!file) continue;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      for (const r of doArquivo) {
        try {
          const page = await doc.getPage(r.pageNumber);
          const { conteudo } = await analisarPagina(page as never);
          if (conteudo && r.extraction) {
            r.extraction = { ...r.extraction, conteudo };
            preenchidos++;
          }
        } catch {
          // Uma página que não abre não pode parar as outras seis.
        }
      }
    } finally {
      await doc.destroy();
    }
  }
  return preenchidos;
}

export async function extractSelosFromFiles(
  files: File[],
  onResult?: (result: SeloResult) => void,
  conversationId?: string | null,
  onTotalFolhas?: (total: number) => void,
  /**
   * Folhas que NÃO devem ser lidas de novo (`chaveDaFolha`).
   *
   * É o que torna a retomada barata: ler o selo é uma chamada de modelo POR
   * PÁGINA, então uma leitura que quebrou na 18ª de 24 custa 17 chamadas para
   * recomeçar do zero. Com o conjunto, custa 7.
   */
  jaLidas?: ReadonlySet<string>,
): Promise<SeloResult[]> {
  const pdfjs = await loadPdfjs();
  const results: SeloResult[] = [];

  /*
   * PRIMEIRA PASSADA: só conta as folhas.
   *
   * O nº de páginas de um PDF só se sabe abrindo, então antes o total CRESCIA
   * junto com o progresso — com um arquivo por prancha virava "1 de 1", "2 de
   * 2", "3 de 3", e o engenheiro não tinha como saber quando acabaria.
   *
   * Abrir duas vezes é barato: aqui o pdf.js só lê a ESTRUTURA do documento; o
   * caro (renderizar a página para o OCR) acontece só na segunda passada.
   */
  if (onTotalFolhas) {
    let totalFolhas = 0;
    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        totalFolhas += doc.numPages;
        await doc.destroy();
      } catch {
        // Arquivo ilegível conta como uma folha: ele ainda vai virar um
        // resultado com erro, e sumir do total faria a conta não fechar.
        totalFolhas += 1;
      }
    }
    onTotalFolhas(totalFolhas);
  }

  // Abre CADA arquivo UMA vez e itera as paginas do MESMO documento — sem
  // re-parsear o PDF inteiro por pagina nem copiar o ArrayBuffer (data.slice(0))
  // a cada pagina. Mantem <=MAX_CONCURRENT leituras de selo simultaneas.
  for (const file of files) {
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    const pageCount = doc.numPages;
    try {
      let cursor = 1;
      const worker = async () => {
        for (;;) {
          const pageNumber = cursor;
          cursor += 1;
          if (pageNumber > pageCount) break;
          // Já lida numa tentativa anterior: pula sem gastar a chamada.
          if (jaLidas?.has(chaveDaFolha(file.name, pageNumber))) continue;
          const result = await extractSeloFromPage(doc, file, pageNumber, pageCount, conversationId);
          results.push(result);
          onResult?.(result);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENT, pageCount) }, worker),
      );
    } finally {
      await doc.destroy();
    }
  }

  return results;
}
