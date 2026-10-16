/**
 * INJETA OS MARCADORES na capa anexada: cada parágrafo classificado tem o seu
 * texto trocado pelos trechos — o fixo escapado, o campo como `{{CAMPO}}`. O
 * estilo do parágrafo fica, e CADA TRECHO herda os spans que envolviam o texto
 * dele no original. Parágrafo todo FIXO, ou sem classificação, fica intacto,
 * byte a byte.
 *
 * Por que trecho a trecho (16/10/2026): em Criciúma a linha "VOLUME 05 –
 * TÍTULO" tem um span por pedaço — o número do volume em negrito 14pt, o
 * título noutro estilo. E em Chapecó "PROJETO EXECUTIVO" mora em dois spans
 * aninhados, o de dentro corrigindo a fonte do de fora; guardar só o primeiro
 * span imprimiu a fase em Courier miúdo (prova no navegador).
 *
 * PURO: nenhum import de runtime.
 */
import { PARAGRAFO_RE, corpoDoTexto, decodificar, inicioDoCorpo } from "./paragrafos.ts";
import type { PropostaDeModelo, Trecho } from "./tipos.ts";

function escapar(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Um pedaço de texto visível do parágrafo e os spans abertos em volta dele. */
interface Corrida {
  texto: string;
  spans: string[];
}

/** O miolo do parágrafo em corridas de texto, cada uma com a sua pilha de spans. */
function corridas(miolo: string): Corrida[] {
  const saida: Corrida[] = [];
  const pilha: string[] = [];
  const re = /<\/text:span>|<text:span\b[^>]*?(\/?)>|<text:s\b[^>]*?(?:text:c="(\d+)")?[^>]*\/>|<text:(?:tab|line-break)\b[^>]*\/>|<[^>]+>|[^<]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(miolo)) !== null) {
    const pedaco = m[0];
    if (pedaco === "</text:span>") pilha.pop();
    else if (pedaco.startsWith("<text:span")) {
      if (m[1] !== "/") pilha.push(pedaco);
    } else if (pedaco.startsWith("<text:s")) {
      saida.push({ texto: " ".repeat(Number(m[2] ?? 1)), spans: [...pilha] });
    } else if (pedaco.startsWith("<text:tab") || pedaco.startsWith("<text:line-break")) {
      saida.push({ texto: " ", spans: [...pilha] });
    } else if (!pedaco.startsWith("<")) {
      saida.push({ texto: decodificar(pedaco), spans: [...pilha] });
    }
  }
  return saida;
}

/**
 * A pilha de spans de cada caractere do texto NORMALIZADO (espaços colapsados,
 * pontas aparadas) — o mesmo texto de onde os trechos foram recortados.
 */
function spansPorCaractere(lista: readonly Corrida[]): string[][] {
  const crus: { c: string; spans: string[] }[] = [];
  for (const r of lista) for (const c of r.texto) crus.push({ c, spans: r.spans });
  const saida: string[][] = [];
  let espaco = false;
  for (const { c, spans } of crus) {
    if (/\s/.test(c)) {
      espaco = saida.length > 0;
      continue;
    }
    if (espaco) saida.push(spans);
    espaco = false;
    saida.push(spans);
  }
  return saida;
}

function emSpans(conteudo: string, spans: readonly string[]): string {
  return `${spans.join("")}${conteudo}${"</text:span>".repeat(spans.length)}`;
}

function reescrever(bruto: string, trechos: readonly Trecho[]): string {
  const abre = /^<text:(p|h)\b[^>]*>/.exec(bruto);
  if (!abre) return bruto;
  const tag = abre[1];
  const autoFechado = abre[0].endsWith("/>");
  const abertura = autoFechado ? abre[0].replace(/\s*\/>$/, ">") : abre[0];
  const dentro = autoFechado ? "" : bruto.slice(abre[0].length, bruto.length - `</text:${tag}>`.length);
  const porCaractere = spansPorCaractere(corridas(dentro));

  let posicao = 0;
  const partes = trechos.map((t) => {
    // O trecho herda os spans do PRIMEIRO caractere visível dele no original.
    const deslocamento = t.texto.length - t.texto.trimStart().length;
    const spans = porCaractere[posicao + deslocamento] ?? porCaractere[porCaractere.length - 1] ?? [];
    posicao += t.texto.length;
    return emSpans(t.campo === "FIXO" ? escapar(t.texto) : `{{${t.campo}}}`, spans);
  });
  return `${abertura}${partes.join("")}</text:${tag}>`;
}

export function injetarMarcadores(contentXml: string, proposta: PropostaDeModelo): string {
  const porIndice = new Map(
    proposta.paragrafos
      .filter((p) => p.trechos && p.trechos.some((t) => t.campo !== "FIXO"))
      .map((p) => [p.indice, p.trechos!] as const),
  );
  // A MESMA enumeração da leitura: a partir de <office:body>.
  const inicio = inicioDoCorpo(contentXml);
  const { fim } = corpoDoTexto(contentXml);
  let indice = -1;
  const corpo = contentXml.slice(inicio, fim).replace(PARAGRAFO_RE, (bruto) => {
    indice++;
    const trechos = porIndice.get(indice);
    return trechos ? reescrever(bruto, trechos) : bruto;
  });
  return contentXml.slice(0, inicio) + corpo + contentXml.slice(fim);
}
