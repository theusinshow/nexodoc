/**
 * SUBSTITUIÇÃO DE MARCADORES no corpo do modelo ODT.
 *
 * Puro (nenhum import), para rodar em `node scripts/test-nexo-odt-marcadores.ts`.
 * Morava em `server/odt/index.ts`, que importa por alias `@/` e por isso nunca
 * pôde ser testado — e é o código que já produziu a obra duplicada na capa e a
 * linha em branco entre a obra e o bairro.
 *
 * O escape do XML entra INJETADO pela mesma razão: ele vive em
 * `@/lib/cover-utils`, que o node cru não resolve.
 */

/** Há texto de verdade aqui, fora das tags? */
function temTextoVisivel(xml: string): boolean {
  return xml.replace(/<[^>]*>/g, "").trim().length > 0;
}

/**
 * Remove o `<text:p>` que envolvia um marcador sem conteúdo, devolvendo o XML
 * já emendado — ou `null` quando não dá para colapsar com segurança.
 *
 * Recusa colapsar se sobrou texto visível dentro do parágrafo (o marcador
 * dividia espaço com texto fixo) ou se as tags não fecham como esperado.
 * Recusar é sempre seguro: cai no comportamento de deixar o parágrafo vazio.
 */
function colapsarParagrafoDoMarcador(
  antes: string,
  depois: string,
): string | null {
  const FECHA = "</text:p>";
  const abre = antes.lastIndexOf("<text:p");
  const fecha = depois.indexOf(FECHA);
  if (abre < 0 || fecha < 0) return null;

  // O parágrafo tem de ser aberto DEPOIS do último fechamento: senão o que
  // achamos é um ancestral, e apagá-lo levaria junto conteúdo alheio.
  if (antes.lastIndexOf(FECHA) > abre) return null;

  if (temTextoVisivel(antes.slice(abre)) || temTextoVisivel(depois.slice(0, fecha))) {
    return null;
  }
  return antes.slice(0, abre) + depois.slice(fecha + FECHA.length);
}

/**
 * O MARCADOR REPETIDO DIVIDE O VALOR EM LINHAS.
 *
 * Um campo que sai em várias linhas — o nome da obra, o título com as
 * disciplinas — pode aparecer mais de uma vez no modelo, cada ocorrência num
 * parágrafo seu. É assim que o padrão da empresa desenha a capa: a 1ª linha do
 * nome da obra num parágrafo, a 2ª no seguinte, o bairro logo abaixo.
 *
 * Cada ocorrência recebe a sua linha; a ÚLTIMA recebe o que sobrar, para nada
 * se perder quando o texto tem mais linhas do que o modelo previu. A ocorrência
 * que não recebe nada SOME COM O PARÁGRAFO — deixá-lo vazio abriria uma linha
 * em branco entre a obra e o bairro, e a regra da capa é que o bairro venha
 * logo abaixo do nome.
 *
 * Só colapsa o parágrafo que existia SÓ para aquele marcador. Um parágrafo com
 * texto fixo em volta ("VOLUME {{VOLUME}} – {{TITULO_CAPA}}") fica onde está, e
 * os espaçadores que o modelo desenha de propósito não são tocados — eles não
 * têm marcador nenhum.
 *
 * Com UMA ocorrência, o valor inteiro entra (as quebras viram
 * `<text:line-break/>` dentro do `escapar` que o chamador injeta).
 */
export function distribuirNosMarcadores(
  bloco: string,
  marcador: string,
  valor: string,
  escapar: (valor: string) => string,
): string {
  const partes = bloco.split(marcador);
  const quantos = partes.length - 1;
  if (quantos <= 0) return bloco;

  const linhas = valor
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const conteudoDe = (i: number) =>
    quantos === 1
      ? valor
      : i === quantos - 1
        ? linhas.slice(i).join("\n")
        : (linhas[i] ?? "");

  let saida = partes[0];
  for (let i = 0; i < quantos; i++) {
    const conteudo = conteudoDe(i);
    const resto = partes[i + 1];

    if (!conteudo.trim()) {
      const semParagrafo = colapsarParagrafoDoMarcador(saida, resto);
      if (semParagrafo !== null) {
        saida = semParagrafo;
        continue;
      }
    }
    saida += escapar(conteudo) + resto;
  }
  return saida;
}
