/**
 * A ESTRUTURA DE IMPRESSÃO do modelo ODT.
 *
 * Devolve, na ordem em que saem, os parágrafos do corpo: os marcadores que cada
 * um contém, o texto fixo em volta, o alinhamento e o corpo da fonte. É a
 * leitura que foi feita à mão para diagnosticar a obra duplicada e o `{{TOMO}}`
 * partido em spans — vira código porque o frame do documento passa a ser
 * desenhado a partir dela.
 *
 * O leitor tira as tags de DENTRO do parágrafo antes de procurar marcador. Sem
 * isso, um marcador que o LibreOffice partiu em `<text:span>` passaria
 * despercebido — que é exatamente como `{{(TOMO)}}` chegou à produção sem que
 * nada acusasse.
 *
 * PURO: nenhum import. Roda em `node scripts/test-nexo-odt-layout.ts`.
 */

export type ParteDoParagrafo =
  | { tipo: "texto"; valor: string }
  | { tipo: "marcador"; nome: string }
  | { tipo: "quebrado"; bruto: string };

export interface ParagrafoDoModelo {
  /** Ordem de impressão. */
  indice: number;
  alinhamento: "start" | "center" | "end";
  /** Corpo da fonte em pt, quando o estilo o declara. */
  corpo?: number;
  partes: ParteDoParagrafo[];
}

/** Nome de marcador aceito pelo gerador: MAIÚSCULAS, dígitos e `_`. */
const NOME_VALIDO = /^[A-Z_][A-Z0-9_]*$/;

/** Alinhamento e corpo por nome de estilo, de `<office:automatic-styles>`. */
function lerEstilos(xml: string): Map<string, { alinhamento: string; corpo?: number }> {
  const mapa = new Map<string, { alinhamento: string; corpo?: number }>();
  const blocos = xml.match(/<style:style\b[\s\S]*?<\/style:style>/g) ?? [];
  for (const bloco of blocos) {
    const nome = /style:name="([^"]+)"/.exec(bloco)?.[1];
    if (!nome) continue;
    const alinhamento = /fo:text-align="([^"]+)"/.exec(bloco)?.[1] ?? "start";
    const pt = /fo:font-size="([\d.]+)pt"/.exec(bloco)?.[1];
    mapa.set(nome, {
      alinhamento,
      ...(pt ? { corpo: Number(pt) } : {}),
    });
  }
  return mapa;
}

/** "end"/"right" → end; "center" → center; o resto → start. */
function normalizarAlinhamento(bruto: string): "start" | "center" | "end" {
  if (bruto === "center") return "center";
  if (bruto === "end" || bruto === "right") return "end";
  return "start";
}

/**
 * Quebra o texto do parágrafo em texto fixo e marcadores.
 *
 * O que parece marcador mas não tem nome válido sai como `quebrado` — é o único
 * jeito de o frame poder mostrar o problema em vez de desenhar um campo que
 * nunca será preenchido.
 */
function partesDoTexto(texto: string): ParteDoParagrafo[] {
  const partes: ParteDoParagrafo[] = [];
  const re = /\{\{([^{}]*)\}\}/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) {
      partes.push({ tipo: "texto", valor: texto.slice(ultimo, m.index) });
    }
    const nome = m[1];
    partes.push(
      NOME_VALIDO.test(nome)
        ? { tipo: "marcador", nome }
        : { tipo: "quebrado", bruto: m[0] },
    );
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) {
    const resto = texto.slice(ultimo);
    if (resto) partes.push({ tipo: "texto", valor: resto });
  }
  return partes;
}

export function lerLayoutDoModelo(contentXml: string): ParagrafoDoModelo[] {
  const estilos = lerEstilos(contentXml);

  const inicio = contentXml.indexOf("<office:body");
  const corpoXml = inicio >= 0 ? contentXml.slice(inicio) : contentXml;

  /*
   * O AUTO-FECHADO VEM PRIMEIRO, e o de abertura recusa terminar em "/".
   *
   * `<text:p text:style-name="P5"/>` casa com um padrão ingênuo de tag de
   * ABERTURA (`[^>]*` engole o "/"), e aí o espaçador devora tudo até o
   * próximo `</text:p>`: três parágrafos viram um, com o estilo do espaçador.
   * O modelo de Criciúma tem espaçadores logo antes do nome da obra, então o
   * frame sairia com o alinhamento errado e sem as linhas em branco.
   */
  const paragrafos =
    corpoXml.match(
      /<text:p\b[^>]*\/>|<text:p\b[^>]*(?<!\/)>[\s\S]*?<\/text:p>/g,
    ) ?? [];

  return paragrafos.map((bruto, indice) => {
    const nomeDoEstilo = /text:style-name="([^"]+)"/.exec(bruto)?.[1] ?? "";
    const estilo = estilos.get(nomeDoEstilo);
    // As tags de DENTRO saem antes da busca por marcador: é o que enxerga o
    // marcador que o LibreOffice partiu em spans.
    const texto = bruto
      .replace(/^<text:p\b[^>]*>/, "")
      .replace(/<\/text:p>$/, "")
      .replace(/<[^>]*>/g, "");

    return {
      indice,
      alinhamento: normalizarAlinhamento(estilo?.alinhamento ?? "start"),
      ...(estilo?.corpo !== undefined ? { corpo: estilo.corpo } : {}),
      partes: partesDoTexto(texto),
    };
  });
}

/** Os nomes de marcador do modelo, na ordem de impressão e sem repetir. */
export function marcadoresDoLayout(layout: ParagrafoDoModelo[]): string[] {
  const vistos: string[] = [];
  for (const p of layout) {
    for (const parte of p.partes) {
      if (parte.tipo === "marcador" && !vistos.includes(parte.nome)) {
        vistos.push(parte.nome);
      }
    }
  }
  return vistos;
}
