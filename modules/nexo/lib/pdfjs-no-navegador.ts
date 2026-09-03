"use client";

/**
 * O pdf.js DO NAVEGADOR, carregado uma vez — e a medida que não depende de
 * desenhar nada.
 *
 * `loadPdfjs` morava privado em `pagina-muda-render.ts` e em `selo-render.ts`,
 * idêntico nos dois. Com o pré-voo do anexo precisando do mesmo carregamento e
 * da mesma medida de tinta, a terceira cópia seria a que um dia divergiria — e
 * a divergência apareceria como o worker configurado num caminho e não no
 * outro, que só falha depois do deploy.
 *
 * `selo-render.ts` NÃO foi rewirado, de propósito: é o caminho da leitura de
 * selo, e trocar o carregador dele não serve a nenhum objetivo em curso. Ficam
 * duas cópias em vez de três, e a próxima a chegar já tem endereço.
 */

export type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export async function loadPdfjs(): Promise<PdfjsModule> {
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
 * QUANTO A FOLHA MANDA DESENHAR, fora o texto.
 *
 * É o sinal que separa a folha em branco da folha cujo texto virou curva
 * vetorial ou tira de imagem — as duas chegam como `text: ""`. Custa um reparse
 * do content stream, então só vale a pena na folha que já é magra.
 *
 * Devolve `undefined` quando o reparse falha: ausência de medida é diferente de
 * medida zero, e quem chama precisa poder distinguir as duas.
 */
export async function medirTinta(
  page: { getOperatorList: () => Promise<{ fnArray: number[] | Uint8Array }> },
  OPS: Record<string, number>,
): Promise<{ desenho: number; imagem: number } | undefined> {
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
    return undefined;
  }
}
