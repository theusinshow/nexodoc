/**
 * RECUPERAÇÃO DO TEXTO DE PRANCHA EXPORTADA DE CAD — núcleo puro.
 *
 * A dor: pranchas da família EST deste escritório saem do CAD com fontes
 * embutidas SEM mapa de caracteres (ToUnicode). O pdf.js então devolve os
 * códigos crus, e o texto do carimbo chega assim ao modelo:
 *
 *   35()(,785$081,&,3$/   →   PREFEITURA MUNICIPAL
 *   5(9,7$/,=$d2'$)(,5$   →   REVITALIZAÇÃO DA FEIRA
 *
 * É um deslocamento CONSTANTE — inclusive no espaço, que vem como 0x03 e volta
 * a ser 0x20 pelo mesmo caminho. Não é um detalhe cosmético: obra e órgão são
 * exatamente os dois campos de que depende a conferência de identidade do selo,
 * a que existe para o volume não ir para a prefeitura errada. E o prompt de
 * extração manda "use apenas texto presente na página" e "não corrija
 * ortografia": sem este passo, o modelo é instruído a confiar no lixo.
 *
 * Medido nos arquivos reais de `docs/samples/040-26`: `arq`, `urb` e `his` não
 * têm nenhuma string quebrada; `est_fnd` e `est_tomo*` têm obra e órgão; e
 * `est_met_tomo1` tem 23 strings distintas, incluindo os próprios rótulos do
 * carimbo (ENDEREÇO, OBSERVAÇÕES). É por isso que "nos testes nunca tinha
 * errado": o problema anda com a família de arquivos, não com o software.
 *
 * A REGRA, e ela é o ponto do módulo:
 *
 *   a quebra é propriedade da FONTE, não da string.
 *
 * Por isso o reparo trabalha por fonte, e não string a string. Numa prancha, a
 * mesma página traz 1137 cotas e coordenadas numa fonte sã ("150(+/-35)",
 * "X:340103.42") e duas linhas de prosa numa fonte quebrada. Olhando string por
 * string, cota e prosa quebrada são indistinguíveis — as duas são "quase só
 * pontuação", e qualquer trava estatística que aceite `35()(,785$` também
 * aceita "X:340103.42" virando "mOHIEFEHCIG". Agrupadas por fonte, a diferença
 * é gritante e não depende de estatística nenhuma: a fonte da prosa está
 * quebrada INTEIRA, a das cotas não tem uma string quebrada sequer.
 *
 * O deslocamento é DESCOBERTO por fonte (não fixo em 29): 29 é o subset deste
 * exportador, e cravá-lo faria o módulo mentir no primeiro projeto de outro
 * escritório.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-texto-cad.ts`.
 */

/** Um item de texto como o pdf.js entrega: o texto e a fonte que o desenhou. */
export interface ItemDeTexto {
  texto: string;
  /** `fontName` do pdf.js ("g_d0_f4"). Itens sem fonte caem num grupo só. */
  fonte: string;
}

/**
 * Faixa de origem. Começa em 0x01 e não em 0x20 porque o espaço do texto
 * quebrado É um caractere de controle (0x03): deixá-lo de fora devolveria
 * "PREFEITURAMUNICIPAL" grudado, e é a volta do espaço que mais confirma que o
 * deslocamento está certo.
 */
const ORIGEM_MIN = 0x01;
const ORIGEM_MAX = 0x7e;
/** Faixa de destino: texto imprimível, espaço incluso. */
const DESTINO_MIN = 0x20;
const DESTINO_MAX = 0x7e;

const DESLOCAMENTO_MAX = DESTINO_MAX - ORIGEM_MIN;

/** Curto demais não dá sinal: "1/15" deslocado casaria com qualquer coisa. */
const MIN_CHARS = 6;

/**
 * A partir daqui, texto quebrado não se confunde mais com cota de desenho.
 *
 * Existe para a marcação `[ilegível]` (ver `marcaveis`): "150(+/-35)" e
 * "X:340103.42" são valores REAIS de prancha e não podem ser apagados do
 * texto; nenhuma cota tem doze caracteres de pontuação sem uma letra.
 */
const MIN_CHARS_MARCAVEL = 12;

const LETRA = /\p{L}/u;
const VOGAL = /[aeiouáàâãéêíóòôõúùü]/i;
/** Pontuação que prosa de carimbo tem de verdade ("OBS.: ...", "3º andar"). */
const PONTUACAO_OK = new Set([" ", ".", ",", "-", ":", "/", "º", "ª", "°", "(", ")"]);

