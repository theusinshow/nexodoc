/**
 * Ajuste PURO do `content.xml` da separatriz, antes de virar PDF.
 *
 * O template oficial (`templates/separatriz/modelo-separatriz.odt`) abre com um
 * parágrafo VAZIO e só depois traz o do título. O parágrafo do título declara
 * `style:master-page-name="Folha_Separatriz"`, e no ODF atribuir um master-page
 * a um parágrafo FORÇA quebra de página nele — então o parágrafo vazio ganhava
 * uma PÁGINA EM BRANCO inteira só para si. No volume montado isso aparecia como
 * uma folha branca logo depois da capa.
 *
 * Corrigimos no conteúdo, não no arquivo: o `.odt` é asset oficial do escritório
 * e pode ser reexportado a qualquer momento pelo LibreOffice, o que desfaria uma
 * edição binária silenciosamente. Aqui a correção fica visível e testada.
 *
 * SEM IMPORTS (nem alias `@/`): roda no node cru do `test:nexo:parts`.
 */

/** Um `<text:p …/>` ou `<text:p …></text:p>` sem nada dentro. */
const PARAGRAFO_VAZIO = /<text:p\b[^>]*\/>|<text:p\b[^>]*>\s*<\/text:p>/g;

/**
 * Remove os parágrafos VAZIOS que antecedem o marcador `{{TITULO}}`. Parágrafos
 * com qualquer conteúdo são preservados — só o que não imprime nada sai —, e o
 * que vem depois do título não é tocado.
 *
 * Sem o marcador no XML, devolve a entrada intacta: não é papel desta função
 * decidir o que fazer com um template fora do formato esperado.
 */
export function removerVaziosAntesDoTitulo(content: string): string {
  const marcador = content.indexOf("{{TITULO}}");
  if (marcador === -1) return content;

  // Fronteira: o parágrafo do título começa antes do marcador. Tudo que
  // interessa está entre a abertura do corpo e essa abertura de parágrafo.
  const aberturaDoTitulo = content.lastIndexOf("<text:p", marcador);
  if (aberturaDoTitulo === -1) return content;

  const antes = content.slice(0, aberturaDoTitulo);
  const resto = content.slice(aberturaDoTitulo);
  return antes.replace(PARAGRAFO_VAZIO, "") + resto;
}
