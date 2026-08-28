/**
 * O PARECER DESENHADO — a única parte que fala PDF.
 *
 * A estrutura, a quebra de linha e a paginação moram em `lib/parecer-em-papel.ts`
 * e são provadas sem gerar arquivo nenhum. Aqui só se traduz estilo em fonte e
 * bloco em tinta.
 *
 * POR QUE `pdf-lib` E NÃO O CAMINHO ODT -> LibreOffice
 *
 * O `render-service` existe para converter um ODT que veio de um MODELO — capa,
 * LD e separatriz têm .odt de referência, com marcadores. O parecer não tem
 * modelo, e criar um seria empurrar a identidade da peça para dentro de um
 * binário que ninguém revisa em diff. `pdf-lib` já é dependência do projeto (o
 * separador de volume desenha assim desde sempre) e mantém o desenho em código
 * legível — que é onde as decisões deste produto moram.
 *
 * AS FONTES SÃO AS 14 PADRÃO, e isso é escolha, não desistência: embutir a IBM
 * Plex exigiria o arquivo da fonte no repositório mais o `fontkit`, e o que a
 * identidade pede aqui é a HIERARQUIA — texto proporcional, dado monoespaçado —,
 * que Helvetica e Courier entregam. O dia em que a Plex entrar no repositório,
 * só este arquivo muda.
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { AuditReport } from "@/lib/audit-report";
import {
  ALTURA,
  blocosDoParecer,
  paginarParecer,
  rodapeDaPagina,
  type EstiloDoBloco,
/*
 * RELATIVO, e com extensão: este é o único import de VALOR deste arquivo, e é
 * ele que decide se a geração dá para provar em node cru. O `@/` do Next não
 * resolve fora do bundler; o `import type` acima some na compilação e por isso
 * pode continuar com o alias. Mesmo arranjo de `lib/audit-report.ts`.
 */
} from "../../lib/parecer-em-papel.ts";

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = { esquerda: 56, direita: 56, topo: 64, base: 64 };
const LARGURA_UTIL = A4.largura - MARGEM.esquerda - MARGEM.direita;
const ALTURA_UTIL = A4.altura - MARGEM.topo - MARGEM.base;

/** Preto sobre branco. O papel não herda o tema escuro do produto — ele é papel. */
const TINTA = rgb(0.09, 0.1, 0.11);
const TINTA_FRACA = rgb(0.45, 0.47, 0.49);
const FIO = rgb(0.78, 0.8, 0.81);

interface Estilo {
  fonte: "sans" | "sansBold" | "mono" | "monoBold";
  corpo: number;
  fraca?: boolean;
}

const ESTILOS: Record<EstiloDoBloco, Estilo> = {
  titulo: { fonte: "sansBold", corpo: 19 },
  secao: { fonte: "monoBold", corpo: 9 },
  rotulo: { fonte: "mono", corpo: 7.5, fraca: true },
  texto: { fonte: "sans", corpo: 10 },
  dado: { fonte: "mono", corpo: 9 },
  achado: { fonte: "monoBold", corpo: 10 },
  regua: { fonte: "sans", corpo: 10 },
};

/**
 * O QUE AS 14 FONTES PADRÃO NÃO SABEM ESCREVER.
 *
 * Elas codificam em WinAnsi, e `drawText` LANÇA num caractere fora dela — não
 * desenha um quadradinho, quebra a geração inteira. Acento e "m2" estão na
 * tabela; os sinais de maior-ou-igual, seta e as aspas curvas de alguns
 * memoriais não estão. Um parecer que falha ao exportar porque o documento
 * escreveu ">= 1,20 m" com o sinal tipográfico seria um defeito difícil de
 * entender e trivial de evitar.
 *
 * A troca é por equivalente LEGÍVEL, nunca por vazio: apagar o sinal mudaria o
 * sentido da evidência que o parecer está citando.
 */
const TROCAS: [RegExp, string][] = [
  [/[''‛]/g, "'"],
  [/[""‟]/g, '"'],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/≠/g, "!="],
  [/≈/g, "~"],
  [/[→➡]/g, "->"],
  [/•/g, "-"],
  [/…/g, "..."],
  [/[–‒]/g, "-"],
  [/\u00a0/g, " "],
];

export function paraWinAnsi(texto: string): string {
  let saida = texto;
  for (const [de, para] of TROCAS) saida = saida.replace(de, para);
  /*
   * O que sobrou fora da tabela vira "?" — visível, e portanto reportável, em
   * vez de derrubar a exportação inteira.
   */
  return saida.replace(/[^\u0020-\u00ff\n]/g, "?");
}

