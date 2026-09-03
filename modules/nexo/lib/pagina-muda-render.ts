/**
 * A PÁGINA MUDA, DO LADO DO NAVEGADOR — CLIENT-ONLY (usa canvas do browser).
 *
 * Duas coisas moram aqui, e as duas por não caberem no servidor:
 *
 *  1. A DETECÇÃO ANTES DO UPLOAD. O portão pergunta "25 das 31 folhas deste
 *     documento não têm texto, transcrever?" e precisa perguntar ANTES de a
 *     auditoria começar. O motor é SSE com cancelamento e retomada pós-F5;
 *     pausar no meio da corrida para esperar um clique seria uma máquina de
 *     estados nova. O cliente já tem os bytes do PDF — ele os POSTa — e o
 *     pdf.js já roda no navegador, então a detecção sai de graça na porta.
 *
 *  2. A RASTERIZAÇÃO. Não há canvas no Node neste projeto (sem `node-canvas`,
 *     sem `sharp`). É a mesma razão pela qual [[selo-render.ts]] é client-only,
 *     e este módulo empresta dele o que já estava provado: o carregamento do
 *     pdf.js e o `semRequestAnimationFrame`, sem o qual a análise congela
 *     calada quando a aba vai para segundo plano.
 *
 * O JULGAMENTO NÃO MORA AQUI. Quem decide o que é folha muda é
 * `classificarPagina`, em [[pagina-muda.ts]], puro e testado — o mesmo módulo
 * que o servidor usa para contar a cobertura. Duas noções de "esta folha foi
 * lida" no mesmo repositório seria garantir que um dia elas discordassem sobre
 * a mesma página, e a discordância apareceria como um parecer que se diz
 * completo sobre um documento que o portão sabia estar pela metade.
 */
"use client";

import {
  LIMIAR_DE_CARACTERES,
  VERSAO_DO_TRANSCRITOR,
  classificarPagina,
  type PaginaTranscrita,
} from "@/lib/pagina-muda";

import { getTranscricaoCache, putTranscricaoCache } from "./nexo-db";
import { loadPdfjs, medirTinta } from "./pdfjs-no-navegador";
import { semRequestAnimationFrame } from "./selo-render-crop";

/**
 * Escala do render. 2 sobre a A4 de 595x842pt dá ~1190x1684 px, ou ~150 dpi.
 *
 * É o mesmo número da leitura de selo, e por um motivo parecido: o que a folha
 * carrega de mais frágil é DÍGITO — cota, diâmetro, espessura de perfil ("t=10
 * mm", "254 x 44,7") — e o dígito é a primeira coisa a se perder quando a
 * resolução cai. Subir daqui engorda a imagem sem que o modelo leia melhor uma
 * fonte de 10pt que já está nítida; descer troca centavos por erro numa
 * auditoria que confere número.
 *
 * MUDAR ESTE NÚMERO É MUDAR O QUE SAI DA TRANSCRIÇÃO: suba
 * `VERSAO_DO_TRANSCRITOR` junto, senão o cache serve, calado, a leitura feita na
 * escala velha.
 */
const ESCALA_DO_RENDER = 2;

/** Quantas folhas vão ao modelo ao mesmo tempo. O mesmo teto da leitura de selo. */
const SIMULTANEAS = 3;

export interface DiagnosticoDoArquivo {
  file: File;
  /** As páginas que valem transcrição, em ordem. */
  mudas: number[];
  totalDePaginas: number;
  /** sha-256 do conteúdo — a metade estável da chave do cache. */
  checksum: string;
}

/**
 * O QUE ESTE DOCUMENTO ESCONDE — sem gastar um token.
 *
 * Roda a mesma extração por página que o servidor roda, mas só até o ponto de
 * classificar: texto da folha e, quando ele é curto, a tinta. Ver
 * [[pagina-muda.ts]] para o porquê dos dois sinais.
 */
export async function diagnosticarArquivo(file: File): Promise<DiagnosticoDoArquivo> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const checksum = await sha256(data);
  const doc = await pdfjs.getDocument({ data }).promise;
  // Lido ANTES do `destroy()` do `finally`: depois dele o documento está
  // desmontado, e `numPages` sairia daqui como o total de páginas de um
  // documento que não existe mais.
  const totalDePaginas = doc.numPages;
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const mudas: number[] = [];

  try {
    for (let n = 1; n <= totalDePaginas; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .join(" ");

      /*
       * A TINTA custa um reparse do content stream, então só é medida quando a
       * folha já é candidata — mesma economia do servidor. `classificarPagina`
       * trata a ausência do campo como suspeita, e é por isso que a chamada
       * pode ser condicional sem inverter a resposta.
       */
      const magra = text.trim().length < LIMIAR_DE_CARACTERES;
      const tinta = magra && OPS ? await medirTinta(page, OPS) : undefined;

      if (classificarPagina({ page: n, text, ...(tinta ? { tinta } : {}) }).classe === "muda") {
        mudas.push(n);
      }
    }
  } finally {
    await doc.destroy();
  }

  return { file, mudas, totalDePaginas, checksum };
}


