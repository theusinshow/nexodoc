// Helpers de parsing de carimbos (selos) de escritório. Funções puras de string,
// sem dependências de React/DOM — usados pela rota de leitura de selo
// (`app/api/ld/extract-stamp/route.ts`) e pela montagem da LD
// (`server/nexo/build-ld-proposal.ts`), que precisam limpar o campo CONTEÚDO do
// mesmo jeito: a rota limpa o que o modelo devolveu, a montagem limpa o que
// chega até a coluna DESCRIÇÃO. Duas limpezas diferentes fariam a lista
// discordar da leitura que a originou.

export function normalizeExtractedValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Os rótulos dos campos VIZINHOS do carimbo.
 *
 * Num carimbo linearizado o valor do CONTEÚDO chega com o rótulo da célula do
 * lado grudado atrás — "PLANTA BAIXA IMP: 001" foi para a coluna DESCRIÇÃO de
 * uma LD entregue. É esse rabicho que o corte abaixo tira.
 *
 * `Nº DA FOLHA` vem ANTES de `FOLHA` de propósito: a alternância do regex é
 * ganância-por-posição, e com `FOLHA` na frente o corte deixaria "Nº DA" para
 * trás.
 */
const ROTULOS_VIZINHOS =
  "IMP|DATA|ESCALA|REV|REVIS[ÃA]O|VISTO|DESENHO|N[°º]?\\s*DA\\s*FOLHA|FOLHA|PRANCHA|ARQUIVO|RESPONS[ÁA]VEL|CLIENTE|OBRA|FASE|DISCIPLINA";

/**
 * O rótulo tem de terminar ali: `IMP` é campo do carimbo, `IMPLANTAÇÃO` é o
 * título da prancha.
 *
 * O corte nasceu SEM esta borda, e por isso comia a descrição mais comum que
 * existe numa prancha brasileira: "PLANTA DE IMPLANTAÇÃO" chegava à LD como
 * "PLANTA DE". O mesmo acontecia com REV/REVESTIMENTOS, VISTO/VISTORIA,
 * DESENHO/DESENHOS e OBRA/OBRAS — dez de quinze descrições reais saíam pela
 * metade, e ninguém via, porque o pedaço que sobra ainda parece um título.
 *
 * `\b` não serve: para o JavaScript "Ç" e "Ã" não são caracteres de palavra, e
 * um título como "REVÇ..." casaria a borda. A classe Unicode é a borda de
 * verdade — daí o flag `u`.
 */
const ROTULO_VIZINHO = new RegExp(`\\s+(?:${ROTULOS_VIZINHOS})(?![\\p{L}\\p{N}])`, "giu");

/**
 * O que amarra a palavra à FRASE, e não à grade do carimbo.
 *
 * Rótulo de campo nunca vem depois de preposição nem de travessão: na ordem de
 * leitura do carimbo, o valor da célula anterior termina antes dele. Quando a
 * palavra aparece nesse contexto, ela é texto do projetista — "SITUAÇÃO E
 * LOCAÇÃO DA OBRA" e "PLANTA DE FORMAS - FOLHA 02" são títulos inteiros, não
 * títulos com um campo vizinho pendurado.
 */
const LIGACAO_ANTES =
  /(?:^|[\s(])(?:d[aeo]s?|n[aeo]s?|em|e|com|sem|sob|sobre|para|por|entre|à|às|ao|aos|a|as|o|os)$|[-–—,;/]\s*$/i;

/** Corta no primeiro rótulo vizinho de verdade — ignorando os que são frase. */
function cortarNoRotuloVizinho(texto: string): string {
  ROTULO_VIZINHO.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ROTULO_VIZINHO.exec(texto)) !== null) {
    const antes = texto.slice(0, match.index);
    if (LIGACAO_ANTES.test(antes)) continue;
    return antes;
  }

  return texto;
}

/**
 * A LINHA QUE É O RÓTULO, e não a que COMEÇA com a palavra dele.
 *
 * O descarte existe para quando a linearização entrega a célula vizinha inteira
 * — "PRANCHA 01/15", "ARQUIVO 040_26_est_imp_001_a" —, que não é descrição de
 * nada. Ele testava só o começo (`/^(PRANCHA|ARQUIVO)\b/`), e num projeto real
 * as folhas se chamam "PRANCHA CORTES" e "PRANCHA DETALHES": a descrição
 * inteira era apagada e a linha saía VAZIA na LD.
 *
 * Medido em `npm run mede:leitura`: as duas ÚNICAS leituras vazias das 316
 * pranchas dos samples eram exatamente estas duas folhas.
 *
 * É o mesmo defeito de `IMP` casando dentro de "IMPLANTAÇÃO", com outra roupa:
 * um guarda que não distingue o rótulo da palavra. O que separa os dois é o que
 * vem DEPOIS — número de folha ou código de arquivo é valor; palavra é título.
 */
const SO_O_ROTULO = /^(?:PRANCHA|ARQUIVO)\s*:?\s*(?:\d|[a-z0-9]*[_-][a-z0-9_-]*\d)/i;

export function cleanStampDescription(value: string) {
  const normalized = normalizeExtractedValue(value);

  if (SO_O_ROTULO.test(normalized)) {
    return "";
  }

  const semRotuloDoCampo = normalized.replace(
    /^\s*(?:CONTE[ÚU]DO|DESCRI[ÇC][ÃA]O)\s*[:\-]?\s*/i,
    "",
  );

  return cortarNoRotuloVizinho(semRotuloDoCampo)
    .replace(/\s*[,;:\-–—]+\s*$/g, "")
    .trim();
}

// Fallback para carimbos de CAD em grade: os rótulos ("CONTEÚDO:") ficam numa
// célula e os valores em outra, então ao linearizar o texto o valor do CONTEÚDO
// se separa do rótulo e a extração por rótulo falha. Nesses selos o título
// técnico da prancha aparece logo ANTES do código do arquivo (ex.: 040_26_est_
// imp_001_a) e depois do último rótulo do carimbo — é isso que recortamos aqui.
export function extractDescriptionNearFileCode(text: string, fileCode: string) {
  if (!fileCode) {
    return "";
  }

  const normalized = normalizeExtractedValue(text);
  const codePattern = new RegExp(fileCode.replace(/[_\-.]/g, "[ _\\-.]"), "i");
  const match = codePattern.exec(normalized);

  if (!match) {
    return "";
  }

  const before = normalized.slice(0, match.index);
  const boundary =
    /(?:SEDES|OBSERVA[ÇC][ÕO]ES|ENDERE[ÇC]O|CLIENTE|RESPONS[ÁA]VEL\s+T[ÉE]CNICO|VISTO\s+DATA|SECRETARIA)\b/gi;
  let start = 0;
  let boundaryMatch: RegExpExecArray | null;

  while ((boundaryMatch = boundary.exec(before)) !== null) {
    start = boundaryMatch.index + boundaryMatch[0].length;
  }

  // Sem limitador reconhecido, evita puxar a página inteira: usa só o final.
  const candidate = start > 0 ? before.slice(start) : before.slice(-120);

  return cleanStampDescription(candidate);
}
