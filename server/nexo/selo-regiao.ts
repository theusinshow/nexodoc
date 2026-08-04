/**
 * ONDE FICA O SELO, E O QUE A PÁGINA É — núcleo puro.
 *
 * Duas perguntas que a leitura de selo respondia por chute, e que são fato
 * objetivo mensurável na própria página.
 *
 * ## 1. Onde fica o carimbo
 *
 * A leitura recortava um quadrante fixo — texto de `nx ≥ 0.55, ny ≥ 0.55` e
 * imagem de `x 0.52, y 0.50`. Medido nas pranchas reais de
 * `docs/samples/040-26`, o carimbo vive em `x ∈ [0.79, 1.0], y ∈ [0.81, 1.0]`
 * nas A0 de 2384×1684, e em `x ≥ 0.85` nas de 3370×1684. O quadrante fixo pega
 * DOZE VEZES a área do carimbo: numa página, 228 itens de tabela de lajes e
 * coordenadas chegavam ao modelo rotulados como "REGIÃO DO SELO", antes dos
 * rótulos do carimbo. Achar agulha no palheiro era o trabalho que se pedia ao
 * modelo, e às vezes ele achava a agulha errada.
 *
 * A caixa aqui é achada pelas ÂNCORAS — os rótulos que só existem dentro do
 * carimbo. Sobrevivem até no pior arquivo: em `est_met_tomo1`, onde o
 * exportador quebrou ENDEREÇO e OBSERVAÇÕES, PRANCHA/ESCALA/ARQUIVO/CLIENTE/
 * OBRA continuam legíveis e bastam. Sem âncora nenhuma, cai no quadrante
 * antigo: pior do que hoje, nunca.
 *
 * ## 2. Se a página é mesmo uma prancha
 *
 * Todo PDF combinado destes volumes traz três páginas A4 na frente: duas capas
 * e um ÍNDICE. E o índice LISTA TODOS OS CÓDIGOS das pranchas
 * (`040_26_est_..._001_a` … quinze deles). Lido como prancha, o modelo devolvia
 * o primeiro código da lista — e aí duas folhas ficavam com o mesmo campo
 * ARQUIVO. `reconcileByPageOrder` via a duplicata e fazia o que foi desenhado
 * para fazer: reatribuía a folha de TODAS as páginas pela ordem. Uma página que
 * não era prancha reescrevia a numeração do conjunto inteiro.
 *
 * A classificação é conservadora de propósito e erra sempre para o mesmo lado:
 * só descarta com PROVA de que a página não é prancha (é um índice, ou é papel
 * pequeno em retrato sem carimbo nenhum). Prancha escaneada, sem uma linha de
 * texto, continua sendo lida — sumir com uma folha é pior do que gastar uma
 * chamada de modelo com uma capa.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-selo-regiao.ts`.
 */

/** Um item de texto com a posição já normalizada (0..1, y crescendo p/ baixo). */
export interface ItemPosicionado {
  texto: string;
  x: number;
  y: number;
}

/** Retângulo normalizado da página. */
export interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * O quadrante de antes. Continua sendo a rede de segurança quando não há
 * âncora — prancha de outro escritório, carimbo em imagem, PDF escaneado.
 */
export const CAIXA_FALLBACK: Caixa = { x0: 0.55, y0: 0.55, x1: 1, y1: 1 };

/**
 * Os rótulos que só existem dentro do carimbo. `CONTEÚDO` e `ENDEREÇO` estão na
 * lista mesmo sendo os que mais quebram no exportador: quando sobrevivem,
 * apertam a caixa; quando não, os outros cinco seguram.
 */
const ANCORAS =
  /^(?:CONTE[ÚU]DO|PRANCHA|ARQUIVO|ESCALA|CLIENTE|OBRA|ENDERE[ÇC]O|RESPONS[ÁA]VEL\s+T[ÉE]CNICO|OBSERVA[ÇC][ÕO]ES|DISCIPLINA|PROJETO)\s*:?$/i;

/**
 * Quantas âncoras bastam. Três porque duas podem cair por acaso numa legenda de
 * desenho ("ESCALA" aparece solta em corte), e porque o pior arquivo real ainda
 * entrega cinco.
 */
const MIN_ANCORAS = 3;

/**
 * Folga em volta das âncoras. Os rótulos marcam o miolo do carimbo, não a borda:
 * o quadro de revisões fica ACIMA do primeiro rótulo e o valor de cada campo
 * fica à direita e abaixo dele. A folga vertical é maior porque é para cima que
 * o carimbo cresce (revisões, observações).
 */
const FOLGA_X = 0.04;
const FOLGA_Y = 0.1;

/** O código de prancha na convenção do escritório: `040_26_est_imp_001_a`. */
const CODIGO_DE_PRANCHA = /\b\d{2,4}[_-]\d{2}[_a-z0-9.]*[_-]\d{2,3}[_-][a-z]\b/i;

/**
 * A caixa do carimbo, achada pelas âncoras. Devolve também quantas foram
 * encontradas — quem chama precisa poder dizer se confiou na medida ou no
 * quadrante de reserva.
 */
