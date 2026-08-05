/**
 * Leitura do VOLUME JÁ MONTADO — CLIENT-ONLY (usa canvas do browser).
 *
 * Abre o PDF final e devolve, por página, o que está escrito no carimbo. Não
 * julga nada: comparar com o plano é `checkVolumeMontado`.
 *
 * O RECORTE do "a IA lê tudo": página de LD ou separatriz é lida por EXTRAÇÃO DE
 * TEXTO, sem modelo. São PDFs que nós mesmos geramos, com texto limpo — mandá-los
 * a um modelo de visão é pagar para ler o que nós escrevemos. É também de onde
 * saem as linhas da LD impressa, que é o gabarito da conferência LD × volume.
 */
"use client";

import {
  acharCaixaDoSelo,
  classificarPagina,
  textoPorPosicao,
  type ItemPosicionado,
} from "@/server/nexo/selo-regiao";
import { repararTextoCad } from "@/server/nexo/texto-cad";
import { parseLinhasDaLd, type LeituraDaPagina } from "@/server/nexo/volume-check-core";
import type { PaginaEsperada } from "@/server/nexo/volume-plano";

import { postVolumeCheck } from "./generate";
import { renderSeloCrop } from "./selo-render-crop";

/** Páginas por chamada — tem de casar com `PAGINAS_POR_LOTE` da rota. */
const PAGINAS_POR_LOTE = 4;
/** Lotes simultâneos. Três é o mesmo teto da leitura de selo. */
const LOTES_SIMULTANEOS = 3;

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function carregarPdfjs(): Promise<PdfjsModule> {
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

function base64ParaBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Uma leitura vazia — a página existe, mas nada foi lido dela ainda. */
function vazia(pagina: number): LeituraDaPagina {
  return {
    pagina,
    temCarimbo: false,
    numeracaoTexto: "",
    folha: null,
    total: null,
    codigo: "",
    titulo: "",
    disciplina: "",
    orgao: "",
    obra: "",
  };
}

interface ItemBruto {
  transform: number[];
}

export async function lerVolumeMontado(args: {
  pdfBase64: string;
  esperado: readonly PaginaEsperada[];
  conversationId?: string | null;
  onProgresso?: (lidas: number, total: number) => void;
}): Promise<LeituraDaPagina[]> {
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({ data: base64ParaBytes(args.pdfBase64) }).promise;
  const papelDe = new Map(args.esperado.map((p) => [p.pagina, p.papel]));

  try {
    const resultados: LeituraDaPagina[] = [];
    /** As páginas de prancha, com o recorte do carimbo pronto para o modelo. */
    const paraOModelo: { pagina: number; imageDataUrl: string }[] = [];

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const brutos = content.items
        .filter((r) => {
          const it = r as { str?: string; transform?: number[] };
          return typeof it.str === "string" && it.str.trim() && Array.isArray(it.transform);
        })
        .map((r) => {
          const it = r as { str: string; transform: number[]; fontName?: string };
          return { item: it as ItemBruto, texto: it.str, fonte: it.fontName ?? "" };
        });
      // O reparo vem primeiro: a família EST também entra no volume, e as
      // âncoras do carimbo podem estar dentro do que a fonte quebrada escreveu.
      const { textos } = repararTextoCad(brutos);
      const itens: ItemPosicionado[] = brutos.map((b, i) => {
        const [vx, vy] = viewport.convertToViewportPoint(
          b.item.transform[4],
          b.item.transform[5],
        );
        return { texto: textos[i].trim(), x: vx / viewport.width, y: vy / viewport.height };
      });

      const tipo = classificarPagina({
        largura: viewport.width,
        altura: viewport.height,
        itens,
      });
      const { caixa, ancoras } = acharCaixaDoSelo(itens);
      const leitura = vazia(n);
      // O carimbo é FATO da página, não opinião do modelo: são as âncoras.
      leitura.temCarimbo = tipo === "prancha" && ancoras > 0;

      const papel = papelDe.get(n);
      if (papel === "ld" || papel === "separatriz") {
        // Nosso próprio PDF: texto limpo, leitura de graça.
        leitura.linhasDaLd = parseLinhasDaLd(
          textoPorPosicao(itens, { x0: 0, y0: 0, x1: 1, y1: 1 }),
        );
      } else if (leitura.temCarimbo) {
        paraOModelo.push({
          pagina: n,
          imageDataUrl: await renderSeloCrop(page as never, caixa),
        });
      }
      resultados.push(leitura);
    }

    const porPagina = new Map(resultados.map((r) => [r.pagina, r]));
    const lotes: { pagina: number; imageDataUrl: string }[][] = [];
    for (let i = 0; i < paraOModelo.length; i += PAGINAS_POR_LOTE) {
      lotes.push(paraOModelo.slice(i, i + PAGINAS_POR_LOTE));
    }

    let feitas = 0;
    let cursor = 0;
    const trabalhador = async () => {
      for (;;) {
        const lote = lotes[cursor++];
        if (!lote) break;
        try {
          for (const l of await postVolumeCheck(lote, args.conversationId)) {
            const alvo = porPagina.get(l.pagina);
            if (!alvo) continue;
            alvo.numeracaoTexto = l.numeracaoTexto;
            alvo.folha = l.folha;
            alvo.total = l.total;
            alvo.codigo = l.codigo;
            alvo.titulo = l.titulo;
            alvo.disciplina = l.disciplina;
            alvo.orgao = l.orgao;
            alvo.obra = l.obra;
            if (l.erro) alvo.erro = l.erro;
          }
        } catch (err) {
          // A página NÃO some: vira erro, e erro trava o veredito "ok". É a
          // mesma regra da leitura de selo, e pela mesma razão — folha que
          // desaparece em silêncio é o defeito mais caro deste sistema.
          const motivo = err instanceof Error ? err.message : "Falha ao ler a página.";
          for (const p of lote) {
            const alvo = porPagina.get(p.pagina);
            if (alvo) alvo.erro = motivo;
          }
        }
        feitas += lote.length;
        args.onProgresso?.(feitas, paraOModelo.length);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(LOTES_SIMULTANEOS, lotes.length) }, trabalhador),
    );

    return resultados;
  } finally {
    await doc.destroy();
  }
}
