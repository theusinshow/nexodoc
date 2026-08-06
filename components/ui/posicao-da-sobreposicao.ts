/**
 * ONDE UMA SOBREPOSIÇÃO CABE — a medida que popover e dropdown compartilham.
 *
 * Nasceu de um defeito que apareceu só num print: um popover ancorado num nó da
 * parte de baixo do canvas descia para fora da janela, e só o cabeçalho ficava
 * visível. Os campos continuavam no DOM, então toda asserção de conteúdo passava
 * verde. O conserto morava no `agent-popover`; o `dropdown` tinha o mesmo padrão
 * e o mesmo defeito, e uma cópia da regra divergiria da outra na primeira
 * correção.
 *
 * Duas coisas que a primeira versão errava e esta acerta:
 *
 * 1. **Mede contra quem RECORTA, não contra a janela.** O canvas do React Flow é
 *    `overflow: hidden` e termina bem antes da borda da tela — um painel que
 *    "cabe na janela" é cortado ali mesmo, em silêncio. Procuramos o primeiro
 *    ancestral que recorta e usamos os limites dele.
 * 2. **Cuida do eixo HORIZONTAL.** O painel é centrado no gatilho; perto da
 *    borda, metade dele sai. O deslocamento traz de volta.
 *
 * A escala existe porque dentro do React Flow o gatilho vive sob um
 * `transform: scale`: o espaço medido está em pixels de TELA e o `max-height`
 * é aplicado em pixels LOCAIS. Sem converter, o limite encolheria com o zoom.
 */

export interface LugarDaSobreposicao {
  lado: "abaixo" | "acima";
  /** Altura máxima em pixels LOCAIS (já convertida da escala). */
  alturaMax: number;
  /** Correção horizontal em pixels LOCAIS. 0 = centrado no gatilho. */
  deslocX: number;
}

/** Margem mínima entre a sobreposição e a borda de quem a recorta. */
const MARGEM = 16;
/** Espaço do bico, entre o gatilho e o painel. */
const BICO = 10;
/** Abaixo disto não vale a pena abrir: é uma fatia, não um painel. */
const ALTURA_MINIMA = 160;

/** O primeiro ancestral que RECORTA o conteúdo — ou a janela, se não houver. */
function limitesDeQuemRecorta(elemento: HTMLElement): {
  topo: number;
  base: number;
  esquerda: number;
  direita: number;
} {
  let no = elemento.parentElement;
  while (no) {
    const estilo = getComputedStyle(no);
    const recorta = /auto|hidden|scroll|clip/.test(
      estilo.overflowX + " " + estilo.overflowY,
    );
    if (recorta) {
      const r = no.getBoundingClientRect();
      return { topo: r.top, base: r.bottom, esquerda: r.left, direita: r.right };
    }
    no = no.parentElement;
  }
  return {
    topo: 0,
    base: window.innerHeight,
    esquerda: 0,
    direita: window.innerWidth,
  };
}

/**
 * Mede onde a sobreposição cabe.
 *
 * `gatilho` é o elemento âncora (a raiz que envolve gatilho e painel serve).
 * `painel` é o painel já renderizado — dele sai só a LARGURA local, que não
 * muda com o deslocamento, para a conta não depender do resultado dela mesma.
 */
export function medirLugarDaSobreposicao(
  gatilho: HTMLElement,
  painel: HTMLElement | null,
): LugarDaSobreposicao {
  const r = gatilho.getBoundingClientRect();
  const limites = limitesDeQuemRecorta(gatilho);

  // Pixels de TELA por pixel LOCAL. Fora de um `scale`, é 1.
  const escala =
    gatilho.offsetHeight > 0 ? r.height / gatilho.offsetHeight : 1;
  const emLocal = (px: number) => px / (escala || 1);

  const abaixo = limites.base - r.bottom - MARGEM - BICO;
  const acima = r.top - limites.topo - MARGEM - BICO;
  const lado = abaixo >= acima ? "abaixo" : "acima";

  /*
   * O piso de altura vence a medição de propósito: um painel de 40px é pior
   * que um painel que rola. Mas ele SÓ entra quando nem o maior dos dois lados
   * serve — senão um piso generoso mascararia o espaço real.
   */
  const espaco = Math.max(abaixo, acima);
  const alturaMax = emLocal(Math.max(ALTURA_MINIMA, espaco));

  // Horizontal: o painel é centrado no gatilho; trazemos de volta o que vazou.
  const larguraNaTela = (painel?.offsetWidth ?? 0) * (escala || 1);
  const centro = r.left + r.width / 2;
  const esquerda = centro - larguraNaTela / 2;
  const direita = centro + larguraNaTela / 2;

  let deslocX = 0;
  if (larguraNaTela > 0) {
    if (esquerda < limites.esquerda + MARGEM) {
      deslocX = limites.esquerda + MARGEM - esquerda;
    } else if (direita > limites.direita - MARGEM) {
      deslocX = limites.direita - MARGEM - direita;
    }
  }

  return { lado, alturaMax, deslocX: emLocal(deslocX) };
}
