/**
 * INJETA OS MARCADORES na capa anexada: cada parágrafo classificado tem o seu
 * texto trocado pelos trechos — o fixo escapado, o campo como `{{CAMPO}}`. O
 * estilo do parágrafo fica; o do PRIMEIRO span também (é ele que costuma
 * carregar fonte e corpo). Parágrafo todo FIXO, ou sem classificação, fica
 * intacto, byte a byte.
 *
 * PURO: nenhum import de runtime.
 */
import { PARAGRAFO_RE, corpoDoTexto, inicioDoCorpo } from "./paragrafos.ts";
import type { PropostaDeModelo, Trecho } from "./tipos.ts";

function escapar(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function miolo(trechos: readonly Trecho[]): string {
  return trechos
    .map((t) => (t.campo === "FIXO" ? escapar(t.texto) : `{{${t.campo}}}`))
    .join("");
}

function reescrever(bruto: string, trechos: readonly Trecho[]): string {
  const abre = /^<text:(p|h)\b[^>]*>/.exec(bruto);
  if (!abre) return bruto;
  const tag = abre[1];
  const abertura = abre[0].endsWith("/>") ? abre[0].replace(/\s*\/>$/, ">") : abre[0];
  const span = /<text:span\b[^>]*text:style-name="([^"]+)"[^>]*>/.exec(bruto)?.[1];
  const dentro = span
    ? `<text:span text:style-name="${span}">${miolo(trechos)}</text:span>`
    : miolo(trechos);
  return `${abertura}${dentro}</text:${tag}>`;
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