function medir(valor: string): { letras: number; vogais: number; bons: number } {
  let letras = 0;
  let vogais = 0;
  let bons = 0;
  for (const c of valor) {
    if (LETRA.test(c)) {
      letras++;
      bons++;
      if (VOGAL.test(c)) vogais++;
    } else if (PONTUACAO_OK.has(c)) {
      bons++;
    }
  }
  return { letras, vogais, bons };
}

/**
 * O texto PARECE prosa?
 *
 * Três travas, e as três são necessárias. Só "quase tudo letra" aceitaria
 * "150(+/-35)" deslocado, que vira "NRMEHLJPRF" — 100% letras e nenhuma
 * palavra; a proporção de vogais é o que o reprova. E `bons` inclui a
 * pontuação que prosa de carimbo realmente tem, mas não `$&=+*`, que é o que
 * sobra quando o deslocamento está errado.
 */
export function pareceTexto(valor: string): boolean {
  if (valor.length < MIN_CHARS) return false;
  const { letras, vogais, bons } = medir(valor);
  if (letras === 0) return false;
  if (letras / valor.length < 0.5) return false;
  if (bons / valor.length < 0.85) return false;
  return vogais / letras >= 0.25;
}

/**
 * Quantas das strings viram prosa com o deslocamento `k` (0 = como estão).
 * É a única medida de que o módulo precisa: tudo o mais se decide comparando
 * este número em `k = 0` com o melhor `k`.
 */
function quantaProsa(strings: readonly string[], k: number): number {
  let n = 0;
  for (const s of strings) if (pareceTexto(k === 0 ? s : deslocar(s, k))) n++;
  return n;
}

/**
 * Desloca `valor` em `k`. Caractere que não cabe no destino passa INTACTO.
 *
 * Passar intacto e não virar sentinela porque as duas coisas que caem aqui
 * precisam de desfechos opostos, e a plausibilidade já as separa sozinha. Os
 * ACENTOS (o "d" de REVITALIZAÇÃO, o "Ï" de CHAPECÓ) o exportador mapeou por
 * outra tabela, sem constante única: mantidos, a palavra sai levemente torta
 * ("REVITALIZAdO ... CHAPECÏ") e ainda assim reconhecível, que é tudo de que o
 * modelo precisa para corroborar a imagem. Já num deslocamento ERRADO quase
 * tudo sobra, e o que sobra é pontuação — que `pareceTexto` reprova pela conta
 * de letras. Um punhado de acentos passa; um deslocamento errado, não.
 */
export function deslocar(valor: string, k: number): string {
  let saida = "";
  for (const c of valor) {
    const code = c.codePointAt(0) ?? 0;
    const alvo = code + k;
    saida +=
      code >= ORIGEM_MIN && code <= ORIGEM_MAX && alvo >= DESTINO_MIN && alvo <= DESTINO_MAX
        ? String.fromCharCode(alvo)
        : c;
  }
  return saida;
}

/**
 * A ASSINATURA MECÂNICA da quebra: o espaço saiu da faixa imprimível.
 *
 * Quando o exportador cifra a fonte, o espaço (0x20) desce junto com o resto e
 * vira um caractere de CONTROLE — 0x03, no subset destas pranchas. É o único
 * sinal aqui que não é estatística: nenhum texto são de PDF traz caractere de
 * controle no meio de uma palavra, e todo texto cifrado com mais de uma palavra
 * traz. Sem esta trava, duas coordenadas na mesma fonte ("X:340103.42",
 * "Y:7000867.53") acham um `k` comum que as torna pronunciáveis — e uma prancha
 * de topografia, que é quase só coordenada, seria destruída inteira.
 */
function temControle(strings: readonly string[]): boolean {
  return strings.some((s) => {
    for (const c of s) {
      const code = c.codePointAt(0) ?? 0;
      if (code >= ORIGEM_MIN && code < DESTINO_MIN) return true;
    }
    return false;
  });
}

/** O deslocamento leva TODO controle de volta para dentro do imprimível? */
function controleVoltaAoImprimivel(strings: readonly string[], k: number): boolean {
  for (const s of strings) {
    for (const c of s) {
      const code = c.codePointAt(0) ?? 0;
      if (code >= ORIGEM_MIN && code < DESTINO_MIN) {
        const alvo = code + k;
        if (alvo < DESTINO_MIN || alvo > DESTINO_MAX) return false;
      }
    }
  }
  return true;
}

/**
 * Uma corroboração só nunca basta: entre 93 deslocamentos, algum acerta uma
 * string por acaso. A exceção é a fonte de uma linha só (a do rodapé de
 * direitos autorais, `n=1` nos arquivos reais), onde não há segunda string para
 * corroborar — ali a prosa recuperada precisa ser longa, e acaso não produz
 * vinte caracteres de português seguidos.
 */
