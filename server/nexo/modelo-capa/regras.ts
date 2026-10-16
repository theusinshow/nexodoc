/**
 * A LEITURA DETERMINÍSTICA da capa anexada: o que tem forma conhecida não vai
 * para a IA. Código, data, tomo, volume, fase, órgão e secretaria têm forma; a
 * obra e o bairro se reconhecem pela identidade do projeto. O resto fica `null`
 * e sobe para a IA — e só ele.
 *
 * PURO: nenhum import de runtime.
 */
import type {
  CampoDaCapa,
  ContextoDasRegras,
  FormatoDoTomo,
  FormatoDoVolume,
  ParagrafoClassificado,
  ParagrafoDaCapa,
  PropostaDeModelo,
  Trecho,
} from "./tipos.ts";

const MESES =
  "JANEIRO|FEVEREIRO|MARÇO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO";

function norm(v: string): string {
  return v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const inteiro = (campo: CampoDaCapa | "FIXO", texto: string): Trecho[] => [{ texto, campo }];

interface Achado {
  trechos: Trecho[];
  tomoFormat?: FormatoDoTomo;
  volumeFormat?: FormatoDoVolume;
}

function formatoDoTomo(texto: string): FormatoDoTomo {
  const parenteses = texto.trim().startsWith("(");
  const numero = /\d+/.exec(texto)?.[0] ?? "";
  const comZero = numero.length >= 2 && numero.startsWith("0");
  if (parenteses) return comZero ? "parenthesized-padded" : "parenthesized";
  return comZero ? "plain-padded" : "plain";
}

const formatoDoVolume = (valor: string): FormatoDoVolume =>
  /^\d+$/.test(valor) ? "numeric" : "roman";

/** Uma regra por forma. A primeira que casa decide o parágrafo. */
function porForma(texto: string, ctx: ContextoDasRegras): Achado | null {
  const t = texto.trim();

  if (/^\d{3}[-_]\d{2}$/.test(t)) return { trechos: inteiro("CODIGO_EXIBIDO", t) };

  if (
    new RegExp(`^(${MESES})\\s*(DE\\s+)?[/ -]?\\s*\\d{4}$`, "i").test(t) ||
    /^\d{2}\/\d{4}$/.test(t)
  ) {
    return { trechos: inteiro("MES_ANO", t) };
  }

  if (/^\(?\s*TOMO\s+\d+\s*\)?$/i.test(t)) {
    return { trechos: inteiro("TOMO", t), tomoFormat: formatoDoTomo(t) };
  }

  // "Vol. VII", "VOLUME 05" — o rótulo fica fixo, o valor vira campo.
  const vol = /^(VOL(?:UME)?\.?\s*)([IVXLC]+|\d+)$/i.exec(t);
  if (vol) {
    return {
      trechos: [
        { texto: vol[1], campo: "FIXO" },
        { texto: vol[2], campo: "VOLUME" },
      ],
      volumeFormat: formatoDoVolume(vol[2]),
    };
  }

  // "VOLUME 05 – PROJETO ESTRUTURAL" (Criciúma): rótulo, volume, separador, título.
  const volTitulo = /^(VOL(?:UME)?\.?\s*)([IVXLC]+|\d+)(\s*[–-]\s*)(.+)$/i.exec(t);
  if (volTitulo) {
    return {
      trechos: [
        { texto: volTitulo[1], campo: "FIXO" },
        { texto: volTitulo[2], campo: "VOLUME" },
        { texto: volTitulo[3], campo: "FIXO" },
        { texto: volTitulo[4], campo: "TITULO_CAPA" },
      ],
      volumeFormat: formatoDoVolume(volTitulo[2]),
    };
  }

  if (/^PROJETO\s+(EXECUTIVO|B[ÁA]SICO|LEGAL|PRELIMINAR)$/i.test(t)) {
    return { trechos: inteiro("FASE", t) };
  }

  /*
   * ÓRGÃO E SECRETARIA FICAM FIXOS. O modelo é de UM projeto, e o órgão não
   * muda dentro dele. Como campo, o valor viria do carimbo ou do default — e o
   * teste de ida e volta pegou o estrago: Florianópolis e São José têm a
   * secretaria escrita no modelo, o default dela é vazio, e a linha SUMIA da
   * capa. Reconhecidos aqui só para não irem à IA; quem quiser campo troca no
   * card.
   */
  const n = norm(t);
  if (ctx.orgaos.some((o) => o && norm(o) === n) || /^prefeitura municipal de /.test(n)) {
    return { trechos: inteiro("FIXO", t) };
  }
  if (
    ctx.secretarias.some((s) => s && norm(s) === n) ||
    /^secretaria (municipal )?de /.test(n)
  ) {
    return { trechos: inteiro("FIXO", t) };
  }

  if (ctx.bairro && n.length >= 4 && norm(ctx.bairro) === n) {
    return { trechos: inteiro("BAIRRO", t) };
  }

  // A obra quebra em linhas: cada linha é um PEDAÇO contíguo da obra do projeto.
  if (ctx.obra && n.length >= 8 && norm(ctx.obra).includes(n)) {
    return { trechos: inteiro("NOME_OBRA", t) };
  }

  return null;
}

export function classificarPorRegras(
  paragrafos: readonly ParagrafoDaCapa[],
  ctx: ContextoDasRegras,
): PropostaDeModelo {
  let tomoFormat: FormatoDoTomo | null = null;
  let volumeFormat: FormatoDoVolume | null = null;
  const saida: ParagrafoClassificado[] = paragrafos.map((p) => {
    const achado = porForma(p.texto, ctx);
    if (!achado) return { ...p, trechos: null, origem: null };
    if (achado.tomoFormat) tomoFormat ??= achado.tomoFormat;
    if (achado.volumeFormat) volumeFormat ??= achado.volumeFormat;
    return { ...p, trechos: achado.trechos, origem: "regra" };
  });
  return { paragrafos: saida, tomoFormat, volumeFormat };
}

/** Os que ninguém classificou — é isso, e só isso, que vai para a IA. */
export function pendentes(proposta: PropostaDeModelo): ParagrafoClassificado[] {
  return proposta.paragrafos.filter((p) => p.trechos === null);
}

/**
 * Aplica respostas por parágrafo inteiro (IA ou pessoa). Resposta para índice
 * que não existe é ignorada: o índice alucinado não pode marcar outra linha.
 * A IA só preenche o que está pendente; a pessoa pode trocar qualquer um.
 */
export function aplicarRespostas(
  proposta: PropostaDeModelo,
  respostas: readonly { indice: number; campo: CampoDaCapa | "FIXO" }[],
  origem: "ia" | "pessoa",
): PropostaDeModelo {
  const porIndice = new Map(respostas.map((r) => [r.indice, r.campo]));
  return {
    ...proposta,
    paragrafos: proposta.paragrafos.map((p) => {
      const campo = porIndice.get(p.indice);
      if (campo === undefined) return p;
      if (origem === "ia" && p.trechos !== null) return p;
      return { ...p, trechos: [{ texto: p.texto, campo }], origem };
    }),
  };
}
