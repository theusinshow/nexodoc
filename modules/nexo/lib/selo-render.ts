/**
 * Leitura de selo (carimbo) de pranchas — CLIENT-ONLY (usa canvas do browser).
 *
 * Espelha a logica provada do modulo LD (components/ld/ld-workspace.tsx): renderiza
 * o recorte do selo (canto inferior direito) + monta o texto posicional, e POSTa
 * para a rota existente /api/ld/extract-stamp (que ja faz auth + OpenAI->MiMo +
 * telemetria). Mantido isolado de proposito: o Nexo nao depende de refatorar o LD.
 */

// Recorte normalizado do selo (canto inf. direito), escala de render e limites.
const SELO_CROP = { x: 0.52, y: 0.5, width: 0.47, height: 0.48 };
const RENDER_SCALE = 2;
const MAX_IMAGE_EDGE = 2400;
const MAX_TEXT_CHARS = 24000;
const REQUEST_TIMEOUT_MS = 30000;
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
  /** Tokens de IA gastos nesta leitura de selo (indicador de consumo). */
  usage?: number;
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

/** Renderiza a pagina em escala 2, recorta a regiao do selo e devolve um JPEG data URL. */
async function renderSeloCrop(page: {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>;
  };
}): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = Math.ceil(viewport.width);
  pageCanvas.height = Math.ceil(viewport.height);
  const pageCtx = pageCanvas.getContext("2d");
  if (!pageCtx) throw new Error("Canvas 2D indisponivel.");
  await page.render({ canvasContext: pageCtx, viewport }).promise;

  const cropX = Math.floor(SELO_CROP.x * pageCanvas.width);
  const cropY = Math.floor(SELO_CROP.y * pageCanvas.height);
  const cropW = Math.min(
    Math.ceil(SELO_CROP.width * pageCanvas.width),
    pageCanvas.width - cropX,
  );
  const cropH = Math.min(
    Math.ceil(SELO_CROP.height * pageCanvas.height),
    pageCanvas.height - cropY,
  );

  const longest = Math.max(cropW, cropH);
  const factor = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;
  const outW = Math.max(1, Math.round(cropW * factor));
  const outH = Math.max(1, Math.round(cropH * factor));

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = outW;
  cropCanvas.height = outH;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) throw new Error("Canvas 2D indisponivel.");
  cropCtx.drawImage(pageCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
  return cropCanvas.toDataURL("image/jpeg", 0.92);
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
    return await renderSeloCrop(page as never);
  } finally {
    await doc.destroy();
  }
}

interface TextItemLike {
  str?: string;
  transform?: number[];
}

/** Texto posicional das regioes do selo (do mais especifico ao geral), cap 24000. */
async function buildSeloText(page: {
  getViewport: (o: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportPoint: (x: number, y: number) => number[];
  };
  getTextContent: () => Promise<{ items: unknown[] }>;
}): Promise<string> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const w = viewport.width;
  const h = viewport.height;

  const selo: string[] = [];
  const ampliada: string[] = [];
  const completa: string[] = [];

  for (const raw of content.items) {
    const item = raw as TextItemLike;
    const str = typeof item.str === "string" ? item.str.trim() : "";
    if (!str || !item.transform) continue;
    const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const nx = vx / w;
    const ny = vy / h;
    completa.push(str);
    if (nx >= 0.45 && ny >= 0.45) ampliada.push(str);
    if (nx >= 0.55 && ny >= 0.55) selo.push(str);
  }

  const text = [
    `REGIAO DO SELO:\n${selo.join(" ")}`,
    `REGIAO AMPLIADA:\n${ampliada.join(" ")}`,
    `PAGINA COMPLETA:\n${completa.join(" ")}`,
  ].join("\n\n");

  return text.slice(0, MAX_TEXT_CHARS);
}

async function postExtractStamp(
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
    const [imageDataUrl, pdfText] = await Promise.all([
      renderSeloCrop(page as never),
      buildSeloText(page as never),
    ]);
    const { extraction, usage } = await postExtractStamp(imageDataUrl, pdfText, {
      fileName: file.name,
      pageNumber,
      source: "visual",
      operation: "nexo-selo",
    }, conversationId);
    return { fileName: file.name, pageNumber, pageCount, extraction, usage };
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
