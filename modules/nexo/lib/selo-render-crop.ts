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

/** A tarefa devolvida por `page.render`, com o que o pdf.js guarda por dentro. */
type TarefaDeRender = {
  promise: Promise<void>;
  _internalRenderTask?: { _useRequestAnimationFrame?: boolean };
};

/**
 * DESLIGA O `requestAnimationFrame` DO DESENHO — é o que faz a leitura de selo
 * continuar quando a aba vai para segundo plano.
 *
 * O pdf.js não desenha a página de uma vez: ele executa a lista de operações em
 * fatias de ~15ms e agenda a fatia seguinte. Com intent de tela
 * (`useRequestAnimationFrame: !intentPrint`, em `PDFPageProxy.render`) esse
 * agendamento é `requestAnimationFrame` — e o Chrome NÃO roda rAF em aba de
 * segundo plano. Trocar de aba no meio da análise pendurava a promessa do
 * render, as três leituras simultâneas ficavam presas nela, e o progresso
 * congelava até a aba voltar à frente. Sem erro, sem aviso: só parado.
 *
 * Aqui não há tela nenhuma — o canvas é offscreen e existe só para virar um
 * JPEG. Sem rAF, o pdf.js continua por microtask (`Promise.resolve().then`),
 * que roda em segundo plano na mesma velocidade.
 *
 * A alternativa pela API pública seria renderizar com `intent: "print"`, que já
 * nasce sem rAF — mas ela troca o que é DESENHADO (anotações e conteúdo
 * opcional seguem regras de impressão), e o que se desenha aqui é exatamente o
 * que o modelo vai ler. Mexer no agendamento não muda um pixel; mudar o intent
 * muda.
 *
 * Os dois campos são internos do pdf.js (5.7.284) — o combinado está travado em
 * `scripts/test-nexo-render-em-segundo-plano.ts`. Se um upgrade os remover, o
 * recorte continua certo e volta a ser lento em segundo plano; por isso o campo
 * ausente passa em silêncio em vez de derrubar a leitura.
 */
export function semRequestAnimationFrame<T extends TarefaDeRender>(tarefa: T): T {
  const interno = tarefa._internalRenderTask;
  if (interno && typeof interno._useRequestAnimationFrame === "boolean") {
    interno._useRequestAnimationFrame = false;
  }
  return tarefa;
}

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
    render: (o: {
      canvasContext: CanvasRenderingContext2D;
      viewport: unknown;
    }) => TarefaDeRender;
  },
  caixa: Caixa,
): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = Math.ceil(viewport.width);
  pageCanvas.height = Math.ceil(viewport.height);
  const pageCtx = pageCanvas.getContext("2d");
  if (!pageCtx) throw new Error("Canvas 2D indisponivel.");
  await semRequestAnimationFrame(page.render({ canvasContext: pageCtx, viewport }))
    .promise;

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
