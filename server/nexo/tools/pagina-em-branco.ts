import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFStream, decodePDFRawStream } from "pdf-lib";

/**
 * A FOLHA EM BRANCO DEPOIS DA CAPA (15/10/2026).
 *
 * O modelo da capa é uma tabela, e o Writer exige um parágrafo depois de uma
 * tabela no fim do documento. Quando a tabela enche a folha — obra de quatro
 * linhas e dois títulos, no 138-26 de Chapecó —, esse parágrafo vazio cai numa
 * página nova, e o PDF sai com uma segunda folha totalmente em branco. O
 * volume copiava a capa inteira, e a folha em branco ia junto para a prefeitura.
 *
 * A página em branco do LibreOffice só tem o recorte da área (`re W* n`): nenhum
 * texto, imagem ou traço pintado. É isso que se procura — um operador que PINTE
 * alguma coisa. Na dúvida a página fica: tirar uma folha com conteúdo seria
 * pior do que deixar uma em branco.
 */

/** Operadores que deixam marca na página: texto, imagem/XObject, preenchimento, traço, sombreamento. */
const PINTA = /(?:^|[\s\]>)])(?:Tj|TJ|'|"|Do|f\*?|F|B\*?|b\*?|S|s|sh|BI)(?=[\s[<(/]|$)/m;

/** O fluxo de conteúdo desenha alguma coisa? */
export function conteudoPinta(conteudo: string): boolean {
  return PINTA.test(conteudo);
}

function conteudoDaPagina(doc: PDFDocument, indice: number): string | null {
  const pagina = doc.getPage(indice);
  const bruto = pagina.node.Contents();
  if (!bruto) return "";
  const fluxos = bruto instanceof PDFArray ? bruto.asArray().map((r) => doc.context.lookup(r)) : [bruto];
  let texto = "";
  for (const fluxo of fluxos) {
    if (fluxo instanceof PDFRawStream) {
      texto += Buffer.from(decodePDFRawStream(fluxo).decode()).toString("latin1");
    } else if (fluxo instanceof PDFStream) {
      texto += Buffer.from(fluxo.getContents()).toString("latin1");
    } else {
      return null; // formato que não sei ler: não decido
    }
    texto += "\n";
  }
  return texto;
}

/** A página não desenha nada (e não tem anotação que desenhe por ela). */
export function paginaEmBranco(doc: PDFDocument, indice: number): boolean {
  try {
    if (doc.getPage(indice).node.lookup(PDFName.of("Annots"))) return false;
    const conteudo = conteudoDaPagina(doc, indice);
    return conteudo !== null && !conteudoPinta(conteudo);
  } catch {
    return false;
  }
}

/**
 * O PDF sem as páginas em branco. Devolve o MESMO buffer quando não há nada a
 * tirar — e também quando TODAS seriam tiradas: aí o defeito é outro, e um PDF
 * sem página nenhuma quebraria a montagem em vez de mostrar o problema.
 */
export async function semPaginasEmBranco(buffer: Buffer): Promise<{ buffer: Buffer; removidas: number }> {
  const doc = await PDFDocument.load(buffer);
  const total = doc.getPageCount();
  const brancas: number[] = [];
  for (let i = 0; i < total; i++) if (paginaEmBranco(doc, i)) brancas.push(i);
  if (brancas.length === 0 || brancas.length === total) return { buffer, removidas: 0 };
  for (const i of [...brancas].reverse()) doc.removePage(i);
  return { buffer: Buffer.from(await doc.save()), removidas: brancas.length };
}