export function acharCaixaDoSelo(itens: readonly ItemPosicionado[]): {
  caixa: Caixa;
  ancoras: number;
} {
  let minX = 1;
  let minY = 1;
  let ancoras = 0;

  for (const item of itens) {
    if (!ANCORAS.test(item.texto.trim())) continue;
    ancoras++;
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
  }

  if (ancoras < MIN_ANCORAS) return { caixa: CAIXA_FALLBACK, ancoras };

  /*
   * A caixa vai SEMPRE até o canto inferior direito. As âncoras dizem onde o
   * carimbo começa; onde ele termina não é preciso medir, porque nesta
   * convenção ele termina na borda do papel — e uma borda medida por âncora
   * cortaria justamente o campo de numeração, que fica no extremo.
   */
  return {
    caixa: {
      x0: Math.max(0, minX - FOLGA_X),
      y0: Math.max(0, minY - FOLGA_Y),
      x1: 1,
      y1: 1,
    },
    ancoras,
  };
}

/** O item cai dentro da caixa? */
export function dentro(item: ItemPosicionado, caixa: Caixa): boolean {
  return item.x >= caixa.x0 && item.x <= caixa.x1 && item.y >= caixa.y0 && item.y <= caixa.y1;
}

/**
 * Altura de uma linha de texto, em fração da página. Itens dentro desta
 * distância vertical pertencem à mesma linha do carimbo.
 */
const TOLERANCIA_LINHA = 0.008;

/**
 * O texto da região, em ORDEM DE LEITURA — linha a linha, e da esquerda para a
 * direita dentro de cada linha.
 *
 * A leitura antiga concatenava os itens na ordem em que o PDF os desenha, que
 * não é a ordem em que uma pessoa lê. O campo mais importante do carimbo saía
 * assim:
 *
 *   "EST 15 01/"      em vez de      "EST 01/15"
 *
 * O número da prancha e o total chegavam separados, fora de ordem e colados a
 * números soltos de tabela. Era o campo de que tudo depende — a numeração da
 * LD, a conferência, a divisão em tomos — e ele chegava picado.
 */
export function textoPorPosicao(itens: readonly ItemPosicionado[], caixa: Caixa): string {
  const dentroDaCaixa = itens
    .filter((i) => i.texto.trim() && dentro(i, caixa))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const linhas: string[] = [];
  let atual: ItemPosicionado[] = [];
  let baseY = 0;

  const fechar = () => {
    if (atual.length === 0) return;
    linhas.push(
      atual
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((i) => i.texto.trim())
        .join(" "),
    );
    atual = [];
  };

  for (const item of dentroDaCaixa) {
    if (atual.length === 0) {
      baseY = item.y;
    } else if (item.y - baseY > TOLERANCIA_LINHA) {
      fechar();
      baseY = item.y;
    }
    atual.push(item);
  }
  fechar();

  return linhas.join("\n");
}

export type TipoDePagina = "prancha" | "indice" | "capa" | "outra";

/** Índice é uma LISTA de pranchas: muitos códigos distintos e nenhum carimbo. */
const MIN_CODIGOS_DE_INDICE = 3;

/**
 * Acima disto o papel é de prancha, mesmo em retrato. A2 em pé (1190×1684)
 * ainda é prancha; A4 e A3 em pé, não.
 */
const LIMITE_PAPEL_PEQUENO = 1200;

/**
 * O que esta página É.
 *
 * A ordem das perguntas é a garantia: o carimbo decide PRIMEIRO. Uma folha de
 * detalhes em A4 com carimbo continua sendo prancha, e uma prancha que por
 * acaso liste três códigos numa tabela também — porque ela tem carimbo, e
 * índice não tem.
 */
export function classificarPagina(pagina: {
  largura: number;
  altura: number;
  itens: readonly ItemPosicionado[];
}): TipoDePagina {
  const { ancoras } = acharCaixaDoSelo(pagina.itens);
  if (ancoras >= MIN_ANCORAS) return "prancha";

  const codigos = new Set<string>();
  for (const item of pagina.itens) {
    const m = CODIGO_DE_PRANCHA.exec(item.texto);
    if (m) codigos.add(m[0].toLowerCase());
  }
  if (codigos.size >= MIN_CODIGOS_DE_INDICE) return "indice";

  const retrato = pagina.altura >= pagina.largura;
  const pequeno = Math.max(pagina.largura, pagina.altura) <= LIMITE_PAPEL_PEQUENO;
  if (retrato && pequeno) return "capa";

  return "outra";
}

/**
 * Vale gastar uma chamada de modelo com esta página?
 *
 * Só o que está PROVADO não ser prancha fica de fora. "outra" — papel grande
 * sem uma linha de texto, que é como chega uma prancha escaneada — passa: uma
 * folha que some do conjunto é um estrago maior do que uma leitura desperdiçada,
 * e é justamente o estrago que este trabalho todo existe para consertar.
 */
export function valeLerComoPrancha(tipo: TipoDePagina): boolean {
  return tipo !== "indice" && tipo !== "capa";
}