interface Tinteiro {
  sans: PDFFont;
  sansBold: PDFFont;
  mono: PDFFont;
  monoBold: PDFFont;
}

/**
 * O CHANFRO, que é a assinatura geométrica do produto no papel.
 *
 * Na tela ele é `clip-path`; aqui são quatro segmentos com dois cantos cortados
 * — superior-esquerdo e inferior-direito, os MESMOS dois de `.nx-cut-*`. Cortar
 * os quatro faria uma forma parecida que não é a do sistema, e é justamente
 * disso que a `DESIGN.md` reclama quando fala em duas geometrias competindo.
 */
function moldura(
  page: PDFPage,
  x: number,
  y: number,
  largura: number,
  altura: number,
) {
  const c = 10;
  const pontos: [number, number][] = [
    [x + c, y + altura],
    [x + largura, y + altura],
    [x + largura, y + c],
    [x + largura - c, y],
    [x, y],
    [x, y + altura - c],
    [x + c, y + altura],
  ];
  for (let i = 0; i < pontos.length - 1; i++) {
    page.drawLine({
      start: { x: pontos[i][0], y: pontos[i][1] },
      end: { x: pontos[i + 1][0], y: pontos[i + 1][1] },
      thickness: 0.75,
      color: FIO,
    });
  }
}

/** Gera o parecer em PDF. Determinístico: mesmo relatório, mesmos bytes. */
export async function gerarParecerPdf(
  report: AuditReport,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const tinta: Tinteiro = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoBold: await doc.embedFont(StandardFonts.CourierBold),
  };

  const medir = (texto: string, estilo: EstiloDoBloco) => {
    const e = ESTILOS[estilo];
    return tinta[e.fonte].widthOfTextAtSize(paraWinAnsi(texto), e.corpo);
  };

  const paginas = paginarParecer(
    blocosDoParecer(report),
    { largura: LARGURA_UTIL, altura: ALTURA_UTIL },
    medir,
  );

  paginas.forEach((pagina, indice) => {
    const page = doc.addPage([A4.largura, A4.altura]);
    let y = A4.altura - MARGEM.topo;

    for (const { bloco, linhas } of pagina.blocos) {
      y -= bloco.respiroAntes ?? 0;

      if (bloco.estilo === "regua") {
        y -= ALTURA.regua / 2;
        page.drawLine({
          start: { x: MARGEM.esquerda, y },
          end: { x: A4.largura - MARGEM.direita, y },
          thickness: 0.75,
          color: FIO,
        });
        y -= ALTURA.regua / 2;
        continue;
      }

      const e = ESTILOS[bloco.estilo];
      for (const linha of linhas) {
        y -= ALTURA[bloco.estilo];
        page.drawText(paraWinAnsi(linha), {
          x: MARGEM.esquerda,
          y,
          size: e.corpo,
          font: tinta[e.fonte],
          color: e.fraca ? TINTA_FRACA : TINTA,
        });
      }
    }

    /*
     * A MOLDURA CHANFRADA SÓ NA CAPA DO PARECER. Repetida em toda página ela
     * viraria borda de formulário — o chanfro é assinatura, e assinatura que se
     * repete a cada folha deixa de ser lida.
     */
    if (indice === 0) {
      moldura(
        page,
        MARGEM.esquerda - 14,
        A4.altura - MARGEM.topo - 74,
        LARGURA_UTIL + 28,
        88,
      );
    }

    const rodape = paraWinAnsi(
      rodapeDaPagina(report, indice + 1, paginas.length),
    );
    page.drawText(rodape, {
      x: MARGEM.esquerda,
      y: MARGEM.base - 28,
      size: 7.5,
      font: tinta.mono,
      color: TINTA_FRACA,
    });
    page.drawLine({
      start: { x: MARGEM.esquerda, y: MARGEM.base - 16 },
      end: { x: A4.largura - MARGEM.direita, y: MARGEM.base - 16 },
      thickness: 0.5,
      color: FIO,
    });
  });

  return doc.save();
}

/** O nome do arquivo, para o `Content-Disposition` e para o download. */
export function nomeDoParecer(report: AuditReport): string {
  const pedaco = (s: string | undefined) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  const partes = [pedaco(report.codigo), pedaco(report.obra)].filter(Boolean);
  return `parecer-${partes.join("-") || "auditoria"}.pdf`;
}