export interface ProgressoDaTranscricao {
  /** Folhas já resolvidas — do cache ou do modelo. */
  prontas: number;
  total: number;
}

export interface OpcoesDeTranscricao {
  onProgresso?: (p: ProgressoDaTranscricao) => void;
  signal?: AbortSignal;
  conversationId?: string;
}

/**
 * Transcreve as folhas mudas do arquivo e devolve o que conseguiu.
 *
 * DEVOLVE O QUE CONSEGUIU, e não tudo ou nada: uma folha que falhou continua
 * muda e chega ao parecer como não lida — a cobertura a conta em
 * `paginas_mudas` e não em `paginas_transcritas`, e o veredito rebaixa sozinho.
 * Derrubar as outras 24 por causa dela trocaria uma auditoria degradada e
 * honesta por auditoria nenhuma.
 */
export async function transcreverPaginasMudas(
  diagnostico: DiagnosticoDoArquivo,
  opcoes: OpcoesDeTranscricao = {},
): Promise<PaginaTranscrita[]> {
  const { file, mudas, checksum } = diagnostico;
  if (mudas.length === 0) return [];

  const chave = (pagina: number) => `${checksum}:${pagina}:${VERSAO_DO_TRANSCRITOR}`;

  /*
   * O CACHE FALHAR NÃO É ERRO. Sem `crypto.subtle` (contexto inseguro) ou com o
   * IndexedDB bloqueado, tudo vira inédito e paga-se o que sempre se pagou. Um
   * cache que derruba a leitura é pior que cache nenhum — é a mesma regra do
   * cache de selo.
   */
  let guardadas = new Map<string, { texto: string }>();
  try {
    guardadas = await getTranscricaoCache(mudas.map(chave));
  } catch {
    guardadas = new Map();
  }

  const resultados: PaginaTranscrita[] = [];
  const pendentes = mudas.filter((n) => {
    const guardada = guardadas.get(chave(n));
    if (guardada) {
      resultados.push({ pagina: n, texto: guardada.texto });
      return false;
    }
    return true;
  });

  let prontas = resultados.length;
  opcoes.onProgresso?.({ prontas, total: mudas.length });

  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  try {
    const fila = [...pendentes];
    await Promise.all(
      Array.from({ length: Math.min(SIMULTANEAS, fila.length) }, async () => {
        for (;;) {
          const n = fila.shift();
          if (n === undefined || opcoes.signal?.aborted) return;

          try {
            const page = await doc.getPage(n);
            const imagem = await renderizarPagina(page as never);
            const texto = await postTranscricao(imagem, n, opcoes);
            if (texto) {
              resultados.push({ pagina: n, texto });
              try {
                await putTranscricaoCache({
                  key: chave(n),
                  fileName: file.name,
                  pagina: n,
                  texto,
                  savedAt: Date.now(),
                });
              } catch {
                // Guardar é otimização; não guardar só custa a próxima corrida.
              }
            }
          } catch (err) {
            console.warn(`[pagina-muda] página ${n} não transcreveu`, err);
          }

          prontas += 1;
          opcoes.onProgresso?.({ prontas, total: mudas.length });
        }
      }),
    );
  } finally {
    await doc.destroy();
  }

  return resultados.sort((a, b) => a.pagina - b.pagina);
}

type PaginaRenderizavel = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>;
    _internalRenderTask?: { _useRequestAnimationFrame?: boolean };
  };
};

/** A folha inteira, como PNG data URL. */
async function renderizarPagina(page: PaginaRenderizavel): Promise<string> {
  const viewport = page.getViewport({ scale: ESCALA_DO_RENDER });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível.");

  /*
   * O FUNDO BRANCO É EXPLÍCITO. Canvas nasce transparente, e o pdf.js não pinta
   * o papel — só o conteúdo. Transparente vira PRETO ao virar PNG opaco, e a
   * folha chega ao modelo como texto preto sobre fundo preto.
   */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sem rAF: o Chrome não roda `requestAnimationFrame` em aba de segundo plano,
  // e sem isto a transcrição congela calada quando o engenheiro troca de aba.
  await semRequestAnimationFrame(page.render({ canvasContext: ctx, viewport })).promise;

  /*
   * PNG, e não JPEG. O selo é recortado em JPEG porque ali o que importa é a
   * forma do carimbo; aqui é a página inteira de PROSA em corpo 10, e o
   * artefato de compressão do JPEG ataca exatamente a borda da letra pequena —
   * onde o 8 vira 3.
   */
  return canvas.toDataURL("image/png");
}

async function postTranscricao(
  imagemDataUrl: string,
  pagina: number,
  opcoes: OpcoesDeTranscricao,
): Promise<string> {
  const res = await fetch("/api/audit/transcrever-pagina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imagemDataUrl,
      pagina,
      ...(opcoes.conversationId ? { conversationId: opcoes.conversationId } : {}),
    }),
    signal: opcoes.signal,
  });

  const dados = (await res.json()) as { texto?: string; error?: string };
  if (!res.ok) throw new Error(dados.error ?? `HTTP ${res.status}`);
  return typeof dados.texto === "string" ? dados.texto : "";
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
