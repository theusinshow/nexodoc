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

/**
 * Repete o bloco do título UMA VEZ POR DISCIPLINA — o volume real tem várias
 * (elétrica, CFTV, SPDA...), cada uma com sua folha de rosto.
 *
 * A quebra de página sai de graça: o parágrafo do título traz
 * `style:master-page-name`, e no ODF atribuir master-page a um parágrafo força
 * quebra NELE. É o mesmo mecanismo que criava a página em branco (ver acima) —
 * aqui ele trabalha a favor. Nada de inserir `fo:break-before` à mão.
 *
 * Repetimos o bloco INTEIRO (a `<text:list>` que hospeda o título, quando
 * existe) e não só o parágrafo, para cada folha nascer com a mesma estrutura
 * que o LibreOffice gravou no template. Como `xml:id` tem de ser único no
 * documento, as cópias ganham sufixo.
 *
 * Recebe os títulos JÁ ESCAPADOS para XML: este módulo não tem imports (roda no
 * node cru do teste), e a única implementação de escape vive no chamador.
 */
export function repetirBlocoDoTitulo(
  content: string,
  titulosEscapados: string[],
): string {
  if (titulosEscapados.length <= 1) {
    return titulosEscapados.length === 1
      ? content.replaceAll("{{TITULO}}", titulosEscapados[0])
      : content;
  }

  const marcador = content.indexOf("{{TITULO}}");
  if (marcador === -1) return content;

  const bloco = limitesDoBloco(content, marcador);
  if (!bloco) return content;

  const modelo = content.slice(bloco.inicio, bloco.fim);
  const copias = titulosEscapados
    .map((titulo, i) => comIdUnico(modelo, i).replaceAll("{{TITULO}}", titulo))
    .join("");

  return content.slice(0, bloco.inicio) + copias + content.slice(bloco.fim);
}

/**
 * Onde começa e termina o bloco que hospeda o título. Preferimos a `<text:list>`
 * que o envolve; se o template mudar de forma e não houver uma, caímos no
 * parágrafo — repetir o parágrafo sozinho ainda dá uma folha por disciplina,
 * porque a quebra mora no estilo dele.
 */
function limitesDoBloco(
  content: string,
  marcador: number,
): { inicio: number; fim: number } | null {
  const FIM_LISTA = "</text:list>";
  const aberturaLista = content.lastIndexOf("<text:list ", marcador);
  const fimLista = content.indexOf(FIM_LISTA, marcador);

  if (aberturaLista !== -1 && fimLista !== -1) {
    // A lista só envolve o marcador se ela não fechou antes dele.
    const fechamentoAnterior = content.lastIndexOf(FIM_LISTA, marcador);
    if (fechamentoAnterior < aberturaLista) {
      return { inicio: aberturaLista, fim: fimLista + FIM_LISTA.length };
    }
  }

  const aberturaP = content.lastIndexOf("<text:p", marcador);
  const fimP = content.indexOf("</text:p>", marcador);
  if (aberturaP === -1 || fimP === -1) return null;
  return { inicio: aberturaP, fim: fimP + "</text:p>".length };
}

/** `xml:id` duplicado é documento inválido; cada cópia leva o seu. */
function comIdUnico(bloco: string, indice: number): string {
  if (indice === 0) return bloco;
  return bloco.replace(/xml:id="([^"]*)"/g, `xml:id="$1_${indice}"`);
}
