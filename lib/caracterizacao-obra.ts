/**
 * A CARACTERIZAÇÃO DA OBRA do memorial — endereço, bairro, município e áreas.
 *
 * Todo memorial do escritório abre com a seção "1.1 Caracterização da obra", e
 * é ali que mora o endereço do empreendimento. Até agora a classificação lia
 * obra, órgão e município, mas não o endereço — e endereço é o dado que decide
 * a pergunta mais cara desta auditoria: *este memorial é desta obra mesmo?*
 * Nome de obra se repete entre projetos de um mesmo programa (várias "UBS
 * Santo Antônio"); endereço não.
 *
 * DETERMINÍSTICO, sem IA: a seção tem âncoras estáveis nos dois modelos de
 * memorial que o escritório usa. Custa zero por documento — e o que é objetivo
 * não deve depender de modelo, que é a regra que rege este produto inteiro.
 *
 * PURO e sem imports: roda no node cru.
 */

export interface CaracterizacaoDaObra {
  /** O endereço como está escrito, sem reordenar nem inventar formato. */
  endereco: string;
  bairro: string;
  municipio: string;
  /** Sigla do estado quando declarada ("SC"). */
  uf: string;
  /** Área construída, como escrita ("1.295,37 m²"). */
  areaConstruida: string;
  /** Área total do terreno, como escrita. */
  areaTerreno: string;
  /** O parágrafo inteiro da caracterização — contexto para quem for conferir. */
  trecho: string;
}

const VAZIO: CaracterizacaoDaObra = {
  endereco: "",
  bairro: "",
  municipio: "",
  uf: "",
  areaConstruida: "",
  areaTerreno: "",
  trecho: "",
};

/** Limpa espaço repetido e o hífen de quebra de linha que o PDF deixa. */
function normalizar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * O trecho da caracterização: do título da seção até o próximo subtítulo.
 *
 * Ancoramos no TÍTULO e não numa página fixa: a seção cai na página 11 num
 * memorial e na 12 noutro, e vai mudar de lugar no próximo. O sumário também
 * contém a expressão, então exigimos que NÃO seja seguida da linha pontilhada
 * de sumário ("....... 12").
 */
export function trechoDaCaracterizacao(texto: string): string {
  const t = normalizar(texto);
  const re = /Caracteriza[çc][ãa]o\s+da\s+obra\s*(?!\.{3,}|\s*\.{2,}\s*\d)/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(t)) !== null) {
    const inicio = match.index + match[0].length;
    const resto = t.slice(inicio);
    // O fim é o próximo subtítulo numerado ("1.2 ...") ou o rodapé do capítulo.
    const fim = resto.search(/\b1\s*\.\s*2\b|Quadro\s+de\s+[áa]reas|Plantas\s+e\s+desenhos/i);
    const bloco = (fim > 0 ? resto.slice(0, fim) : resto).trim();
    /*
     * O corte por tamanho é só a segunda linha de defesa — quem separa a seção
     * da entrada de sumário é o lookahead da linha pontilhada, acima. O limite
     * era 120 e descartava caracterização curta de verdade ("Obra: UBS
     * localizada na Rua X, Bairro Y, em Criciúma, SC." tem 102), que é
     * justamente o modelo mais comum das UBS.
     */
    if (bloco.length > 50) return bloco;
  }
  return "";
}

/**
 * O endereço declarado. Os dois modelos do escritório dizem "localizado
 * na/no/em" — mas um continua com "no município de X" e o outro fecha com
 * "Cidade-UF". Cobrimos os dois sem tentar normalizar o resultado: endereço
 * reescrito deixa de servir para conferir contra a prancha.
 */
function extrairEndereco(trecho: string): string {
  const m =
    /\blocaliza(?:do|da)\s+(?:na|no|em|à|a)\s+([^.;]{6,220})/i.exec(trecho) ??
    /\bsituad(?:o|a)\s+(?:na|no|em|à|a)\s+([^.;]{6,220})/i.exec(trecho) ??
    /\bendere[çc]o\s*:\s*([^.;\n]{6,220})/i.exec(trecho);
  return m ? normalizar(m[1]) : "";
}

