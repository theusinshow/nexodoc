"use client";

/**
 * O PRÉ-VOO — olhar o arquivo antes de decidir para onde ele vai.
 *
 * Três folhas de `getTextContent`, sem render, sem rede e sem modelo. É o que
 * separa "o nome diz prancha" de "isto tem 67 folhas de texto corrido", e é
 * barato o bastante para rodar em todo PDF que entra.
 *
 * A DECISÃO não mora aqui: mora em [[papel-do-anexo.ts]], que é puro e provável
 * no `node` cru. Aqui só se colhe o fato — a divisão é a mesma de
 * `attachments-core.ts` e `estado-do-anexo.ts`, e existe porque limiar que só
 * pode ser conferido abrindo o navegador não é conferido. Os limiares deste
 * trabalho foram medidos nos 661 PDFs do acervo justamente porque a conta vive
 * do outro lado desta fronteira (`npm run medir:papel`).
 */

import { normalizarItens } from "@/lib/coordenada-do-pdf";
import { parseFilename } from "@/server/nexo/parse-filename";
import { classificarPagina } from "@/server/nexo/selo-regiao";

import {
  CHARS_DE_FOLHA_MUDA,
  decidirPapel,
  paginasDaAmostra,
  papelPelaGeometria,
  type FatosDoAnexo,
  type MedidaDaPagina,
  type PapelDoAnexo,
} from "./papel-do-anexo";
import { loadPdfjs, medirTinta } from "./pdfjs-no-navegador";

export interface PreVooDoAnexo {
  file: File;
  papel: PapelDoAnexo;
  /** A frase que o chip mostra quando o papel é `indeciso`. */
  porque: string;
  fatos: FatosDoAnexo;
}

async function colherFatos(file: File): Promise<FatosDoAnexo> {
  const pdfjs = await loadPdfjs();
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  // Lido ANTES do `destroy()` do `finally`: depois dele o documento está
  // desmontado, e `numPages` sairia daqui como o total de um documento morto.
  const paginas = doc.numPages;

  try {
    const amostra: MedidaDaPagina[] = [];
    for (const n of paginasDaAmostra(paginas)) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const brutos = content.items.filter(
        (item): item is typeof item & { str: string; transform: number[] } =>
          "str" in item &&
          typeof item.str === "string" &&
          "transform" in item &&
          Array.isArray(item.transform),
      );

      const itens = normalizarItens(
        brutos.map((item) => {
          const [x, y] = viewport.convertToViewportPoint(
            item.transform[4],
            item.transform[5],
          );
          return { texto: item.str.trim(), x, y };
        }),
        { largura: viewport.width, altura: viewport.height },
      );

      const chars = brutos.reduce((soma, item) => soma + item.str.length, 0);

      /*
       * A TINTA só é medida na folha JÁ MAGRA — custa um reparse do content
       * stream, e a folha cheia de texto não tem dúvida a resolver. Mesma
       * economia que `diagnosticarArquivo` faz.
       */
      const tinta =
        chars < CHARS_DE_FOLHA_MUDA && OPS ? await medirTinta(page, OPS) : undefined;

      amostra.push({
        tipo: classificarPagina({
          largura: viewport.width,
          altura: viewport.height,
          itens,
        }),
        chars,
        temTinta: Boolean(tinta && tinta.desenho + tinta.imagem > 0),
      });
    }
    return { paginas, amostra };
  } finally {
    await doc.destroy();
  }
}

/**
 * O pré-voo de UM arquivo.
 *
 * PDF QUE NÃO ABRE NÃO VIRA PRANCHA. A amostra sai vazia, `papelPelaGeometria`
 * devolve "nao-sei" e o arquivo cai em `indeciso` — que pergunta. O modo de
 * falha antigo era o oposto: qualquer coisa que não fosse memorial pelo nome ia
 * calada para o leitor de selo, e é esse silêncio que este módulo existe para
 * acabar.
 */
export async function preVoar(file: File): Promise<PreVooDoAnexo> {
  const pelaConvencao = parseFilename(file.name).tipo;

  let fatos: FatosDoAnexo = { paginas: 0, amostra: [] };
  try {
    fatos = await colherFatos(file);
  } catch (err) {
    /*
     * A FALHA É DITA EM VOZ ALTA, e não engolida.
     *
     * Sem medida, `decidirPapel` cai para o nome — que é o comportamento antigo
     * e é o certo como reserva. Mas se a medição parar de funcionar por inteiro
     * (o `workerSrc` do pdf.js resolvido errado, por exemplo), TODO arquivo
     * passa a ser roteado pelo nome e o pré-voo vira um no-op — sem erro, sem
     * aviso, sem nada acender. Aconteceu na primeira prova deste módulo: os
     * quatro arquivos deram `paginas: 0` e a prova passou verde medindo nada.
     */
    console.warn(`[pre-voo] não deu para medir "${file.name}":`, err);
  }

  const { papel, porque } = decidirPapel({
    pelaConvencao,
    pelaGeometria: papelPelaGeometria(fatos),
    fatos,
  });

  return { file, papel, porque, fatos };
}

/**
 * O lote inteiro, um de cada vez.
 *
 * SEM `Promise.all`: cada pré-voo abre um PDF de até 25 MB, e oito ao mesmo
 * tempo é exatamente o pico de memória que a leitura de selo já limita a três.
 * O ganho de paralelizar aqui seria de décimos de segundo; o custo seria a aba
 * travando no lote grande, que é justamente o lote em que isto importa.
 */
export async function preVoarLote(files: readonly File[]): Promise<PreVooDoAnexo[]> {
  const saida: PreVooDoAnexo[] = [];
  for (const file of files) saida.push(await preVoar(file));
  return saida;
}
