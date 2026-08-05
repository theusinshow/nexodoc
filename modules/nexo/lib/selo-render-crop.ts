/**
 * O RECORTE DO CARIMBO — CLIENT-ONLY (usa canvas do browser).
 *
 * Extraído de `selo-render.ts` para a conferência do volume montado poder usar
 * EXATAMENTE o mesmo enquadramento. Recortar de novo lá com outras constantes
 * faria a conferência julgar um pedaço de papel diferente daquele de onde
 * saíram os dados que ela confere — que é a mesma razão pela qual
 * `recortarSelo` já existia.
 */
"use client";

import type { Caixa } from "@/server/nexo/selo-regiao";

export const RENDER_SCALE = 2;
export const MAX_IMAGE_EDGE = 2400;

/**
 * Renderiza a página em escala 2, recorta a CAIXA DO CARIMBO e devolve um JPEG
 * data URL.
 *
 * A caixa chega pronta, medida pelas âncoras do texto. Com um recorte fixo, o
 * carimbo ocupava cerca de um sexto da imagem enviada — o modelo gastava
 * resolução com desenho, e o campo de numeração, que é onde ele mais erra,
 * chegava minúsculo. Recortando a caixa medida, a mesma aresta máxima de pixels
 * cobre só o carimbo.
 */
export async function renderSeloCrop(
  page: {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
      promise: Promise<void>;
    };
  },
  caixa: Caixa,
): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = Math.ceil(viewport.width);
  pageCanvas.height = Math.ceil(viewport.height);
  const pageCtx = pageCanvas.getContext("2d");
  if (!pageCtx) throw new Error("Canvas 2D indisponivel.");
  await page.render({ canvasContext: pageCtx, viewport }).promise;

  const cropX = Math.floor(caixa.x0 * pageCanvas.width);
  const cropY = Math.floor(caixa.y0 * pageCanvas.height);
  // O arredondamento pode estourar a borda em 1px; `drawImage` com origem fora
  // do canvas devolve imagem vazia, e uma imagem vazia é uma folha ilegível.
  const cropW = Math.max(
    1,
    Math.min(Math.ceil((caixa.x1 - caixa.x0) * pageCanvas.width), pageCanvas.width - cropX),
  );
  const cropH = Math.max(
    1,
    Math.min(Math.ceil((caixa.y1 - caixa.y0) * pageCanvas.height), pageCanvas.height - cropY),
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