const MIN_ACERTOS = 2;

/**
 * O deslocamento de UMA fonte — `null` quando ela não está quebrada.
 *
 * Três perguntas, todas sobre a FONTE inteira e não sobre a string:
 *
 *   1. ela desenha alguma prosa legível? Se sim, está sã e nada a toca. É o que
 *      protege a fonte das cotas, que na mesma página escreve "X:340103.42" e
 *      "Características dos materiais".
 *   2. ela traz a assinatura da quebra (o espaço virado controle)?
 *   3. existe um deslocamento que devolve o espaço ao lugar E faz prosa
 *      aparecer, em mais de uma string?
 */
export function descobrirDeslocamento(strings: readonly string[]): number | null {
  const longas = strings.filter((s) => s.length >= MIN_CHARS);
  if (longas.length === 0) return null;
  // A fonte já escreve português: está sã, e mexer nela só pode piorar.
  if (quantaProsa(longas, 0) > 0) return null;
  if (!temControle(strings)) return null;

  let melhor: number | null = null;
  let melhorAcertos = 0;
  for (let k = 1; k <= DESLOCAMENTO_MAX; k++) {
    if (!controleVoltaAoImprimivel(strings, k)) continue;
    const acertos = quantaProsa(longas, k);
    if (acertos > melhorAcertos) {
      melhorAcertos = acertos;
      melhor = k;
    }
  }
  if (melhor === null || melhorAcertos === 0) return null;

  if (melhorAcertos >= MIN_ACERTOS) return melhor;
  const unica = longas.length === 1 && deslocar(longas[0], melhor).length >= MIN_CHARS_MARCAVEL;
  return unica ? melhor : null;
}

export interface TextoReparado {
  /** Os textos na MESMA ordem da entrada, com os reparados trocados. */
  textos: string[];
  /** As fontes tidas como quebradas e o deslocamento de cada uma. */
  fontesQuebradas: { fonte: string; deslocamento: number }[];
  /** Quantos itens foram efetivamente trocados. */
  reparados: number;
  /**
   * Índices do que continuou ilegível E é longo o bastante para não ser cota de
   * desenho. Só estes podem virar `[ilegível]` no texto que vai ao modelo.
   *
   * A separação entre "não consegui reparar" e "pode ser apagado" existe porque
   * as duas coisas erram para lados opostos: deixar `35()(,785$...` no texto faz
   * o modelo copiá-lo como nome do cliente; apagar "150(+/-35)" tira uma cota
   * real da prancha. Marcar só o que é comprovadamente prosa quebrada é o único
   * lado seguro dos dois.
   */
  marcaveis: number[];
}

/**
 * Repara o que dá e denuncia o que não dá.
 *
 * Numa fonte quebrada, TUDO o que ela desenha está cifrado — inclusive o
 * "01/16" do campo PRANCHA, que sozinho pareceria são. Por isso o deslocamento
 * se aplica ao grupo inteiro, e não só ao que "parece ilegível": decidir string
 * a string deixava passar justamente `'LUHLWRV$XWRUDLV` (minúsculas cifradas
 * caem em letras maiúsculas e enganam qualquer contagem de caracteres) e
 * ameaçava `040_26_est_imp_001_a`, que é o código da prancha.
 */
export function repararTextoCad(itens: readonly ItemDeTexto[]): TextoReparado {
  const porFonte = new Map<string, number[]>();
  itens.forEach((item, i) => {
    const chave = item.fonte || "";
    const grupo = porFonte.get(chave);
    if (grupo) grupo.push(i);
    else porFonte.set(chave, [i]);
  });

  const textos = itens.map((i) => i.texto);
  const fontesQuebradas: { fonte: string; deslocamento: number }[] = [];
  const marcaveis: number[] = [];
  let reparados = 0;

  for (const [fonte, indices] of porFonte) {
    const deslocamento = descobrirDeslocamento(indices.map((i) => textos[i]));
    if (deslocamento === null) continue;

    fontesQuebradas.push({ fonte, deslocamento });
    for (const i of indices) {
      textos[i] = deslocar(textos[i], deslocamento);
      reparados++;
      // O que nem depois do reparo virou prosa não tem texto para o modelo
      // copiar. Só o longo entra: nenhuma cota de desenho tem doze caracteres.
      if (textos[i].length >= MIN_CHARS_MARCAVEL && !pareceTexto(textos[i])) marcaveis.push(i);
    }
  }

  marcaveis.sort((a, b) => a - b);
  return { textos, fontesQuebradas, reparados, marcaveis };
}