function extrairBairro(trecho: string): string {
  const m = /\bbairro\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^,.;]{2,40})/i.exec(trecho);
  return m ? normalizar(m[1]) : "";
}

/**
 * "no município de Chapecó, Santa Catarina", "em Criciúma, SC", "Criciúma-SC".
 *
 * A forma com SIGLA vem primeiro porque é a menos ambígua. A forma por extenso
 * é a que dá trabalho: "de Criciúma em Santa Catarina" fazia a captura engolir
 * o " em Santa Catarina" e devolver a frase inteira como nome de cidade — daí
 * o corte explícito nas preposições.
 */
function extrairMunicipioUf(trecho: string): { municipio: string; uf: string } {
  const sigla =
    /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]{2,30}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]{2,20}){0,2})\s*[-/,]\s*([A-Z]{2})\b/.exec(
      trecho,
    );
  if (sigla) return { municipio: normalizar(sigla[1]), uf: sigla[2] };

  const porExtenso =
    /munic[ií]pio\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]{2,30}(?:\s+(?!em\b|no\b|na\b|de\b|do\b|da\b)[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]{2,20}){0,3})/i.exec(
      trecho,
    );
  if (porExtenso) {
    const municipio = normalizar(porExtenso[1]);
    // O estado, quando vem logo depois separado por vírgula.
    const depois = trecho.slice(porExtenso.index + porExtenso[0].length);
    const estado = /^\s*,\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,25}?)\s*[.,;]/.exec(
      depois,
    );
    return { municipio, uf: estado ? normalizar(estado[1]) : "" };
  }
  return { municipio: "", uf: "" };
}

/** Áreas como escritas — "1.295,37 m²". Nunca convertidas. */
function extrairAreas(trecho: string): { areaConstruida: string; areaTerreno: string } {
  const construida =
    /([\d.]+,\d{2}|\d[\d.]*)\s*m²?\s*(?:de\s+)?[áa]rea\s+constru[íi]da/i.exec(trecho) ??
    /[áa]rea\s+constru[íi]da[^\d]{0,20}([\d.]+,\d{2}|\d[\d.]*)\s*m²?/i.exec(trecho);
  const terreno =
    /[áa]rea\s+total[^\d]{0,20}(?:de\s+)?([\d.]+,\d{2}|\d[\d.]*)\s*m²?/i.exec(trecho) ??
    /([\d.]+,\d{2}|\d[\d.]*)\s*m²?\s*(?:de\s+)?[áa]rea\s+total/i.exec(trecho);
  return {
    areaConstruida: construida ? `${construida[1]} m²` : "",
    areaTerreno: terreno ? `${terreno[1]} m²` : "",
  };
}

/**
 * Lê a caracterização da obra do texto do memorial. Devolve campos vazios
 * quando não encontra — nunca chuta, porque um endereço inventado seria pior
 * que endereço nenhum: ele viraria gabarito e reprovaria a obra certa.
 */
export function lerCaracterizacaoDaObra(texto: string): CaracterizacaoDaObra {
  const trecho = trechoDaCaracterizacao(texto);
  if (!trecho) return VAZIO;

  const { municipio, uf } = extrairMunicipioUf(trecho);
  const { areaConstruida, areaTerreno } = extrairAreas(trecho);

  return {
    endereco: extrairEndereco(trecho),
    bairro: extrairBairro(trecho),
    municipio,
    uf,
    areaConstruida,
    areaTerreno,
    // O parágrafo inteiro é caro demais para a tela; o começo basta para
    // reconhecer, e quem quiser o resto abre o documento.
    trecho: trecho.length > 600 ? `${trecho.slice(0, 600).trim()}…` : trecho,
  };
}
