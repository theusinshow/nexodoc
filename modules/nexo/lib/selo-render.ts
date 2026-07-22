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
): Promise<StampExtraction> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/ld/extract-stamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, pdfText, metadata }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Erro ${res.status} no OCR do selo.`);
    }
    return (await res.json()) as StampExtraction;
  } finally {
    clearTimeout(timeout);
  }
}

/** Le o selo de UMA pagina de UM PDF. */
async function extractSeloFromPage(
  pdfjs: PdfjsModule,
  file: File,
  data: ArrayBuffer,
  pageNumber: number,
  pageCount: number,
): Promise<SeloResult> {
  try {
    const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
    const page = await doc.getPage(pageNumber);
    const [imageDataUrl, pdfText] = await Promise.all([
      renderSeloCrop(page as never),
      buildSeloText(page as never),
    ]);
    await doc.destroy();
    const extraction = await postExtractStamp(imageDataUrl, pdfText, {
      fileName: file.name,
      pageNumber,
      source: "visual",
      operation: "nexo-selo",
    });
    return { fileName: file.name, pageNumber, pageCount, extraction };
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
export async function extractSelosFromFiles(
  files: File[],
  onResult?: (result: SeloResult) => void,
): Promise<SeloResult[]> {
  const pdfjs = await loadPdfjs();

  // Enumera (arquivo, pagina) de todas as pranchas.
  const jobs: { file: File; data: ArrayBuffer; pageNumber: number; pageCount: number }[] = [];
  for (const file of files) {
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
    const pageCount = doc.numPages;
    await doc.destroy();
    for (let p = 1; p <= pageCount; p += 1) {
      jobs.push({ file, data, pageNumber: p, pageCount });
    }
  }

  const results: SeloResult[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const result = await extractSeloFromPage(
        pdfjs,
        job.file,
        job.data,
        job.pageNumber,
        job.pageCount,
      );
      results.push(result);
      onResult?.(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, jobs.length) }, worker));
  return results;
}
